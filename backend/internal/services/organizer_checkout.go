package services

import (
	"context"
	"encoding/json"
	"fmt"
)

// organizerCheckoutNode e organizerCheckoutTag leem so os campos do item do
// Organizador que o checkout precisa (preco, estoque, status, tags de
// desconto). O resto do JSON (descricao, fotos, agendamento etc.) nunca
// passa por aqui - evita que um struct incompleto apague campo ao
// re-serializar (ver decrementOrganizerStock, que usa map[string]interface{}
// justamente por isso na hora de escrever de volta).
type organizerCheckoutNode struct {
	ID       string   `json:"id"`
	Type     string   `json:"type"`
	Name     string   `json:"name"`
	Status   string   `json:"status"`
	Price    float64  `json:"price"`
	Stock    *int     `json:"stock"`
	VolumeMl *int     `json:"volumeMl"`
	ImageURL string   `json:"imageUrl"`
	TagIds   []string `json:"tagIds"`
}

// organizerCheckoutTag representa uma tag/categoria do Organizador que pode
// carregar um desconto percentual aplicavel aos itens marcados com ela.
type organizerCheckoutTag struct {
	ID              string   `json:"id"`
	DiscountPercent *float64 `json:"discountPercent"`
}

// organizerCheckoutStore e o formato minimo do JSON armazenado em
// settings["organizer_store"] que o checkout precisa ler.
type organizerCheckoutStore struct {
	Nodes []organizerCheckoutNode `json:"nodes"`
	Tags  []organizerCheckoutTag  `json:"tags"`
}

// organizerItemSummary e o resultado ja resolvido (preco final com desconto
// aplicado, peso estimado) que o checkout usa para montar o pedido.
type organizerItemSummary struct {
	ID        string
	Name      string
	ImageURL  string
	UnitPrice float64
	Weight    int
}

// resolveOrganizerCheckoutItem confere preco/disponibilidade de um item do
// Organizador direto na fonte (nunca confia em preco vindo do navegador,
// mesma regra ja aplicada aos produtos do catalogo antigo). So os status
// "published" e "low-stock" podem ser comprados - os mesmos que liberam o
// botao de compra no site (ver utils/itemStatus.ts no frontend).
func (s *Service) resolveOrganizerCheckoutItem(ctx context.Context, itemID string, quantity int) (*organizerItemSummary, error) {
	raw, err := s.GetOrganizerStore(ctx)
	if err != nil {
		return nil, err
	}
	if raw == nil {
		return nil, fmt.Errorf("item nao encontrado")
	}

	var store organizerCheckoutStore
	if err := json.Unmarshal(raw, &store); err != nil {
		return nil, err
	}

	// Procura o item pelo id entre os nos do tipo "item" (o Organizador tem
	// outros tipos de no, como pastas, que nao sao compraveis).
	var node *organizerCheckoutNode
	for i := range store.Nodes {
		if store.Nodes[i].ID == itemID && store.Nodes[i].Type == "item" {
			node = &store.Nodes[i]
			break
		}
	}
	if node == nil {
		return nil, fmt.Errorf("item nao encontrado")
	}
	// So deixa comprar o que esta visivel para o cliente no site.
	if node.Status != "published" && node.Status != "low-stock" {
		return nil, fmt.Errorf("%s nao esta disponivel para compra no momento", node.Name)
	}
	if node.Stock != nil && *node.Stock < quantity {
		return nil, fmt.Errorf("estoque insuficiente para %s", node.Name)
	}

	// Aplica o maior desconto entre as tags do item (descontos nao se
	// acumulam, so vale o melhor).
	bestDiscount := 0.0
	for _, tagID := range node.TagIds {
		for _, tag := range store.Tags {
			if tag.ID == tagID && tag.DiscountPercent != nil && *tag.DiscountPercent > bestDiscount {
				bestDiscount = *tag.DiscountPercent
			}
		}
	}
	finalPrice := node.Price * (1 - bestDiscount/100)
	if finalPrice < 0 {
		finalPrice = 0
	}

	// Organizador nao tem campo de peso (so volume) - usa o volume em ml como
	// aproximacao em gramas (perfume e liquido, densidade proxima da agua) e
	// cai num valor minimo de seguranca quando o item nem tem volume definido,
	// pra nunca cotar frete de graca.
	weight := 200
	if node.VolumeMl != nil && *node.VolumeMl > 0 {
		weight = *node.VolumeMl
	}

	return &organizerItemSummary{
		ID:   node.ID,
		Name: node.Name,
		// A foto e copiada para o pedido (order_items.product_image_url) em vez
		// de ser buscada depois: o item pode mudar de foto - ou sair do
		// Organizador - sem bagunçar o historico de quem ja comprou.
		ImageURL:  node.ImageURL,
		UnitPrice: finalPrice,
		Weight:    weight,
	}, nil
}

// decrementOrganizerStock baixa o estoque dos itens do Organizador depois que
// o pagamento e confirmado (mesmo momento em que o catalogo antigo baixa
// products.stock_current - ver updateStockForOrder). O SELECT ... FOR UPDATE
// trava a linha "organizer_store" em settings pelo tempo da transacao: uma
// gravacao concorrente do admin (PUT /organizer) espera essa baixa terminar
// em vez de arriscar sobrescreve-la.
func (s *Service) decrementOrganizerStock(ctx context.Context, decrements map[string]int) {
	if len(decrements) == 0 {
		return
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return
	}
	defer tx.Rollback(ctx)

	// Trava a linha do JSON do Organizador para a duracao da transacao (ver
	// comentario da funcao sobre a disputa com o PUT /organizer do admin).
	var raw string
	if err := tx.QueryRow(ctx, `SELECT value FROM settings WHERE key = $1 FOR UPDATE`, organizerStoreSettingKey).Scan(&raw); err != nil {
		return
	}

	// Usa map[string]interface{} (em vez do struct organizerCheckoutNode) de
	// proposito: preserva todo campo que o checkout nao conhece ao
	// re-serializar o JSON de volta.
	var store map[string]json.RawMessage
	if err := json.Unmarshal([]byte(raw), &store); err != nil {
		return
	}
	var nodes []map[string]interface{}
	if err := json.Unmarshal(store["nodes"], &nodes); err != nil {
		return
	}

	// Para cada no que corresponde a um item do pedido, desconta a
	// quantidade comprada do estoque e marca como "coming-soon" quando zera.
	changed := false
	for i, node := range nodes {
		id, _ := node["id"].(string)
		nodeType, _ := node["type"].(string)
		qty, wantsDecrement := decrements[id]
		if !wantsDecrement || nodeType != "item" {
			continue
		}
		stockValue, tracked := node["stock"].(float64)
		if !tracked {
			continue
		}
		next := stockValue - float64(qty)
		if next < 0 {
			next = 0
		}
		nodes[i]["stock"] = next
		if next <= 0 {
			nodes[i]["status"] = "coming-soon"
		}
		changed = true
	}
	if !changed {
		return
	}

	// Reserializa nodes dentro do objeto original e grava de volta.
	nodesJSON, err := json.Marshal(nodes)
	if err != nil {
		return
	}
	store["nodes"] = nodesJSON
	finalJSON, err := json.Marshal(store)
	if err != nil {
		return
	}

	if _, err := tx.Exec(ctx, `UPDATE settings SET value = $2 WHERE key = $1`, organizerStoreSettingKey, string(finalJSON)); err != nil {
		return
	}
	tx.Commit(ctx)
}
