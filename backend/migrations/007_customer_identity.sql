-- Identidade do cliente: login por e-mail ou CPF e vinculo com conta Google.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS google_sub TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Contas criadas pelo Google nascem sem senha ate o cliente definir uma.
ALTER TABLE customers ALTER COLUMN password_hash SET DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS customers_google_sub_key
    ON customers (google_sub)
    WHERE google_sub IS NOT NULL AND google_sub <> '';

-- O CPF virou chave de login, entao precisa ser unico ignorando a mascara.
-- Bases antigas podem ja ter CPFs repetidos: nesse caso o indice e ignorado e
-- a checagem continua valendo na camada de aplicacao.
DO $$
BEGIN
    CREATE UNIQUE INDEX customers_cpf_digits_key
        ON customers ((regexp_replace(cpf, '[^0-9]', '', 'g')))
        WHERE cpf IS NOT NULL AND regexp_replace(cpf, '[^0-9]', '', 'g') <> '';
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN unique_violation THEN NULL;
END;
$$;
