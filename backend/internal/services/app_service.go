package services

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"onperfumaria/backend/internal/config"
	"onperfumaria/backend/internal/mailer"
	"onperfumaria/backend/internal/payments"
	"onperfumaria/backend/internal/shipping"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	cfg    config.Config
	db     *pgxpool.Pool
	mailer *mailer.Mailer
}

var ErrInvalidCredentials = errors.New("e-mail ou senha invalidos")

const organizerStoreSettingKey = "organizer_store"

type shippingRule struct {
	Code         string
	Name         string
	RuleType     string
	Amount       float64
	MinOrder     float64
	WeightMin    int
	WeightMax    int
	RegionPrefix string
}

type CheckoutItem struct {
	ProductID string `json:"productId"`
	Quantity  int    `json:"quantity"`
}

type CheckoutInput struct {
	CustomerID      string         `json:"customerId"`
	CustomerName    string         `json:"customerName"`
	CustomerEmail   string         `json:"customerEmail"`
	CustomerPhone   string         `json:"customerPhone"`
	CustomerCPF     string         `json:"customerCpf"`
	Password        string         `json:"password"`
	CEP             string         `json:"cep"`
	Street          string         `json:"street"`
	Number          string         `json:"number"`
	Neighborhood    string         `json:"neighborhood"`
	City            string         `json:"city"`
	State           string         `json:"state"`
	DeliveryMode    string         `json:"deliveryMode"`
	CouponCode      string         `json:"couponCode"`
	CorreiosPrice   float64        `json:"correiosPrice"`
	Items           []CheckoutItem `json:"items"`
	PaymentMethodID string         `json:"paymentMethodId"`
	Token           string         `json:"token"`
	IssuerID        string         `json:"issuerId"`
	Installments    int            `json:"installments"`
	// Preenchido pelo handler a partir da propria requisicao (nunca vem do
	// navegador): e o endereco onde o Mercado Pago deve avisar o pagamento.
	PublicBaseURL string `json:"-"`
}

type CustomerProfilePayload struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Phone string `json:"phone"`
	CPF   string `json:"cpf"`
}

type CustomerAddressPayload struct {
	AddressID    string `json:"addressId"`
	AddressLabel string `json:"addressLabel"`
	CEP          string `json:"cep"`
	Street       string `json:"street"`
	Number       string `json:"number"`
	Neighborhood string `json:"neighborhood"`
	City         string `json:"city"`
	State        string `json:"state"`
	IsDefault    bool   `json:"isDefault"`
}

func NewService(cfg config.Config, db *pgxpool.Pool) *Service {
	svc := &Service{
		cfg: cfg,
		db:  db,
		mailer: mailer.New(mailer.Config{
			Host:     cfg.SMTPHost,
			Port:     cfg.SMTPPort,
			User:     cfg.SMTPUser,
			Password: cfg.SMTPPassword,
			From:     cfg.SMTPFrom,
			FromName: cfg.SMTPFromName,
		}),
	}

	return svc
}

// resolvePaymentsProvider reads the current Mercado Pago access token from the
// database on every call, so changes saved in the admin panel take effect
// immediately without requiring a backend restart.
func (s *Service) resolvePaymentsProvider(ctx context.Context) payments.Provider {
	mpToken, _ := s.GetSetting(ctx, "mp_access_token")
	if mpToken != "" {
		return payments.NewMercadoPagoProvider(mpToken, s.cfg.FrontendURL)
	}
	return payments.MockProvider{}
}

func (s *Service) GetOrganizerStore(ctx context.Context) (json.RawMessage, error) {
	var value string
	err := s.db.QueryRow(ctx, `SELECT value FROM settings WHERE key = $1`, organizerStoreSettingKey).Scan(&value)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if !json.Valid([]byte(value)) {
		return nil, errors.New("estado do organizador invalido")
	}
	return json.RawMessage(value), nil
}

