import { sql } from '@/lib/db';
import { formatMoney2, toApiNumber } from '@/lib/money';
import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import { assertCatalogAdmin } from './access';

type DbProduct = {
  id: string;
  category_id: string;
  name: string;
  external_code: string | null;
  unit_price: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CatalogProduct = {
  id: string;
  categoryId: string;
  name: string;
  externalCode: string | null;
  unitPrice: number;
  isActive: boolean;
};

function serializeProduct(row: DbProduct): CatalogProduct {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    externalCode: row.external_code,
    unitPrice: toApiNumber(row.unit_price),
    isActive: row.is_active === true,
  };
}

/**
 * Admin product list for a category leaf (or any category_id).
 * Does **not** include BOM / consumables (TZ §13.1 anti-leak).
 */
export async function listProducts(
  user: SessionUser,
  filters: { categoryId?: string; includeInactive?: boolean },
): Promise<CatalogProduct[]> {
  assertCatalogAdmin(user);
  const categoryId = filters.categoryId ?? null;
  const includeInactive = filters.includeInactive === true;
  const rows = (await sql`
    SELECT id, category_id, name, external_code, unit_price, is_active, created_at, updated_at
    FROM catalog_products
    WHERE
      (${categoryId}::uuid IS NULL OR category_id = ${categoryId}::uuid)
      AND (${includeInactive} = true OR is_active = true)
    ORDER BY name ASC
    LIMIT 500
  `) as DbProduct[];
  return rows.map(serializeProduct);
}

export async function createProduct(
  user: SessionUser,
  input: {
    categoryId: string;
    name: string;
    unitPrice: string | number;
    externalCode?: string | null;
    isActive?: boolean;
  },
): Promise<CatalogProduct> {
  assertCatalogAdmin(user);
  const cats = await sql`
    SELECT id FROM catalog_categories WHERE id = ${input.categoryId} LIMIT 1
  `;
  if (cats.length === 0) throw new Error('category_not_found');

  const unit = formatMoney2(input.unitPrice);
  const externalCode = input.externalCode?.trim() ? input.externalCode.trim() : null;
  const isActive = input.isActive !== false;

  try {
    const rows = await sql`
      INSERT INTO catalog_products (category_id, name, external_code, unit_price, is_active)
      VALUES (${input.categoryId}::uuid, ${input.name}, ${externalCode}, ${unit}::numeric, ${isActive})
      RETURNING id, category_id, name, external_code, unit_price, is_active, created_at, updated_at
    `;
    return serializeProduct(rows[0] as DbProduct);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) throw new Error('conflict');
    throw err;
  }
}

export async function patchProduct(
  user: SessionUser,
  productId: string,
  input: {
    categoryId?: string;
    name?: string;
    unitPrice?: string | number;
    externalCode?: string | null;
    isActive?: boolean;
  },
): Promise<CatalogProduct> {
  assertCatalogAdmin(user);
  const existingRows = await sql`
    SELECT id, category_id, name, external_code, unit_price, is_active, created_at, updated_at
    FROM catalog_products
    WHERE id = ${productId}
    LIMIT 1
  `;
  const existing = existingRows[0] as DbProduct | undefined;
  if (!existing) throw new Error('product_not_found');

  const categoryId = input.categoryId ?? existing.category_id;
  if (input.categoryId) {
    const cats = await sql`
      SELECT id FROM catalog_categories WHERE id = ${categoryId} LIMIT 1
    `;
    if (cats.length === 0) throw new Error('category_not_found');
  }

  const name = input.name ?? existing.name;
  const unit =
    input.unitPrice !== undefined
      ? formatMoney2(input.unitPrice)
      : formatMoney2(existing.unit_price);
  const isActive = input.isActive ?? existing.is_active === true;
  const externalCode =
    input.externalCode !== undefined
      ? input.externalCode?.trim()
        ? input.externalCode.trim()
        : null
      : existing.external_code;

  if (
    categoryId === existing.category_id &&
    name === existing.name &&
    unit === formatMoney2(existing.unit_price) &&
    isActive === (existing.is_active === true) &&
    externalCode === existing.external_code
  ) {
    return serializeProduct(existing);
  }

  try {
    const rows = await sql`
      UPDATE catalog_products
      SET
        category_id = ${categoryId}::uuid,
        name = ${name},
        external_code = ${externalCode},
        unit_price = ${unit}::numeric,
        is_active = ${isActive},
        updated_at = now()
      WHERE id = ${productId}
      RETURNING id, category_id, name, external_code, unit_price, is_active, created_at, updated_at
    `;
    return serializeProduct(rows[0] as DbProduct);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) throw new Error('conflict');
    throw err;
  }
}
