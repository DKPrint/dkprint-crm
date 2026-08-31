-- Phase 9b.1 — product catalog schema + order_items links (TZ §14.10, §14.18–14.22)
-- Apply after 004_order_items_name.sql on existing DBs.
--
-- Sanity (TZ):
--   catalog_categories  — tree via parent_id; external_code UNIQUE WHERE NOT NULL (1С match)
--   catalog_products    — leaf category_id; unit_price NUMERIC(12,2) snapshot source
--   catalog_consumables + catalog_product_consumables — BOM stub for warehouse (+2)
--   catalog_import_runs — import audit (who / replace_prices / counts)
--   order_items         — catalog_product_id NULL, is_manual DEFAULT false,
--                         category_id nullable (legacy flat categories)

CREATE TABLE IF NOT EXISTS catalog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NULL REFERENCES catalog_categories(id),
  name TEXT NOT NULL,
  external_code TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_categories_external_code_uidx
  ON catalog_categories (external_code)
  WHERE external_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS catalog_categories_parent_sort_idx
  ON catalog_categories (parent_id, sort_order);

CREATE TABLE IF NOT EXISTS catalog_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES catalog_categories(id),
  name TEXT NOT NULL,
  external_code TEXT NULL,
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_products_external_code_uidx
  ON catalog_products (external_code)
  WHERE external_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS catalog_products_category_idx
  ON catalog_products (category_id)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS catalog_consumables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  external_code TEXT NULL,
  unit TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_consumables_external_code_uidx
  ON catalog_consumables (external_code)
  WHERE external_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS catalog_product_consumables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES catalog_products(id) ON DELETE CASCADE,
  consumable_id UUID NOT NULL REFERENCES catalog_consumables(id),
  qty_per_unit NUMERIC(12,4) NOT NULL CHECK (qty_per_unit > 0),
  UNIQUE (product_id, consumable_id)
);

CREATE TABLE IF NOT EXISTS catalog_import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  filename TEXT,
  replace_prices BOOLEAN NOT NULL DEFAULT false,
  created_count INT NOT NULL DEFAULT 0,
  updated_price_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- order_items: catalog snapshot links; legacy category_id becomes nullable
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS catalog_product_id UUID NULL REFERENCES catalog_products(id);

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE order_items
  ALTER COLUMN category_id DROP NOT NULL;

-- Legacy rows keep category_id; catalog/manual rules enforced in app (TZ §14.10).
-- Strict CHECK (is_manual OR catalog_product_id) would break existing lines.
