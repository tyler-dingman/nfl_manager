BEGIN;

ALTER TABLE commerce_orders ADD COLUMN IF NOT EXISTS checkout_attempt_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS commerce_orders_checkout_attempt_idx
  ON commerce_orders(checkout_attempt_id) WHERE checkout_attempt_id IS NOT NULL;

COMMIT;
