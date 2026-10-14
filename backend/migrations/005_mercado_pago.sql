ALTER TABLE orders ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'online';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_preference_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_payment_id TEXT;

INSERT INTO settings (key, value) VALUES ('mp_access_token', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('mp_webhook_secret', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('mp_public_key', '') ON CONFLICT (key) DO NOTHING;