func (s *Service) SaveOrganizerStore(ctx context.Context, value json.RawMessage) (json.RawMessage, error) {
	if len(value) == 0 || !json.Valid(value) {
		return nil, errors.New("estado do organizador invalido")
	}
	if len(value) > 20*1024*1024 {
		return nil, errors.New("estado do organizador excede o limite permitido")
	}

	_, err := s.db.Exec(
		ctx,
		`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
		organizerStoreSettingKey,
		string(value),
	)
	if err != nil {
		return nil, err
	}
	return value, nil
}

func (s *Service) ValidateCoupon(ctx context.Context, code string, subtotal float64) (map[string]interface{}, error) {
	if code == "" {
		return nil, errors.New("codigo do cupom obrigatorio")
	}
	var discountType string
	var value float64
	err := s.db.QueryRow(ctx, `SELECT discount_type, value FROM coupons WHERE code = $1 AND is_active = true`, strings.ToUpper(strings.TrimSpace(code))).Scan(&discountType, &value)
	if err != nil {
		return nil, errors.New("cupom invalido ou inativo")
	}
	discount := 0.0
	if discountType == "percent" {
		discount = subtotal * (value / 100)
	} else {
		discount = value
	}
	if discount > subtotal {
		discount = subtotal
	}
	return map[string]interface{}{
		"code":         strings.ToUpper(code),
		"discountType": discountType,
		"value":        value,
		"discount":     discount,
		"subtotal":     subtotal,
		"final":        subtotal - discount,
	}, nil
}

func (s *Service) StoreConfig(ctx context.Context) (map[string]interface{}, error) {
	rows, err := s.db.Query(ctx, `SELECT code, name, rule_type, amount, COALESCE(min_order_amount, 0), COALESCE(weight_min_grams, 0), COALESCE(weight_max_grams, 0), COALESCE(region_prefix, '') FROM shipping_rules WHERE is_active = true ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rules, err := scanShippingRules(rows)
	if err != nil {
		return nil, err
	}
	rules = normalizeShippingRules(rules)

	options := []map[string]string{}
	for _, rule := range rules {
		if rule.RuleType == "weight" || rule.RuleType == "free_over" {
			continue
		}
		options = append(options, map[string]string{"value": rule.Code, "label": rule.Name})
	}
	options = append(options, map[string]string{"value": "correios", "label": "Correios (PAC/SEDEX)"})

	mpPublicKey, _ := s.GetSetting(ctx, "mp_public_key")
	storeWhatsapp, _ := s.GetSetting(ctx, "store_whatsapp")

	// Aparencia (cores, fontes, logo, formato de botao/janela, densidade) e
	// editada no painel de admin e lida aqui pela loja publica - mesma ideia
	// do Google/Mercado Pago abaixo, sem rebuild do frontend nem restart do
	// backend. Chaves cruas (theme_color_primary etc.) iguais nas duas pontas
	// (ver GetThemeSettings/SaveThemeSetting), sem traducao de nome no meio.
	theme, err := s.GetThemeSettings(ctx)
	if err != nil {
		return nil, err
	}

	// Client id do Google e access token do Mercado Pago saem do banco (gaveta
	// "API" do admin) em vez de compilados no bundle: configura a loja sem
	// rebuild do frontend nem restart do backend.
	return map[string]interface{}{
		"shippingOptions": options,
		"mpPublicKey":     mpPublicKey,
		"googleClientId":  s.resolveGoogleClientID(ctx),
		"storeWhatsapp":   storeWhatsapp,
		"theme":           theme,
	}, nil
}

func (s *Service) QuoteShipping(ctx context.Context, input shipping.QuoteInput) (shipping.QuoteOutput, error) {
	rows, err := s.db.Query(ctx, `
		SELECT code, name, rule_type, amount, COALESCE(min_order_amount, 0), COALESCE(weight_min_grams, 0), COALESCE(weight_max_grams, 0), COALESCE(region_prefix, '')
		FROM shipping_rules
		WHERE is_active = true`)
	if err != nil {
		return shipping.QuoteOutput{}, err
	}
	defer rows.Close()

	rules, err := scanShippingRules(rows)
	if err != nil {
		return shipping.QuoteOutput{}, err
	}
	rules = normalizeShippingRules(rules)

	// Em Campo Grande o frete nao e precificado no site: o valor (quando houver)
	// e combinado direto entre o cliente e o vendedor que atender o pedido.
	if strings.EqualFold(input.City, "CAMPO GRANDE") {
		if input.DeliveryMode == "pickup" {
			return shipping.QuoteOutput{Amount: 0, Label: "Retirada na loja"}, nil
		}
		return shipping.QuoteOutput{Amount: 0, Label: "Entrega em residencia - a combinar com o vendedor"}, nil
	}

	switch input.DeliveryMode {
	case "pickup":
		return findShippingRule(rules, "pickup")
	case "local":
		return findShippingRule(rules, "local")
	case "manual":
		return findShippingRule(rules, "manual")
	}

	for _, current := range rules {
		if current.RuleType == "free_over" && input.Subtotal >= current.MinOrder {
			return shipping.QuoteOutput{Amount: 0, Label: current.Name}, nil
		}
	}

	base := 0.0
	label := "Frete calculado"
	for _, current := range rules {
		if current.RuleType == "fixed" {
			base += current.Amount
			label = current.Name
		}
		if current.RuleType == "weight" && input.WeightGrams >= current.WeightMin && (current.WeightMax == 0 || input.WeightGrams <= current.WeightMax) {
			base += current.Amount
		}
		if current.RegionPrefix != "" && strings.HasPrefix(input.CEP, current.RegionPrefix) && current.RuleType == "local" && input.DeliveryMode == "fixed" {
			base = current.Amount
			label = current.Name
		}
	}

	return shipping.QuoteOutput{Amount: base, Label: label}, nil
}

// CustomerProfile busca a ficha completa de um cliente (usada tanto por
// "/customer/me", onde requesterID e sempre o proprio customerID, quanto pela
// tela de Clientes do admin). O admin fixo so pode ver a si mesmo por aqui.
func (s *Service) CustomerProfile(ctx context.Context, customerID, requesterID string) (map[string]interface{}, error) {
	var name, email, phone, cpf string
	var isFixedAdmin bool
	err := s.db.QueryRow(ctx, `SELECT name, email, phone, COALESCE(cpf, ''), is_fixed_admin FROM customers WHERE id = $1`, customerID).Scan(&name, &email, &phone, &cpf, &isFixedAdmin)
	if err != nil {
		return nil, err
	}
	if isFixedAdmin && customerID != requesterID {
		return nil, errors.New("cliente nao encontrado")
	}

	addressRows, err := s.db.Query(ctx, `SELECT id::text, label, cep, street, number, neighborhood, city, state, is_default FROM addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC`, customerID)
	if err != nil {
		return nil, err
	}
	defer addressRows.Close()

	addresses := []map[string]interface{}{}
	for addressRows.Next() {
		var id, label, cep, street, number, neighborhood, city, state string
		var isDefault bool
		if err := addressRows.Scan(&id, &label, &cep, &street, &number, &neighborhood, &city, &state, &isDefault); err != nil {
			return nil, err
		}
		addresses = append(addresses, map[string]interface{}{
			"id": id, "label": label, "cep": cep, "street": street, "number": number, "neighborhood": neighborhood, "city": city, "state": state, "isDefault": isDefault,
		})
	}

	ordersRows, err := s.db.Query(ctx, `
		SELECT
			o.id::text,
			o.total_amount,
			o.payment_status,
			o.order_status,
			o.created_at,
			COALESCE((SELECT oi.product_name FROM order_items oi WHERE oi.order_id = o.id ORDER BY oi.id LIMIT 1), ''),
			COALESCE((SELECT oi.product_image_url FROM order_items oi WHERE oi.order_id = o.id ORDER BY oi.id LIMIT 1), ''),
			COALESCE((SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id), 0)
		FROM orders o
		WHERE o.customer_id = $1
		ORDER BY o.created_at DESC`, customerID)
	if err != nil {
		return nil, err
	}
	defer ordersRows.Close()

	orders := []map[string]interface{}{}
	for ordersRows.Next() {
		var id, paymentStatus, orderStatus, previewName, previewImageURL string
		var total float64
		var itemCount int
		var createdAt time.Time
		if err := ordersRows.Scan(&id, &total, &paymentStatus, &orderStatus, &createdAt, &previewName, &previewImageURL, &itemCount); err != nil {
			return nil, err
		}
		orders = append(orders, map[string]interface{}{
			"id": id, "total": total, "paymentStatus": paymentStatus, "orderStatus": orderStatus, "createdAt": createdAt,
			"previewName": previewName, "previewImageUrl": previewImageURL, "itemCount": itemCount,
		})
	}

	return map[string]interface{}{
		"name": name, "email": email, "phone": phone, "cpf": cpf, "addresses": addresses, "orders": orders,
	}, nil
}

func (s *Service) CustomerOrder(ctx context.Context, customerID, orderID string) (map[string]interface{}, error) {
	var order struct {
		ID            string
		Total         float64
		Subtotal      float64
		PaymentStatus string
		OrderStatus   string
		PaymentMethod string
		CreatedAt     time.Time
		Shipping      float64
		Discount      float64
		AddressLabel  string
		Street        string
		Number        string
		Neighborhood  string
		City          string
		State         string
		CEP           string
	}

	err := s.db.QueryRow(ctx, `
		SELECT
			o.id::text,
			o.total_amount,
			o.subtotal,
			o.payment_status,
			o.order_status,
			o.payment_method,
			o.created_at,
			o.shipping_amount,
			o.discount_amount,
			COALESCE(a.label, ''),
			COALESCE(a.street, ''),
			COALESCE(a.number, ''),
			COALESCE(a.neighborhood, ''),
			COALESCE(a.city, ''),
			COALESCE(a.state, ''),
			COALESCE(a.cep, '')
		FROM orders o
		LEFT JOIN addresses a ON a.id = o.address_id
		WHERE o.id = $1 AND o.customer_id = $2`, orderID, customerID,
	).Scan(
		&order.ID,
		&order.Total,
		&order.Subtotal,
		&order.PaymentStatus,
		&order.OrderStatus,
		&order.PaymentMethod,
		&order.CreatedAt,
		&order.Shipping,
		&order.Discount,
		&order.AddressLabel,
		&order.Street,
		&order.Number,
		&order.Neighborhood,
		&order.City,
		&order.State,
		&order.CEP,
	)
	if err != nil {
		return nil, err
	}

	itemsRows, err := s.db.Query(ctx, `
		SELECT oi.product_name, oi.unit_price, oi.quantity, COALESCE(oi.product_image_url, '')
		FROM order_items oi
		WHERE oi.order_id = $1
		ORDER BY oi.id`, orderID)
	if err != nil {
		return nil, err
	}
	defer itemsRows.Close()

	items := []map[string]interface{}{}
	for itemsRows.Next() {
		var name, imageURL string
		var price float64
		var quantity int
		if err := itemsRows.Scan(&name, &price, &quantity, &imageURL); err != nil {
			return nil, err
		}
		items = append(items, map[string]interface{}{
			"name": name, "price": price, "quantity": quantity, "imageUrl": imageURL,
		})
	}
	if err := itemsRows.Err(); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"id": order.ID, "total": order.Total, "subtotal": order.Subtotal,
		"paymentStatus": order.PaymentStatus, "orderStatus": order.OrderStatus,
		"paymentMethod": order.PaymentMethod, "createdAt": order.CreatedAt,
		"shipping": order.Shipping, "discount": order.Discount,
		"address": map[string]interface{}{
			"label": order.AddressLabel, "street": order.Street, "number": order.Number,
			"neighborhood": order.Neighborhood, "city": order.City, "state": order.State, "cep": order.CEP,
		},
		"items": items,
	}, nil
}

