BEGIN;

CREATE SEQUENCE IF NOT EXISTS commerce_order_number_seq START 1042;

CREATE TABLE IF NOT EXISTS commerce_products (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  base_price_cents integer NOT NULL CHECK (base_price_cents >= 0),
  active boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commerce_product_variants (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES commerce_products(id) ON DELETE CASCADE,
  sku text NOT NULL UNIQUE,
  city_code text,
  city_name text,
  size text,
  color_label text,
  price_cents integer CHECK (price_cents >= 0),
  image_url text,
  inventory_on_hand integer NOT NULL DEFAULT 0 CHECK (inventory_on_hand >= 0),
  inventory_reserved integer NOT NULL DEFAULT 0 CHECK (inventory_reserved >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (inventory_reserved <= inventory_on_hand)
);
CREATE INDEX IF NOT EXISTS commerce_variants_product_idx ON commerce_product_variants(product_id,active);

CREATE TABLE IF NOT EXISTS commerce_promo_codes (
  code text PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('PERCENT','FIXED')),
  value integer NOT NULL CHECK (value > 0),
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer,
  usage_count integer NOT NULL DEFAULT 0,
  minimum_subtotal_cents integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commerce_orders (
  id uuid PRIMARY KEY,
  order_number text NOT NULL UNIQUE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  email text NOT NULL,
  phone text,
  customer_first_name text NOT NULL,
  customer_last_name text NOT NULL,
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','PAID','PICKING','PACKED','SHIPPED','DELIVERED','CANCELED')),
  payment_status text NOT NULL CHECK (payment_status IN ('PENDING','PAID','DECLINED','REFUNDED')),
  fulfillment_status text NOT NULL DEFAULT 'NEW' CHECK (fulfillment_status IN ('NEW','PICKING','PACKED','SHIPPED','DELIVERED','CANCELED')),
  payment_provider text NOT NULL,
  payment_reference text,
  subtotal_cents integer NOT NULL,
  discount_total_cents integer NOT NULL DEFAULT 0,
  shipping_total_cents integer NOT NULL,
  tax_total_cents integer NOT NULL,
  total_cents integer NOT NULL,
  promo_code text,
  shipping_address jsonb NOT NULL,
  shipping_method text NOT NULL,
  carrier text,
  tracking_number text,
  internal_note text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commerce_orders_user_idx ON commerce_orders(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS commerce_orders_status_idx ON commerce_orders(fulfillment_status,created_at DESC);
CREATE INDEX IF NOT EXISTS commerce_orders_email_idx ON commerce_orders(lower(email),created_at DESC);

CREATE TABLE IF NOT EXISTS commerce_order_items (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES commerce_products(id),
  variant_id text NOT NULL REFERENCES commerce_product_variants(id),
  sku text NOT NULL,
  product_name text NOT NULL,
  variant_label text NOT NULL,
  image_url text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  line_total_cents integer NOT NULL CHECK (line_total_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commerce_order_items_order_idx ON commerce_order_items(order_id);

CREATE TABLE IF NOT EXISTS commerce_inventory_adjustments (
  id uuid PRIMARY KEY,
  variant_id text NOT NULL REFERENCES commerce_product_variants(id),
  admin_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  quantity_delta integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO commerce_promo_codes(code,type,value,active,minimum_subtotal_cents)
VALUES ('WELCOME10','PERCENT',10,true,1000),('CREW10','PERCENT',10,true,1000),('GAMEDAY','FIXED',500,true,2500)
ON CONFLICT(code) DO NOTHING;

COMMIT;
