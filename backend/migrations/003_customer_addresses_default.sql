ALTER TABLE addresses ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

UPDATE addresses AS address
SET is_default = ranked.row_number = 1
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at ASC) AS row_number
    FROM addresses
) AS ranked
WHERE ranked.id = address.id
  AND NOT EXISTS (
      SELECT 1
      FROM addresses existing_default
      WHERE existing_default.customer_id = address.customer_id
        AND existing_default.is_default = true
  );

CREATE UNIQUE INDEX IF NOT EXISTS addresses_customer_default_idx
ON addresses (customer_id)
WHERE is_default = true;