func (s *Service) UpdateCustomerProfile(ctx context.Context, customerID string, payload CustomerProfilePayload) (map[string]interface{}, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `UPDATE customers SET name = $1, email = $2, phone = $3, cpf = $4 WHERE id = $5`,
		payload.Name, payload.Email, payload.Phone, payload.CPF, customerID,
	)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return s.CustomerProfile(ctx, customerID, customerID)
}

func (s *Service) SaveCustomerAddress(ctx context.Context, customerID string, payload CustomerAddressPayload) (map[string]interface{}, error) {
	if payload.CEP == "" || payload.Street == "" || payload.Number == "" || payload.Neighborhood == "" {
		return nil, errors.New("preencha os campos obrigatorios do endereco")
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if payload.IsDefault {
		if _, err := tx.Exec(ctx, `UPDATE addresses SET is_default = false WHERE customer_id = $1`, customerID); err != nil {
			return nil, err
		}
	}

	if payload.AddressID != "" {
		_, err = tx.Exec(ctx, `
			UPDATE addresses
			SET label = $1, cep = $2, street = $3, number = $4, neighborhood = $5, city = $6, state = $7, is_default = $8
			WHERE id = $9 AND customer_id = $10`,
			defaultString(payload.AddressLabel, "Principal"),
			payload.CEP,
			payload.Street,
			payload.Number,
			payload.Neighborhood,
			defaultString(payload.City, "Campo Grande"),
			defaultString(payload.State, "MS"),
			payload.IsDefault,
			payload.AddressID,
			customerID,
		)
	} else {
		var hasDefault bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM addresses WHERE customer_id = $1 AND is_default = true)`, customerID).Scan(&hasDefault); err != nil {
			return nil, err
		}
		isDefault := payload.IsDefault || !hasDefault
		_, err = tx.Exec(ctx, `
			INSERT INTO addresses (customer_id, label, cep, street, number, neighborhood, city, state, is_default)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			customerID,
			defaultString(payload.AddressLabel, "Principal"),
			payload.CEP,
			payload.Street,
			payload.Number,
			payload.Neighborhood,
			defaultString(payload.City, "Campo Grande"),
			defaultString(payload.State, "MS"),
			isDefault,
		)
	}
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return s.CustomerProfile(ctx, customerID, customerID)
}

func (s *Service) SetDefaultCustomerAddress(ctx context.Context, customerID, addressID string) (map[string]interface{}, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM addresses WHERE id = $1 AND customer_id = $2)`, addressID, customerID).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, errors.New("endereco nao encontrado")
	}

	if _, err := tx.Exec(ctx, `UPDATE addresses SET is_default = false WHERE customer_id = $1`, customerID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE addresses SET is_default = true WHERE id = $1 AND customer_id = $2`, addressID, customerID); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return s.CustomerProfile(ctx, customerID, customerID)
}

