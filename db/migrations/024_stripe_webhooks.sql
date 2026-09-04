BEGIN;

ALTER TABLE commerce_orders DROP CONSTRAINT IF EXISTS commerce_orders_payment_status_check;
ALTER TABLE commerce_orders ADD CONSTRAINT commerce_orders_payment_status_check
  CHECK (payment_status IN ('PENDING','PAID','DECLINED','FAILED','CANCELED','REFUNDED'));
ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd';
ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS commerce_orders_stripe_payment_intent_idx
  ON commerce_orders(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS commerce_stripe_webhook_events (
  stripe_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('RECEIVED','PROCESSED','IGNORED','ERROR')),
  order_id uuid REFERENCES commerce_orders(id) ON DELETE SET NULL,
  result text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

COMMIT;
