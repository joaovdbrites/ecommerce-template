package shipping

// QuoteInput e o que o front-end manda para cotar o frete do carrinho:
// DeliveryMode distingue entrega (usa CEP/peso) de retirada na loja, e City
// e usada para regras de frete gratis/local especificas de alguma cidade.
type QuoteInput struct {
	CEP          string  `json:"cep"`
	WeightGrams  int     `json:"weightGrams"`
	Subtotal     float64 `json:"subtotal"`
	DeliveryMode string  `json:"deliveryMode"`
	City         string  `json:"city"`
}

// QuoteOutput e o valor final do frete (ja podendo ser 0 em caso de frete
// gratis/retirada) e o texto pronto para mostrar ao cliente.
type QuoteOutput struct {
	Amount float64 `json:"amount"`
	Label  string  `json:"label"`
}