func (s *Service) CreateOrder(ctx context.Context, input CheckoutInput) (map[string]interface{}, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	customerID, err := s.ensureCustomer(ctx, tx, input.CustomerID, input.CustomerName, input.CustomerEmail, input.CustomerPhone, input.CustomerCPF, input.Password)
	if err != nil {
		return nil, err
	}

	addressID, err := s.ensureAddress(ctx, tx, customerID, input.CEP, input.Street, input.Number, input.Neighborhood, input.City, input.State)
	if err != nil {
		return nil, err
	}

	type itemSummary struct {
		OrganizerItemID string
		Name            string
		ImageURL        string
		UnitPrice       float64
		Quantity        int
		LineTotal       float64
		Weight          int
	}

	subtotal := 0.0
	weight := 0
	orderItems := make([]itemSummary, 0, len(input.Items))
	for _, item := range input.Items {
		// Toda a loja vem do Organizador: preco, estoque e disponibilidade sao
		// conferidos la, nunca no que o navegador mandou.
		summary, err := s.resolveOrganizerCheckoutItem(ctx, item.ProductID, item.Quantity)
		if err != nil {
			return nil, err
		}
		lineTotal := summary.UnitPrice * float64(item.Quantity)
		subtotal += lineTotal
		weight += summary.Weight * item.Quantity
		orderItems = append(orderItems, itemSummary{
			OrganizerItemID: summary.ID,
			Name:            summary.Name,
			ImageURL:        summary.ImageURL,
			UnitPrice:       summary.UnitPrice,
			Quantity:        item.Quantity,
			LineTotal:       lineTotal,
			Weight:          summary.Weight,
		})
	}

	discount := 0.0
	if input.CouponCode != "" {
		var couponType string
		var value float64
		err := tx.QueryRow(ctx, `SELECT discount_type, value FROM coupons WHERE code = $1 AND is_active = true`, strings.ToUpper(input.CouponCode)).Scan(&couponType, &value)
		if err == nil {
			if couponType == "percent" {
				discount = subtotal * (value / 100)
			} else {
				discount = value
			}
		}
	}

	var shippingAmount float64
	if input.DeliveryMode == "correios" && input.CorreiosPrice > 0 {
		shippingAmount = input.CorreiosPrice
	} else {
		shippingQuote, err := s.QuoteShipping(ctx, shipping.QuoteInput{
			CEP:          input.CEP,
			WeightGrams:  weight,
			Subtotal:     subtotal - discount,
			DeliveryMode: input.DeliveryMode,
			City:         input.City,
		})
		if err != nil {
			return nil, err
		}
		shippingAmount = shippingQuote.Amount
	}

	total := subtotal - discount + shippingAmount
	if input.PaymentMethodID == "" {
		return nil, errors.New("selecione uma forma de pagamento")
	}
	paymentResult, err := s.resolvePaymentsProvider(ctx).CreatePayment(payments.DirectPaymentInput{
		Total:           total,
		Description:     fmt.Sprintf("Pedido (%d itens)", len(orderItems)),
		PaymentMethodID: input.PaymentMethodID,
		Token:           input.Token,
		IssuerID:        input.IssuerID,
		Installments:    input.Installments,
		PayerEmail:      input.CustomerEmail,
		PayerCPF:        input.CustomerCPF,
		NotificationURL: input.PublicBaseURL,
	})
	if err != nil {
		return nil, err
	}

	mpPaymentID := paymentResult.ProviderRef
	orderStatus := mapPaymentToOrderStatus(paymentResult.Status)
	origin := "online"

	var orderID string
	err = tx.QueryRow(ctx, `
		INSERT INTO orders (customer_id, address_id, subtotal, shipping_amount, discount_amount, total_amount, payment_method, payment_status, order_status, origin, mp_preference_id, delivery_mode)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id::text`,
		customerID, addressID, subtotal, shippingAmount, discount, total, input.PaymentMethodID, paymentResult.Status, orderStatus, origin, mpPaymentID, input.DeliveryMode,
	).Scan(&orderID)
	if err != nil {
		return nil, err
	}

	for _, item := range orderItems {
		if _, err := tx.Exec(ctx, `INSERT INTO order_items (order_id, organizer_item_id, product_name, product_image_url, unit_price, quantity, line_total) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			orderID, item.OrganizerItemID, item.Name, item.ImageURL, item.UnitPrice, item.Quantity, item.LineTotal); err != nil {
			return nil, err
		}
	}

	if _, err := tx.Exec(ctx, `INSERT INTO payments (order_id, provider, provider_reference, amount, status) VALUES ($1, 'mercadopago', $2, $3, $4)`,
		orderID, mpPaymentID, total, paymentResult.Status); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	if orderStatus == "pago" {
		s.updateStockForOrder(ctx, orderID)
	}

	return map[string]interface{}{
		"orderId": orderID, "paymentStatus": paymentResult.Status, "orderStatus": orderStatus,
		"shippingAmount": shippingAmount, "discount": discount, "total": total,
		"statusDetail": paymentResult.StatusDetail,
		"qrCode":       paymentResult.QRCode,
		"qrCodeBase64": paymentResult.QRCodeBase64,
	}, nil
}

// Customers lista clientes para as telas de administracao. O admin fixo
// (is_fixed_admin) nunca aparece para ninguem alem dele mesmo - requesterID
// e o id de quem esta chamando, extraido do token.
func (s *Service) Customers(ctx context.Context, search, requesterID string) ([]map[string]interface{}, error) {
	var rows pgx.Rows
	var err error
	if search != "" {
		like := "%" + search + "%"
		cpfDigits := digitsOnly(search)
		rows, err = s.db.Query(ctx, `
			SELECT id::text, name, email, phone, COALESCE(cpf, ''), created_at, is_admin, is_fixed_admin
			FROM customers
			WHERE (name ILIKE $1
			   OR email ILIKE $1
			   OR ($2 <> '' AND regexp_replace(COALESCE(cpf, ''), '[^0-9]', '', 'g') ILIKE '%' || $2 || '%'))
			   AND (NOT is_fixed_admin OR id::text = $3)
			ORDER BY name
			LIMIT 30`, like, cpfDigits, requesterID)
	} else {
		rows, err = s.db.Query(ctx, `
			SELECT id::text, name, email, phone, COALESCE(cpf, ''), created_at, is_admin, is_fixed_admin
			FROM customers
			WHERE NOT is_fixed_admin OR id::text = $1
			ORDER BY created_at DESC`, requesterID)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	customers := []map[string]interface{}{}
	for rows.Next() {
		var id, name, email, phone, cpf string
		var createdAt time.Time
		var isAdmin, isFixedAdmin bool
		if err := rows.Scan(&id, &name, &email, &phone, &cpf, &createdAt, &isAdmin, &isFixedAdmin); err != nil {
			return nil, err
		}
		customers = append(customers, map[string]interface{}{"id": id, "name": name, "email": email, "phone": phone, "cpf": cpf, "createdAt": createdAt, "isAdmin": isAdmin, "isFixedAdmin": isFixedAdmin})
	}
	return customers, rows.Err()
}

// CountAdmins existe para o bootstrap do primeiro administrador: enquanto
// nao houver nenhum, SetCustomerAdmin aceita a chamada sem token.
func (s *Service) CountAdmins(ctx context.Context) (int, error) {
	var count int
	err := s.db.QueryRow(ctx, `SELECT COUNT(*) FROM customers WHERE is_admin = true`).Scan(&count)
	return count, err
}

// SetCustomerAdmin concede ou revoga o cargo de administrador de um cliente
// ja cadastrado. O handler decide quem pode chamar: com pelo menos um admin
// ja existente, so outro admin autenticado consegue; antes disso (loja
// recem-instalada), a propria rota libera a primeira vez sem token.
func (s *Service) SetCustomerAdmin(ctx context.Context, customerID string, isAdmin bool) (map[string]interface{}, error) {
	if !isAdmin {
		var isFixedAdmin bool
		if err := s.db.QueryRow(ctx, `SELECT is_fixed_admin FROM customers WHERE id = $1`, customerID).Scan(&isFixedAdmin); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, errors.New("cliente nao encontrado")
			}
			return nil, err
		}
		if isFixedAdmin {
			return nil, errors.New("este administrador e fixo e nao pode ter o acesso removido")
		}
	}

	var id, name string
	err := s.db.QueryRow(ctx, `UPDATE customers SET is_admin = $1 WHERE id = $2 RETURNING id::text, name`, isAdmin, customerID).Scan(&id, &name)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("cliente nao encontrado")
		}
		return nil, err
	}
	return map[string]interface{}{"id": id, "name": name, "isAdmin": isAdmin}, nil
}

func (s *Service) ensureCustomer(ctx context.Context, tx pgx.Tx, customerID, name, email, phone, cpf, password string) (string, error) {
	if customerID != "" {
		var id string
		err := tx.QueryRow(ctx, `SELECT id::text FROM customers WHERE id = $1`, customerID).Scan(&id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return "", errors.New("cliente autenticado nao encontrado")
			}
			return "", err
		}
		// E-mail e CPF sao unicos no banco: avisa qual campo colidiu em vez de
		// deixar vazar o erro cru do Postgres para a tela de pagamento. O
		// telefone so e checado na ficha de cadastro, para nao travar o pedido
		// de quem compartilha o numero de contato.
		conflicts, conflictErr := s.CustomerFieldConflicts(ctx, email, cpf, "", id)
		if conflictErr != nil {
			return "", conflictErr
		}
		if len(conflicts) > 0 {
			return "", &FieldConflictError{Field: conflicts[0]["field"], Message: conflicts[0]["message"]}
		}
		_, updateErr := tx.Exec(ctx, `UPDATE customers SET name = $1, email = $2, phone = $3, cpf = $4 WHERE id = $5`, name, email, phone, cpf, id)
		return id, updateErr
	}

	var id string
	err := tx.QueryRow(ctx, `SELECT id::text FROM customers WHERE email = $1`, email).Scan(&id)
	if err == nil {
		_, updateErr := tx.Exec(ctx, `UPDATE customers SET name = $1, phone = $2, cpf = $3 WHERE id = $4`, name, phone, cpf, id)
		return id, updateErr
	}
	if err != pgx.ErrNoRows {
		return "", err
	}
	if password == "" {
		return "", errors.New("senha obrigatoria para novo cadastro")
	}

	hash, hashErr := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if hashErr != nil {
		return "", hashErr
	}
	err = tx.QueryRow(ctx, `INSERT INTO customers (name, email, phone, cpf, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id::text`,
		name, email, phone, cpf, string(hash)).Scan(&id)
	return id, err
}

func (s *Service) ensureAddress(ctx context.Context, tx pgx.Tx, customerID, cep, street, number, neighborhood, city, state string) (string, error) {
	if city == "" {
		city = "Campo Grande"
	}
	if state == "" {
		state = "MS"
	}
	var existingID string
	err := tx.QueryRow(ctx, `
		SELECT id::text
		FROM addresses
		WHERE customer_id = $1
		  AND cep = $2
		  AND street = $3
		  AND number = $4
		  AND neighborhood = $5
		  AND city = $6
		  AND state = $7
		ORDER BY is_default DESC, created_at DESC
		LIMIT 1`,
		customerID, cep, street, number, neighborhood, city, state,
	).Scan(&existingID)
	if err == nil {
		return existingID, nil
	}
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}

	var hasDefault bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM addresses WHERE customer_id = $1 AND is_default = true)`, customerID).Scan(&hasDefault); err != nil {
		return "", err
	}

	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO addresses (customer_id, label, cep, street, number, neighborhood, city, state, is_default)
		VALUES ($1, 'Principal', $2, $3, $4, $5, $6, $7, $8)
		RETURNING id::text`, customerID, cep, street, number, neighborhood, city, state, !hasDefault).Scan(&id)
	return id, err
}

func mapPaymentToOrderStatus(paymentStatus string) string {
	if paymentStatus == "paid" || paymentStatus == "approved" {
		return "pago"
	}
	return "aguardando_pagamento"
}

// VerifyMPWebhookSignature confere o cabecalho x-signature que o Mercado Pago
// manda junto com a notificacao. So vale quando a chave secreta do webhook
// esta salva na gaveta "API" do admin: sem ela (ou quando a notificacao vem
// pelo formato antigo, que nao assina nada) a conferencia e pulada, senao a
// loja pararia de registrar pagamento so por falta de configuracao. Mesmo
// pulando, nada e aceito de palavra: o pagamento sempre e relido na API do
// Mercado Pago antes de o pedido mudar de status.
func (s *Service) VerifyMPWebhookSignature(ctx context.Context, signature, requestID, dataID string) error {
	secret, err := s.GetSetting(ctx, "mp_webhook_secret")
	if err != nil || secret == "" || signature == "" {
		return nil
	}
	if !mpSignatureMatches(secret, signature, requestID, dataID) {
		return errors.New("assinatura do webhook invalida")
	}
	return nil
}

// mpSignatureMatches refaz a conta que o Mercado Pago fez para assinar a
// notificacao. O cabecalho chega como "ts=1704908010,v1=<hash>" e o hash e um
// HMAC-SHA256 do texto "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" com a
// chave secreta do webhook - cada pedaco que nao veio na notificacao sai fora
// do texto junto com o seu ponto e virgula.
func mpSignatureMatches(secret, signature, requestID, dataID string) bool {
	var timestamp, hash string
	for _, part := range strings.Split(signature, ",") {
		key, value, found := strings.Cut(strings.TrimSpace(part), "=")
		if !found {
			continue
		}
		switch strings.TrimSpace(key) {
		case "ts":
			timestamp = strings.TrimSpace(value)
		case "v1":
			hash = strings.TrimSpace(value)
		}
	}
	if timestamp == "" || hash == "" {
		return false
	}

	manifest := fmt.Sprintf("id:%s;", strings.ToLower(dataID))
	if requestID != "" {
		manifest += fmt.Sprintf("request-id:%s;", requestID)
	}
	manifest += fmt.Sprintf("ts:%s;", timestamp)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(manifest))
	return hmac.Equal([]byte(hex.EncodeToString(mac.Sum(nil))), []byte(hash))
}

func (s *Service) HandleMPWebhook(ctx context.Context, topic string, paymentID string) error {
	if topic != "payment" {
		return nil
	}

	mpAccessToken, err := s.GetSetting(ctx, "mp_access_token")
	if err != nil || mpAccessToken == "" {
		return fmt.Errorf("mercado pago nao configurado")
	}

	req, _ := http.NewRequest("GET", "https://api.mercadopago.com/v1/payments/"+paymentID, nil)
	req.Header.Set("Authorization", "Bearer "+mpAccessToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	// Pagamento que nao existe (ou e de outra conta) nao e falha nossa: devolve
	// 200 para o Mercado Pago parar de reenviar. Nos outros erros devolvemos
	// falha de proposito, justamente para ele tentar de novo mais tarde.
	if resp.StatusCode == http.StatusNotFound {
		return nil
	}
	if resp.StatusCode >= 400 {
		return fmt.Errorf("mercado pago respondeu %d ao consultar o pagamento %s", resp.StatusCode, paymentID)
	}

	var payment struct {
		ID     int64  `json:"id"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(respBody, &payment); err != nil {
		return err
	}

	if payment.Status != "approved" {
		return nil
	}

	var orderID string
	// A condicao olha o order_status, nao o payment_status: todo pedido que
	// ainda nao esta "pago" entra, inclusive o cartao que nasceu "in_process"
	// (analise do emissor) e so foi aprovado depois - conferir apenas
	// payment_status = 'pending' deixava esse caso preso em "aguardando
	// pagamento" mesmo com o dinheiro aprovado. E como "pago" e justamente o
	// status que ja baixou estoque na criacao do pedido, deixa-lo de fora e o
	// que impede uma segunda notificacao do mesmo pagamento baixar o estoque
	// de novo.
	err = s.db.QueryRow(ctx, `
		UPDATE orders
		SET payment_status = 'paid', order_status = 'pago', mp_payment_id = $1
		WHERE order_status <> 'pago' AND mp_preference_id = $1
		RETURNING id::text`,
		paymentID).Scan(&orderID)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}

	s.db.Exec(ctx, `UPDATE payments SET status = 'approved' WHERE provider_reference = $1`, paymentID)
	s.updateStockForOrder(ctx, orderID)
	return nil
}

func (s *Service) updateStockForOrder(ctx context.Context, orderID string) {
	rows, err := s.db.Query(ctx, `SELECT organizer_item_id, quantity FROM order_items WHERE order_id = $1`, orderID)
	if err != nil {
		return
	}

	organizerDecrements := map[string]int{}
	for rows.Next() {
		var organizerItemID *string
		var quantity int
		if err := rows.Scan(&organizerItemID, &quantity); err != nil {
			continue
		}
		if organizerItemID != nil {
			organizerDecrements[*organizerItemID] += quantity
		}
	}
	rows.Close()

	s.decrementOrganizerStock(ctx, organizerDecrements)
}

// apiSettingKeys sao as chaves editaveis pela gaveta "API" do admin (restrita
// ao administrador fixo - ver IsFixedAdmin).
var apiSettingKeys = []string{"mp_access_token", "mp_public_key", "mp_webhook_secret", "google_client_id"}

func (s *Service) GetAPISettings(ctx context.Context) (map[string]string, error) {
	rows, err := s.db.Query(ctx, `SELECT key, value FROM settings WHERE key = ANY($1)`, apiSettingKeys)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	settings := map[string]string{}
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		settings[key] = value
	}
	for _, key := range apiSettingKeys {
		if _, ok := settings[key]; !ok {
			settings[key] = ""
		}
	}
	return settings, nil
}

