CREATE TABLE IF NOT EXISTS product_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    session_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('view', 'click')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_events_type_product_time ON product_events (event_type, product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_customer_time ON product_events (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_session_time ON product_events (session_id, created_at DESC);
