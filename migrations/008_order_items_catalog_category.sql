-- Snapshot catalog category on order line (TZ §8 — как цена/name)

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS catalog_category_id UUID NULL
    REFERENCES catalog_categories(id);

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS catalog_category_path TEXT NULL;
-- Пример: "Полиграфия / Визитки" (root / leaf), фиксируется при create

CREATE INDEX IF NOT EXISTS order_items_catalog_category_id_idx
  ON order_items (catalog_category_id)
  WHERE catalog_category_id IS NOT NULL;

-- Backfill существующих catalog-линий
UPDATE order_items oi
SET
  catalog_category_id = cp.category_id,
  catalog_category_path = CASE
    WHEN cc.parent_id IS NOT NULL THEN parent.name || ' / ' || cc.name
    ELSE cc.name
  END
FROM catalog_products cp
JOIN catalog_categories cc ON cc.id = cp.category_id
LEFT JOIN catalog_categories parent ON parent.id = cc.parent_id
WHERE oi.catalog_product_id = cp.id
  AND oi.catalog_category_id IS NULL;
