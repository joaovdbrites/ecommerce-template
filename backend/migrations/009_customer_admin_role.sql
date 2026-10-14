-- Cargo de administrador: cliente com is_admin=true ganha acesso ao Admin
-- (ex-Organizador) e as rotas que hoje ficavam completamente abertas.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
