ALTER TABLE customers ADD COLUMN IF NOT EXISTS cpf TEXT;

ALTER TABLE shipping_rules ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE shipping_rules ADD COLUMN IF NOT EXISTS weight_min_grams INT;
ALTER TABLE shipping_rules ADD COLUMN IF NOT EXISTS weight_max_grams INT;
ALTER TABLE shipping_rules ADD COLUMN IF NOT EXISTS region_prefix TEXT;
ALTER TABLE shipping_rules ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE shipping_rules
SET code = LOWER(REPLACE(name, ' ', '_'))
WHERE code IS NULL;

WITH ranked_rules AS (
    SELECT id, code, ROW_NUMBER() OVER (PARTITION BY code ORDER BY id) AS row_number
    FROM shipping_rules
    WHERE code IS NOT NULL
)
UPDATE shipping_rules AS shipping_rule
SET code = ranked_rules.code || '_' || SUBSTRING(shipping_rule.id::text, 1, 8)
FROM ranked_rules
WHERE shipping_rule.id = ranked_rules.id
  AND ranked_rules.row_number > 1;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shipping_rules_code_key') THEN
        ALTER TABLE shipping_rules ADD CONSTRAINT shipping_rules_code_key UNIQUE (code);
    END IF;
END $$;

