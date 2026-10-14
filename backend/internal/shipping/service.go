package shipping

type QuoteInput struct {
	CEP          string  `json:"cep"`
	WeightGrams  int     `json:"weightGrams"`
	Subtotal     float64 `json:"subtotal"`
	DeliveryMode string  `json:"deliveryMode"`
	City         string  `json:"city"`
}

type QuoteOutput struct {
	Amount float64 `json:"amount"`
	Label  string  `json:"label"`
}
