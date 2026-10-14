package services

import (
	"context"
	"errors"
)

// RecordProductEvent guarda visualizacao/clique de item so como sinal de
// analytics. product_id e TEXT (nao tem chave estrangeira), entao vale tanto
// para os ids do Organizador quanto para o que ja foi gravado antes dele.
func (s *Service) RecordProductEvent(ctx context.Context, customerID, sessionID, productID, eventType string) error {
	if sessionID == "" {
		return errors.New("sessao e obrigatoria")
	}
	if productID == "" {
		return errors.New("produto e obrigatorio")
	}
	if eventType != "view" && eventType != "click" {
		return errors.New("tipo de evento invalido")
	}

	var custID *string
	if customerID != "" {
		custID = &customerID
	}

	_, err := s.db.Exec(ctx,
		`INSERT INTO product_events (customer_id, session_id, product_id, event_type) VALUES ($1, $2, $3, $4)`,
		custID, sessionID, productID, eventType,
	)
	return err
}
