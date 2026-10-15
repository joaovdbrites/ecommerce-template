package payments

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

// PaymentResult e o retorno padronizado de qualquer provedor de pagamento:
// os campos de QR Code so vem preenchidos para Pix.
type PaymentResult struct {
	ProviderRef  string `json:"providerRef"`
	Status       string `json:"status"`
	StatusDetail string `json:"statusDetail,omitempty"`
	QRCode       string `json:"qrCode,omitempty"`
	QRCodeBase64 string `json:"qrCodeBase64,omitempty"`
}

// DirectPaymentInput reune os dados necessarios para cobrar um pagamento
// direto (cartao tokenizado ou Pix), vindos do checkout transparente.
type DirectPaymentInput struct {
	Total           float64
	Description     string
	PaymentMethodID string
	Token           string
	IssuerID        string
	Installments    int
	PayerEmail      string
	PayerCPF        string
	// Endereco publico da loja no momento do pedido. Em branco, cai na
	// configuracao FRONTEND_URL do servidor.
	NotificationURL string
}

// Provider abstrai o provedor de pagamento real (Mercado Pago) do mock usado
// em desenvolvimento/testes, para o resto do backend nao depender de qual
// esta em uso.
type Provider interface {
	CreatePayment(input DirectPaymentInput) (PaymentResult, error)
}

// MercadoPagoProvider implementa Provider chamando a API de pagamentos do
// Mercado Pago diretamente (Checkout Transparente).
type MercadoPagoProvider struct {
	AccessToken string
	FrontendURL string
}

// NewMercadoPagoProvider cria o provider com as credenciais e o dominio
// padrao de notificacao configurados para a loja.
func NewMercadoPagoProvider(accessToken, frontendURL string) *MercadoPagoProvider {
	return &MercadoPagoProvider{
		AccessToken: accessToken,
		FrontendURL: frontendURL,
	}
}

// CreatePayment processes the payment directly (Checkout Transparente / Payment Brick),
// without redirecting the customer to a Mercado Pago hosted page.
func (mp *MercadoPagoProvider) CreatePayment(input DirectPaymentInput) (PaymentResult, error) {
	// CPF e opcional no payload do Mercado Pago, mas quando informado reduz
	// risco de a transacao ser marcada como suspeita/recusada.
	payer := map[string]interface{}{
		"email": input.PayerEmail,
	}
	if input.PayerCPF != "" {
		payer["identification"] = map[string]string{"type": "CPF", "number": input.PayerCPF}
	}

	// O aviso de pagamento aprovado volta para o dominio que o cliente estava
	// usando; FRONTEND_URL so entra quando nao da para saber (ex.: chamada sem
	// https, em desenvolvimento).
	baseURL := input.NotificationURL
	if baseURL == "" {
		baseURL = mp.FrontendURL
	}

	payload := map[string]interface{}{
		"transaction_amount": input.Total,
		"description":        input.Description,
		"payment_method_id":  input.PaymentMethodID,
		"payer":              payer,
		"notification_url":   strings.TrimRight(baseURL, "/") + "/api/webhooks/mercadopago",
	}

	// Pix nao usa token de cartao/parcelas - so cartao (credito/debito) manda
	// esses campos.
	if input.PaymentMethodID != "pix" {
		payload["token"] = input.Token
		payload["installments"] = input.Installments
		if input.IssuerID != "" {
			payload["issuer_id"] = input.IssuerID
		}
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", "https://api.mercadopago.com/v1/payments", bytes.NewReader(body))
	if err != nil {
		return PaymentResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+mp.AccessToken)
	req.Header.Set("Content-Type", "application/json")
	// Chave de idempotencia nova a cada chamada: evita que um retry de rede
	// do cliente HTTP cobre o cliente duas vezes pelo mesmo pedido.
	req.Header.Set("X-Idempotency-Key", uuid.New().String())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return PaymentResult{}, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return PaymentResult{}, fmt.Errorf("mercado pago: %s", string(respBody))
	}

	// So os campos que a loja realmente usa do retorno do Mercado Pago.
	var result struct {
		ID                 int64  `json:"id"`
		Status             string `json:"status"`
		StatusDetail       string `json:"status_detail"`
		PointOfInteraction struct {
			TransactionData struct {
				QRCode       string `json:"qr_code"`
				QRCodeBase64 string `json:"qr_code_base64"`
			} `json:"transaction_data"`
		} `json:"point_of_interaction"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return PaymentResult{}, err
	}

	return PaymentResult{
		ProviderRef:  fmt.Sprintf("%d", result.ID),
		Status:       result.Status,
		StatusDetail: result.StatusDetail,
		QRCode:       result.PointOfInteraction.TransactionData.QRCode,
		QRCodeBase64: result.PointOfInteraction.TransactionData.QRCodeBase64,
	}, nil
}

// MockProvider simula o Mercado Pago sem chamar nenhuma API externa, para
// rodar a loja em desenvolvimento sem credenciais reais.
type MockProvider struct{}

// CreatePayment devolve um Pix sempre pendente (com QR code fixo, nao
// pagavel de verdade) ou um cartao sempre aprovado, so para exercitar o
// fluxo de checkout.
func (MockProvider) CreatePayment(input DirectPaymentInput) (PaymentResult, error) {
	if input.PaymentMethodID == "pix" {
		return PaymentResult{
			ProviderRef: "MOCK-" + uuid.New().String(),
			Status:      "pending",
			QRCode:      "00020126360014BR.GOV.BCB.PIX0114MOCK-NAO-PAGAR5204000053039865802BR5910MINHA LOJA6009SAO PAULO62070503***6304MOCK",
		}, nil
	}
	return PaymentResult{
		ProviderRef: "MOCK-" + uuid.New().String(),
		Status:      "approved",
	}, nil
}
