import { sql } from '@/lib/db';
import { toApiNumber } from '@/lib/money';
import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import { assertCatalogRead } from './access';
import { formatCatalogCategoryPath } from './category-path';

type DbCategory = {
  id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
};

type DbProduct = {
  id: string;
  category_id: string;
  name: string;
  unit_price: string;
};

export type CatalogReadCategory = {
  id: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  hasChildren: boolean;
};

export type CatalogReadProduct = {
  id: string;
  categoryId: string;
  name: string;
  unitPrice: number;
};

function serializeCategory(row: DbCategory, hasChildren: boolean): CatalogReadCategory {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    sortOrder: Number(row.sort_order),
    hasChildren,
  };
}

/** Active categories for order form (roots or children). No BOM. */
export async function listCatalogReadCategories(
  user: SessionUser,
  filters: { parentId?: string | null },
): Promise<CatalogReadCategory[]> {
  assertCatalogRead(user);
  const parentId = filters.parentId ?? null;

  const rows = (await sql`
    SELECT id, parent_id, name, sort_order
    FROM catalog_categories
    WHERE is_active = true
      AND (
        (${parentId}::uuid IS NULL AND parent_id IS NULL)
        OR parent_id = ${parentId}::uuid
      )
    ORDER BY sort_order ASC, name ASC
  `) as DbCategory[];

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const childCounts = (await sql`
    SELECT parent_id, count(*)::int AS c
    FROM catalog_categories
    WHERE is_active = true AND parent_id = ANY(${ids}::uuid[])
    GROUP BY parent_id
  `) as Array<{ parent_id: string; c: number }>;
  const childMap = new Map(childCounts.map((r) => [r.parent_id, r.c > 0]));

  return rows.map((row) => serializeCategory(row, childMap.get(row.id) === true));
}

/** Active products in a leaf category. Prices included; no BOM / cost fields. */
export async function listCatalogReadProducts(
  user: SessionUser,
  filters: { categoryId: string; q?: string },
): Promise<CatalogReadProduct[]> {
  assertCatalogRead(user);
  const q = filters.q?.trim() ? `%${filters.q.trim()}%` : null;

  const rows = (await sql`
    SELECT id, category_id, name, unit_price
    FROM catalog_products
    WHERE is_active = true
      AND category_id = ${filters.categoryId}::uuid
      AND (${q}::text IS NULL OR name ILIKE ${q})
    ORDER BY name ASC
    LIMIT 200
  `) as DbProduct[];

  return rows.map((row) => ({
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    unitPrice: toApiNumber(row.unit_price),
  }));
}

/** Single product for form price display (§15.12). */
export async function getCatalogReadProduct(
  user: SessionUser,
  productId: string,
): Promise<CatalogReadProduct> {
  assertCatalogRead(user);
  const rows = (await sql`
    SELECT id, category_id, name, unit_price
    FROM catalog_products
    WHERE id = ${productId}::uuid AND is_active = true
    LIMIT 1
  `) as DbProduct[];
  const row = rows[0];
  if (!row) throw new Error('product_not_found');
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    unitPrice: toApiNumber(row.unit_price),
  };
}

/** Server-side snapshot source when persisting catalog order lines. */
export async function loadCatalogProductSnapshot(productId: string): Promise<{
  id: string;
  categoryId: string;
  catalogCategoryId: string;
  catalogCategoryPath: string;
  name: string;
  unitPrice: string;
}> {
  const rows = (await sql`
    SELECT
      cp.id,
      cp.category_id,
      cp.name,
      cp.unit_price,
      cc.name AS category_name,
      parent.name AS parent_name
    FROM catalog_products cp
    JOIN catalog_categories cc ON cc.id = cp.category_id
    LEFT JOIN catalog_categories parent ON parent.id = cc.parent_id
    WHERE cp.id = ${productId}::uuid AND cp.is_active = true
    LIMIT 1
  `) as Array<{
    id: string;
    category_id: string;
    name: string;
    unit_price: string;
    category_name: string;
    parent_name: string | null;
  }>;
  const row = rows[0];
  if (!row) throw new Error('product_not_found');
  const catalogCategoryPath = formatCatalogCategoryPath(row.category_name, row.parent_name);
  return {
    id: row.id,
    categoryId: row.category_id,
    catalogCategoryId: row.category_id,
    catalogCategoryPath,
    name: row.name,
    unitPrice: String(row.unit_price),
  };
}
