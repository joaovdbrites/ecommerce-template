-- Administrador fixo: a conta de recuperacao (definida via ADMIN_EMAIL) nunca
-- aparece na lista de Clientes e nunca pode ter o acesso removido pela tela
-- de Administradores, para nao repetir o acidente de ficar sem nenhum admin.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_fixed_admin BOOLEAN NOT NULL DEFAULT false;