func (s *Service) SaveSetting(ctx context.Context, key, value string) error {
	_, err := s.db.Exec(ctx, `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`, key, value)
	return err
}

func (s *Service) GetSetting(ctx context.Context, key string) (string, error) {
	var value string
	err := s.db.QueryRow(ctx, `SELECT value FROM settings WHERE key = $1`, key).Scan(&value)
	return value, err
}

// IsFixedAdmin diz se o cliente e o administrador fixo da loja - a unica
// conta autorizada a ver e editar a gaveta "API" (tokens e chaves sensiveis).
func (s *Service) IsFixedAdmin(ctx context.Context, customerID string) (bool, error) {
	var isFixedAdmin bool
	err := s.db.QueryRow(ctx, `SELECT is_fixed_admin FROM customers WHERE id = $1`, customerID).Scan(&isFixedAdmin)
	return isFixedAdmin, err
}

// resolveGoogleClientID prioriza o valor salvo no admin; sem ele, cai para a
// variavel de ambiente GOOGLE_CLIENT_ID (usada no dev local via .vscode/.env).
func (s *Service) resolveGoogleClientID(ctx context.Context) string {
	value, _ := s.GetSetting(ctx, "google_client_id")
	if value != "" {
		return value
	}
	return s.cfg.GoogleClientID
}

