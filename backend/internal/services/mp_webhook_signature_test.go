package services

import "testing"

// Os hashes esperados foram calculados fora do Go (HMAC-SHA256 do texto
// descrito na documentacao do Mercado Pago), para o teste nao acabar so
// repetindo a mesma conta que esta sendo verificada.
const (
	testWebhookSecret = "chave-secreta-do-webhook"
	hashWithRequestID = "0203681c8ab46da93482e22c498f435bb692dc235bc21e0b058eded052a4c2a7"
	hashNoRequestID   = "fbcb440d95a4470fc88368cb6f0ab0d231d46f42a38ca71ed0bffd0e78a72af5"
	hashLowercasedID  = "b2f9063cc997ae701b316da069a594337e6be81e37c0211fa0aa06e4510a2219"
)

func TestMPSignatureMatches(t *testing.T) {
	cases := []struct {
		name      string
		signature string
		requestID string
		dataID    string
		want      bool
	}{
		{
			name:      "assinatura valida",
			signature: "ts=1704908010,v1=" + hashWithRequestID,
			requestID: "abc-123",
			dataID:    "123456789",
			want:      true,
		},
		{
			name:      "espacos entre os campos do cabecalho",
			signature: " ts=1704908010 , v1=" + hashWithRequestID,
			requestID: "abc-123",
			dataID:    "123456789",
			want:      true,
		},
		{
			name:      "id com letra maiuscula entra minusculo no texto assinado",
			signature: "ts=1704908010,v1=" + hashLowercasedID,
			requestID: "abc-123",
			dataID:    "ABC123",
			want:      true,
		},
		{
			name:      "sem x-request-id o pedaco sai do texto assinado",
			signature: "ts=1704908010,v1=" + hashNoRequestID,
			requestID: "",
			dataID:    "123456789",
			want:      true,
		},
		{
			name:      "hash de outro pagamento",
			signature: "ts=1704908010,v1=" + hashWithRequestID,
			requestID: "abc-123",
			dataID:    "999999999",
			want:      false,
		},
		{
			name:      "timestamp trocado",
			signature: "ts=1704908011,v1=" + hashWithRequestID,
			requestID: "abc-123",
			dataID:    "123456789",
			want:      false,
		},
		{
			name:      "cabecalho sem v1",
			signature: "ts=1704908010",
			requestID: "abc-123",
			dataID:    "123456789",
			want:      false,
		},
		{
			name:      "cabecalho vazio",
			signature: "",
			requestID: "abc-123",
			dataID:    "123456789",
			want:      false,
		},
	}

	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			got := mpSignatureMatches(testWebhookSecret, test.signature, test.requestID, test.dataID)
			if got != test.want {
				t.Errorf("mpSignatureMatches() = %v, esperado %v", got, test.want)
			}
		})
	}
}

func TestMPSignatureRejectsOtherSecret(t *testing.T) {
	signature := "ts=1704908010,v1=" + hashWithRequestID
	if mpSignatureMatches("outra-chave", signature, "abc-123", "123456789") {
		t.Error("assinatura de outra chave secreta foi aceita")
	}
}
