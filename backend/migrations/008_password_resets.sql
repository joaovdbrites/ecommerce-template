-- Recuperacao de senha com token de uso unico guardado como hash.
-- Antes o token era um JWT devolvido na propria resposta HTTP, o que permitia
-- a qualquer um trocar a senha de outra pessoa so sabendo o e-mail dela.

CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_resets_customer_idx ON password_resets (customer_id);
CREATE INDEX IF NOT EXISTS password_resets_expires_idx ON password_resets (expires_at);
