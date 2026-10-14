-- Remove o catalogo antigo (tabela "products" e seus satelites). Ele era do
-- tempo em que os produtos eram cadastrados por um painel proprio; hoje quem
-- cadastra item e o Organizador, que guarda tudo em settings.organizer_store.
-- Em producao essas tabelas estavam vazias (so os seeds de marca/categoria),
-- nenhuma rota do site lia delas e nenhum pedido apontava para elas.
--
-- As migrations rodam todas, em ordem, a cada boot (ver RunMigrations) - por
-- isso os arquivos anteriores que criavam/alteravam essas tabelas foram
-- editados ou removidos junto, senao um deles estouraria aqui depois do DROP
-- e derrubaria o backend (main.go usa log.Fatalf).

-- A foto do item passa a ser copiada para a linha do pedido no momento da
-- compra. Antes vinha de um JOIN com products.image_url; agora o historico
-- continua certo mesmo que o item mude de foto ou saia do Organizador.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_image_url TEXT NOT NULL DEFAULT '';

-- product_id so existia para apontar para o catalogo antigo e ja nascia nulo
-- desde a migration 016; quem identifica o item agora e organizer_item_id.
ALTER TABLE order_items DROP COLUMN IF EXISTS product_id;

DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS carts;
DROP TABLE IF EXISTS pos_sale_items;
DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS discount_rules;
DROP TABLE IF EXISTS banners;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS brands;
DROP TABLE IF EXISTS categories;

-- Lista de tipos usada so pelo formulario de produto do catalogo antigo.
DELETE FROM settings WHERE key = 'product_types';