func findShippingRule(rules []shippingRule, ruleType string) (shipping.QuoteOutput, error) {
	for _, current := range rules {
		if current.RuleType == ruleType || current.Code == ruleType {
			return shipping.QuoteOutput{Amount: current.Amount, Label: current.Name}, nil
		}
	}
	return shipping.QuoteOutput{}, fmt.Errorf("regra de frete %s nao encontrada", ruleType)
}

type OrderFilter struct {
	Search    string `json:"search"`
	Status    string `json:"status"`
	Payment   string `json:"payment"`
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
	Page      int    `json:"page"`
	Limit     int    `json:"limit"`
}

func (s *Service) Orders(ctx context.Context, filter OrderFilter) (map[string]interface{}, error) {
	if filter.Limit <= 0 {
		filter.Limit = 50
	}
	if filter.Page <= 0 {
		filter.Page = 1
	}
	offset := (filter.Page - 1) * filter.Limit

	where := []string{}
	args := []interface{}{}
	argIndex := 1

	if filter.Search != "" {
		where = append(where, fmt.Sprintf("(customer_name ILIKE $%d OR id::text ILIKE $%d)", argIndex, argIndex+1))
		likePattern := "%" + filter.Search + "%"
		args = append(args, likePattern, likePattern)
		argIndex += 2
	}
	if filter.Status != "" {
		where = append(where, fmt.Sprintf("order_status = $%d", argIndex))
		args = append(args, filter.Status)
		argIndex++
	}
	if filter.Payment != "" {
		where = append(where, fmt.Sprintf("payment_status = $%d", argIndex))
		args = append(args, filter.Payment)
		argIndex++
	}
	if filter.StartDate != "" {
		where = append(where, fmt.Sprintf("created_at::date >= $%d::date", argIndex))
		args = append(args, filter.StartDate)
		argIndex++
	}
	if filter.EndDate != "" {
		where = append(where, fmt.Sprintf("created_at::date <= $%d::date", argIndex))
		args = append(args, filter.EndDate)
		argIndex++
	}

	whereClause := ""
	if len(where) > 0 {
		whereClause = "WHERE " + strings.Join(where, " AND ")
	}

	countSQL := `SELECT COUNT(*) FROM (
		SELECT o.id, c.name as customer_name, o.total_amount, o.payment_status, o.order_status, o.created_at, COALESCE(o.origin, 'online') as origin
		FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
		UNION ALL
		SELECT ps.id, ps.customer_name, ps.total_amount, 'paid', 'pago', ps.created_at, 'pdv'
		FROM pos_sales ps
	) combined ` + whereClause
	var total int
	if err := s.db.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, err
	}

	query := fmt.Sprintf(`
		SELECT id::text, customer_name, total_amount, payment_status, order_status, created_at, origin
		FROM (
			SELECT o.id, c.name as customer_name, o.total_amount, o.payment_status, o.order_status, o.created_at, COALESCE(o.origin, 'online') as origin
			FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
			UNION ALL
			SELECT ps.id, ps.customer_name, ps.total_amount, 'paid', 'pago', ps.created_at, 'pdv'
			FROM pos_sales ps
		) combined
		%s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d`, whereClause, argIndex, argIndex+1)

	queryArgs := append(args, filter.Limit, offset)
	rows, err := s.db.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	orders := []map[string]interface{}{}
	for rows.Next() {
		var id, name, paymentStatus, orderStatus, origin string
		var totalAmount float64
		var createdAt time.Time
		if err := rows.Scan(&id, &name, &totalAmount, &paymentStatus, &orderStatus, &createdAt, &origin); err != nil {
			return nil, err
		}
		orders = append(orders, map[string]interface{}{
			"id": id, "customerName": name, "total": totalAmount, "paymentStatus": paymentStatus, "orderStatus": orderStatus, "createdAt": createdAt, "origin": origin,
		})
	}

	return map[string]interface{}{"orders": orders, "total": total, "page": filter.Page, "limit": filter.Limit}, rows.Err()
}

