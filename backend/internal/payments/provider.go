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

type PaymentResult struct {
	ProviderRef  string `json:"providerRef"`
	Status       string `json:"status"`
	StatusDetail string `json:"statusDetail,omitempty"`
	QRCode       string `json:"qrCode,omitempty"`
	QRCodeBase64 string `json:"qrCodeBase64,omitempty"`
}

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

type Provider interface {
	CreatePayment(input DirectPaymentInput) (PaymentResult, error)
}

type MercadoPagoProvider struct {
	AccessToken string
	FrontendURL string
}

func NewMercadoPagoProvider(accessToken, frontendURL string) *MercadoPagoProvider {
	return &MercadoPagoProvider{
		AccessToken: accessToken,
		FrontendURL: frontendURL,
	}
}

// CreatePayment processes the payment directly (Checkout Transparente / Payment Brick),
// without redirecting the customer to a Mercado Pago hosted page.
func (mp *MercadoPagoProvider) CreatePayment(input DirectPaymentInput) (PaymentResult, error) {
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

type MockProvider struct{}

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
