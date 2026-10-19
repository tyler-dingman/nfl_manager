


CREATE TABLE IF NOT EXISTS app_commerce_products (
  id text PRIMARY KEY NOT NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  base_price_cents integer NOT NULL CHECK (base_price_cents >= 0),
  active INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);

CREATE TABLE IF NOT EXISTS app_commerce_product_variants (
  id text PRIMARY KEY NOT NULL,
  product_id text NOT NULL REFERENCES app_commerce_products(id) ON DELETE CASCADE,
  sku text NOT NULL UNIQUE,
  city_code text,
  city_name text,
  size text,
  color_label text,
  price_cents integer CHECK (price_cents >= 0),
  image_url text,
  inventory_on_hand integer NOT NULL DEFAULT 0 CHECK (inventory_on_hand >= 0),
  inventory_reserved integer NOT NULL DEFAULT 0 CHECK (inventory_reserved >= 0),
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  CHECK (inventory_reserved <= inventory_on_hand)
);
CREATE INDEX IF NOT EXISTS app_commerce_variants_product_idx ON app_commerce_product_variants(product_id,active);

CREATE TABLE IF NOT EXISTS app_commerce_promo_codes (
  code text PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('PERCENT','FIXED')),
  value integer NOT NULL CHECK (value > 0),
  active INTEGER NOT NULL DEFAULT 1,
  starts_at INTEGER,
  ends_at INTEGER,
  usage_limit integer,
  usage_count integer NOT NULL DEFAULT 0,
  minimum_subtotal_cents integer,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);

CREATE TABLE IF NOT EXISTS app_commerce_orders (
  id TEXT PRIMARY KEY NOT NULL,
  order_number text NOT NULL UNIQUE,
  user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  email text NOT NULL,
  phone text,
  customer_first_name text NOT NULL,
  customer_last_name text NOT NULL,
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','PAID','PICKING','PACKED','SHIPPED','DELIVERED','CANCELED')),
  payment_status text NOT NULL CHECK (payment_status IN ('PENDING','PAID','DECLINED','FAILED','CANCELED','REFUNDED','PARTIALLY_REFUNDED')),
  fulfillment_status text NOT NULL DEFAULT 'NEW' CHECK (fulfillment_status IN ('NEW','PICKING','PACKED','SHIPPED','DELIVERED','CANCELED')),
  payment_provider text NOT NULL,
  payment_reference text,stripe_payment_intent_id TEXT UNIQUE,currency TEXT NOT NULL DEFAULT 'usd',paid_at INTEGER,checkout_attempt_id TEXT UNIQUE,checkout_request_hash TEXT,refunded_total_cents INTEGER NOT NULL DEFAULT 0 CHECK(refunded_total_cents>=0),inventory_reservation_status TEXT NOT NULL DEFAULT 'HELD' CHECK(inventory_reservation_status IN('HELD','RELEASED','CONSUMED')),stripe_payment_event_created_at INTEGER,payment_attempt_started_at INTEGER,version INTEGER NOT NULL DEFAULT 0,
  subtotal_cents integer NOT NULL,
  discount_total_cents integer NOT NULL DEFAULT 0,
  shipping_total_cents integer NOT NULL,
  tax_total_cents integer NOT NULL,
  total_cents integer NOT NULL,
  promo_code text,
  shipping_address TEXT NOT NULL,
  shipping_method text NOT NULL,
  carrier text,
  tracking_number text,
  internal_note text,
  shipped_at INTEGER,
  delivered_at INTEGER,
  canceled_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);
CREATE INDEX IF NOT EXISTS app_commerce_orders_user_idx ON app_commerce_orders(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS app_commerce_orders_status_idx ON app_commerce_orders(fulfillment_status,created_at DESC);
CREATE INDEX IF NOT EXISTS app_commerce_orders_email_idx ON app_commerce_orders(lower(email),created_at DESC);

CREATE TABLE IF NOT EXISTS app_commerce_order_items (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES app_commerce_orders(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES app_commerce_products(id),
  variant_id text NOT NULL REFERENCES app_commerce_product_variants(id),
  sku text NOT NULL,
  product_name text NOT NULL,
  variant_label text NOT NULL,
  image_url text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  line_total_cents integer NOT NULL CHECK (line_total_cents >= 0),
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);
CREATE INDEX IF NOT EXISTS app_commerce_order_items_order_idx ON app_commerce_order_items(order_id);

CREATE TABLE IF NOT EXISTS app_commerce_inventory_adjustments (
  id TEXT PRIMARY KEY NOT NULL,
  variant_id text NOT NULL REFERENCES app_commerce_product_variants(id),
  admin_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  quantity_delta integer NOT NULL,
  reason text NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);

CREATE TABLE IF NOT EXISTS app_commerce_stripe_webhook_events (
  stripe_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('RECEIVED','PROCESSED','IGNORED','ERROR')),
  order_id TEXT REFERENCES app_commerce_orders(id) ON DELETE SET NULL,
  result text,
  received_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  processed_at INTEGER
);
CREATE TABLE IF NOT EXISTS app_commerce_refunds (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT UNIQUE,
  order_id TEXT NOT NULL REFERENCES app_commerce_orders(id) ON DELETE CASCADE,
  stripe_refund_id text UNIQUE,
  stripe_payment_intent_id text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL CHECK (status IN ('PENDING','REQUIRES_ACTION','SUCCEEDED','FAILED','CANCELED')),
  reason text,
  failure_reason text,
  created_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  stripe_created_at INTEGER,
  stripe_event_created_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000),
  updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)*1000)
);
CREATE TABLE app_commerce_counters(name TEXT PRIMARY KEY,next_value INTEGER NOT NULL);
CREATE INDEX app_commerce_refunds_order ON app_commerce_refunds(order_id,created_at DESC);