// AdminOrderNotifications lista os pedidos online mais recentes para a
// gaveta de notificacoes do admin. Vendas de balcao (pos_sales) nao entram:
// quem fez a venda ja sabe dela, nao precisa ser notificado.
func (s *Service) AdminOrderNotifications(ctx context.Context, limit int) ([]map[string]interface{}, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	// So pedidos ja pagos viram notificacao - antes disso o pedido so fica
	// salvo no historico (tabela orders), sem alertar o atendente pra
	// contatar um cliente que ainda nem concluiu o pagamento.
	rows, err := s.db.Query(ctx, `
		SELECT o.id::text, COALESCE(c.name, 'Consumidor Final'), COALESCE(c.phone, ''), o.total_amount,
			o.payment_status, o.order_status, COALESCE(o.delivery_mode, ''), o.created_at, (o.admin_read_at IS NOT NULL)
		FROM orders o
		LEFT JOIN customers c ON c.id = o.customer_id
		WHERE o.order_status = 'pago'
		ORDER BY o.created_at DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	notifications := []map[string]interface{}{}
	for rows.Next() {
		var id, name, phone, paymentStatus, orderStatus, deliveryMode string
		var total float64
		var createdAt time.Time
		var read bool
		if err := rows.Scan(&id, &name, &phone, &total, &paymentStatus, &orderStatus, &deliveryMode, &createdAt, &read); err != nil {
			return nil, err
		}
		notifications = append(notifications, map[string]interface{}{
			"id": id, "customerName": name, "customerPhone": phone, "total": total,
			"paymentStatus": paymentStatus, "orderStatus": orderStatus, "deliveryMode": deliveryMode,
			"createdAt": createdAt, "read": read,
		})
	}
	return notifications, rows.Err()
}

func (s *Service) AdminUnreadOrderCount(ctx context.Context) (int, error) {
	var count int
	err := s.db.QueryRow(ctx, `SELECT COUNT(*) FROM orders WHERE admin_read_at IS NULL AND order_status = 'pago'`).Scan(&count)
	return count, err
}

// AdminOrderNotificationDetail devolve nome, telefone e endereco do cliente
// para o atendente confirmar o pedido no WhatsApp sem precisar abrir a tela
// de Clientes.
func (s *Service) AdminOrderNotificationDetail(ctx context.Context, orderID string) (map[string]interface{}, error) {
	var order struct {
		ID            string
		CustomerName  string
		CustomerPhone string
		Total         float64
		PaymentStatus string
		OrderStatus   string
		DeliveryMode  string
		CreatedAt     time.Time
		Street        string
		Number        string
		Neighborhood  string
		City          string
		State         string
		CEP           string
	}
	err := s.db.QueryRow(ctx, `
		SELECT o.id::text, COALESCE(c.name, 'Consumidor Final'), COALESCE(c.phone, ''), o.total_amount,
			o.payment_status, o.order_status, COALESCE(o.delivery_mode, ''), o.created_at,
			COALESCE(a.street, ''), COALESCE(a.number, ''), COALESCE(a.neighborhood, ''),
			COALESCE(a.city, ''), COALESCE(a.state, ''), COALESCE(a.cep, '')
		FROM orders o
		LEFT JOIN customers c ON c.id = o.customer_id
		LEFT JOIN addresses a ON a.id = o.address_id
		WHERE o.id = $1`, orderID,
	).Scan(&order.ID, &order.CustomerName, &order.CustomerPhone, &order.Total, &order.PaymentStatus, &order.OrderStatus,
		&order.DeliveryMode, &order.CreatedAt, &order.Street, &order.Number, &order.Neighborhood, &order.City, &order.State, &order.CEP)
	if err != nil {
		return nil, err
	}

	itemsRows, err := s.db.Query(ctx, `SELECT product_name, unit_price, quantity, COALESCE(product_image_url, '') FROM order_items WHERE order_id = $1`, orderID)
	if err != nil {
		return nil, err
	}
	defer itemsRows.Close()
	items := []map[string]interface{}{}
	for itemsRows.Next() {
		var name, imageURL string
		var price float64
		var qty int
		if err := itemsRows.Scan(&name, &price, &qty, &imageURL); err != nil {
			continue
		}
		items = append(items, map[string]interface{}{"name": name, "price": price, "quantity": qty, "imageUrl": imageURL})
	}

	return map[string]interface{}{
		"id": order.ID, "customerName": order.CustomerName, "customerPhone": order.CustomerPhone,
		"total": order.Total, "paymentStatus": order.PaymentStatus, "orderStatus": order.OrderStatus,
		"deliveryMode": order.DeliveryMode, "createdAt": order.CreatedAt, "items": items,
		"address": map[string]interface{}{
			"street": order.Street, "number": order.Number, "neighborhood": order.Neighborhood,
			"city": order.City, "state": order.State, "cep": order.CEP,
		},
	}, nil
}

// MarkOrderNotificationRead marca o pedido como lido na gaveta do admin e
// devolve o contador de nao lidos atualizado.
func (s *Service) MarkOrderNotificationRead(ctx context.Context, orderID string) (int, error) {
	if _, err := s.db.Exec(ctx, `UPDATE orders SET admin_read_at = now() WHERE id = $1 AND admin_read_at IS NULL`, orderID); err != nil {
		return 0, err
	}
	return s.AdminUnreadOrderCount(ctx)
}


func (s *Service) UpdateOrderStatus(ctx context.Context, orderID, newStatus string) error {
	validStatuses := map[string]string{
		"pago":     "aguardando_pagamento",
		"enviado":  "pago",
		"entregue": "enviado",
	}
	requiredPrev, ok := validStatuses[newStatus]
	if !ok {
		return fmt.Errorf("status invalido: %s", newStatus)
	}

	result, err := s.db.Exec(ctx, `UPDATE orders SET order_status = $2 WHERE id = $1 AND order_status = $3 AND payment_status = 'paid'`, orderID, newStatus, requiredPrev)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("transicao de status nao permitida")
	}
	return nil
}

func (s *Service) ListCoupons(ctx context.Context) ([]map[string]interface{}, error) {
	rows, err := s.db.Query(ctx, `SELECT id::text, code, discount_type, value, is_active FROM coupons ORDER BY code`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	coupons := []map[string]interface{}{}
	for rows.Next() {
		var id, code, discountType string
		var value float64
		var isActive bool
		if err := rows.Scan(&id, &code, &discountType, &value, &isActive); err != nil {
			return nil, err
		}
		coupons = append(coupons, map[string]interface{}{"id": id, "code": code, "discountType": discountType, "value": value, "isActive": isActive})
	}
	return coupons, rows.Err()
}

func (s *Service) SaveCoupon(ctx context.Context, id, code, discountType string, value float64, isActive bool) (map[string]interface{}, error) {
	if code == "" || discountType == "" {
		return nil, errors.New("codigo e tipo obrigatorios")
	}
	code = strings.ToUpper(code)
	if id == "" {
		if err := s.db.QueryRow(ctx, `INSERT INTO coupons (code, discount_type, value, is_active) VALUES ($1, $2, $3, $4) RETURNING id::text`, code, discountType, value, isActive).Scan(&id); err != nil {
			return nil, err
		}
	} else {
		if _, err := s.db.Exec(ctx, `UPDATE coupons SET code = $2, discount_type = $3, value = $4, is_active = $5 WHERE id = $1`, id, code, discountType, value, isActive); err != nil {
			return nil, err
		}
	}
	return map[string]interface{}{"id": id, "code": code, "discountType": discountType, "value": value, "isActive": isActive}, nil
}

func (s *Service) DeleteCoupon(ctx context.Context, id string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM coupons WHERE id = $1`, id)
	return err
}


