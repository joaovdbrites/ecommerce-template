-- Itens criados no Organizador (ex.: "item-<uuid>") nunca tiveram uma linha
-- correspondente na tabela "products" (o catalogo antigo, removido na
-- migration 017). Ate aqui, finalizar um pedido com um item do Organizador
-- quebrava: o backend tentava validar product_id contra "products", e um id
-- fora do formato UUID derrubava a query com "invalid input syntax for type
-- uuid".
--
-- organizer_item_id guarda o id do item do Organizador na linha do pedido,
-- para manter o historico/relatorio rastreavel.
ALTER TABLE order_items
	ADD COLUMN IF NOT EXISTS organizer_item_id TEXT;
