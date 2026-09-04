BEGIN;

ALTER TABLE commerce_orders DROP CONSTRAINT IF EXISTS commerce_orders_payment_status_check;
ALTER TABLE commerce_orders ADD CONSTRAINT commerce_orders_payment_status_check
  CHECK (payment_status IN (
    'PENDING','PAID','DECLINED','FAILED','CANCELED','REFUNDED','PARTIALLY_REFUNDED'
  ));

ALTER TABLE commerce_orders
  ADD COLUMN IF NOT EXISTS refunded_total_cents integer NOT NULL DEFAULT 0
    CHECK (refunded_total_cents >= 0),
  ADD COLUMN IF NOT EXISTS inventory_reservation_status text NOT NULL DEFAULT 'HELD'
    CHECK (inventory_reservation_status IN ('HELD','RELEASED','CONSUMED')),
  ADD COLUMN IF NOT EXISTS stripe_payment_event_created_at bigint,
  ADD COLUMN IF NOT EXISTS payment_attempt_started_at timestamptz;

UPDATE commerce_orders
SET inventory_reservation_status = CASE
  WHEN fulfillment_status IN ('SHIPPED','DELIVERED') THEN 'CONSUMED'
  WHEN fulfillment_status = 'CANCELED' THEN 'RELEASED'
  ELSE inventory_reservation_status
END;

CREATE TABLE IF NOT EXISTS commerce_refunds (
  id uuid PRIMARY KEY,
  request_id uuid UNIQUE,
  order_id uuid NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  stripe_refund_id text UNIQUE,
  stripe_payment_intent_id text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL CHECK (status IN ('PENDING','REQUIRES_ACTION','SUCCEEDED','FAILED','CANCELED')),
  reason text,
  failure_reason text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  stripe_created_at timestamptz,
  stripe_event_created_at bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE commerce_refunds ADD COLUMN IF NOT EXISTS stripe_event_created_at bigint;
CREATE INDEX IF NOT EXISTS commerce_refunds_order_idx
  ON commerce_refunds(order_id, created_at DESC);

COMMIT;