func (s *Service) ExportOrdersCSV(ctx context.Context) ([]byte, error) {
	rows, err := s.db.Query(ctx, `SELECT o.id::text, COALESCE(c.name, 'Consumidor Final'), o.total_amount, o.payment_status, o.order_status, o.origin, o.created_at FROM orders o LEFT JOIN customers c ON c.id = o.customer_id ORDER BY o.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var buf bytes.Buffer
	buf.WriteString("ID,Cliente,Total,Status Pagamento,Status Pedido,Origem,Data\n")
	for rows.Next() {
		var id, name, paymentStatus, orderStatus, origin string
		var total float64
		var createdAt time.Time
		if err := rows.Scan(&id, &name, &total, &paymentStatus, &orderStatus, &origin, &createdAt); err != nil {
			continue
		}
		buf.WriteString(fmt.Sprintf("%s,%s,%.2f,%s,%s,%s,%s\n", id[:8], strings.ReplaceAll(name, ",", " "), total, paymentStatus, orderStatus, origin, createdAt.Format("2006-01-02 15:04")))
	}
	return buf.Bytes(), nil
}

func (s *Service) GetOrderPublic(ctx context.Context, orderID string) (map[string]interface{}, error) {
	var order struct {
		ID            string
		CustomerName  string
		Total         float64
		PaymentStatus string
		OrderStatus   string
		Origin        string
		CreatedAt     time.Time
		Shipping      float64
		Discount      float64
	}
	err := s.db.QueryRow(ctx, `SELECT o.id::text, COALESCE(c.name, 'Consumidor Final'), o.total_amount, o.payment_status, o.order_status, COALESCE(o.origin, 'online'), o.created_at, o.shipping_amount, o.discount_amount FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.id = $1`, orderID).Scan(&order.ID, &order.CustomerName, &order.Total, &order.PaymentStatus, &order.OrderStatus, &order.Origin, &order.CreatedAt, &order.Shipping, &order.Discount)
	if err != nil {
		return nil, err
	}

	itemsRows, err := s.db.Query(ctx, `SELECT product_name, unit_price, quantity, COALESCE(product_image_url, '') FROM order_items WHERE order_id = $1`, orderID)
	if err != nil {
		return nil, err
	}
	defer itemsRows.Close()
	items := []map[string]interface{}{}
	for itemsRows.Next() {
		var name, imageURL string
		var price float64
		var qty int
		if err := itemsRows.Scan(&name, &price, &qty, &imageURL); err != nil {
			continue
		}
		items = append(items, map[string]interface{}{"name": name, "price": price, "quantity": qty, "imageUrl": imageURL})
	}

	statuses := []map[string]interface{}{
		{"label": "Pedido confirmado", "done": true},
		{"label": "Pagamento aprovado", "done": order.OrderStatus != "aguardando_pagamento"},
		{"label": "Enviado", "done": order.OrderStatus == "enviado" || order.OrderStatus == "entregue"},
		{"label": "Entregue", "done": order.OrderStatus == "entregue"},
	}

	return map[string]interface{}{
		"id": order.ID, "customerName": order.CustomerName, "total": order.Total, "paymentStatus": order.PaymentStatus, "orderStatus": order.OrderStatus, "origin": order.Origin, "createdAt": order.CreatedAt, "shipping": order.Shipping, "discount": order.Discount, "items": items, "statuses": statuses,
	}, nil
}

func scanShippingRules(rows pgx.Rows) ([]shippingRule, error) {
	rules := []shippingRule{}
	for rows.Next() {
		var current shippingRule
		if err := rows.Scan(&current.Code, &current.Name, &current.RuleType, &current.Amount, &current.MinOrder, &current.WeightMin, &current.WeightMax, &current.RegionPrefix); err != nil {
			return nil, err
		}
		rules = append(rules, current)
	}
	return rules, rows.Err()
}

func normalizeShippingRules(rules []shippingRule) []shippingRule {
	canonical := map[string]string{
		"fixed":     "fixed",
		"pickup":    "pickup",
		"local":     "local",
		"manual":    "manual",
		"free_over": "free_over",
	}

	selected := map[string]shippingRule{}
	weightRules := []shippingRule{}
	for _, rule := range rules {
		if rule.RuleType == "weight" {
			weightRules = append(weightRules, rule)
			continue
		}

		current, exists := selected[rule.RuleType]
		preferredCode := canonical[rule.RuleType]
		if !exists || rule.Code == preferredCode || (current.Code != preferredCode && strings.Contains(rule.Code, preferredCode)) {
			selected[rule.RuleType] = rule
		}
	}

	normalized := make([]shippingRule, 0, len(selected)+len(weightRules))
	for _, key := range []string{"fixed", "free_over", "pickup", "local", "manual"} {
		if rule, exists := selected[key]; exists {
			normalized = append(normalized, rule)
		}
	}
	normalized = append(normalized, weightRules...)
	return normalized
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}
