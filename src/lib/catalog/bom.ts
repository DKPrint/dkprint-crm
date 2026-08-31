import { sql } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import { assertCatalogAdmin } from './access';
import { formatQty4, toQtyNumber } from './qty';

type DbBomRow = {
  id: string;
  product_id: string;
  consumable_id: string;
  qty_per_unit: string;
  name: string;
  unit: string | null;
  external_code: string | null;
  is_active: boolean;
};

export type CatalogBomLine = {
  id: string;
  productId: string;
  consumableId: string;
  name: string;
  unit: string | null;
  externalCode: string | null;
  isActive: boolean;
  qtyPerUnit: number;
};

function serializeBom(row: DbBomRow): CatalogBomLine {
  return {
    id: row.id,
    productId: row.product_id,
    consumableId: row.consumable_id,
    name: row.name,
    unit: row.unit,
    externalCode: row.external_code,
    isActive: row.is_active === true,
    qtyPerUnit: toQtyNumber(row.qty_per_unit),
  };
}

async function assertProductExists(productId: string): Promise<void> {
  const rows = await sql`
    SELECT id FROM catalog_products WHERE id = ${productId}::uuid LIMIT 1
  `;
  if (rows.length === 0) throw new Error('product_not_found');
}

/** BOM lines for a product. Admin only; not exposed via /api/catalog/*. */
export async function listProductBom(
  user: SessionUser,
  productId: string,
): Promise<CatalogBomLine[]> {
  assertCatalogAdmin(user);
  await assertProductExists(productId);

  const rows = (await sql`
    SELECT
      b.id, b.product_id, b.consumable_id, b.qty_per_unit,
      c.name, c.unit, c.external_code, c.is_active
    FROM catalog_product_consumables b
    JOIN catalog_consumables c ON c.id = b.consumable_id
    WHERE b.product_id = ${productId}::uuid
    ORDER BY c.name ASC
  `) as DbBomRow[];

  return rows.map(serializeBom);
}

/**
 * Attach existing consumable or create-on-attach, then link with qty_per_unit.
 * No warehouse write-off.
 */
export async function addProductBomLine(
  user: SessionUser,
  productId: string,
  input: {
    consumableId?: string;
    name?: string;
    unit?: string | null;
    externalCode?: string | null;
    qtyPerUnit: string | number;
  },
): Promise<CatalogBomLine> {
  assertCatalogAdmin(user);
  await assertProductExists(productId);

  const qty = formatQty4(input.qtyPerUnit);
  let consumableId = input.consumableId ?? null;

  if (consumableId) {
    const existing = await sql`
      SELECT id FROM catalog_consumables WHERE id = ${consumableId}::uuid LIMIT 1
    `;
    if (existing.length === 0) throw new Error('consumable_not_found');
  } else {
    const name = input.name?.trim();
    if (!name) throw new Error('validation');
    const externalCode = input.externalCode?.trim() ? input.externalCode.trim() : null;
    const unit = input.unit?.trim() ? input.unit.trim() : null;
    try {
      const created = await sql`
        INSERT INTO catalog_consumables (name, external_code, unit)
        VALUES (${name}, ${externalCode}, ${unit})
        RETURNING id
      `;
      consumableId = (created[0] as { id: string }).id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/unique|duplicate/i.test(msg)) throw new Error('conflict');
      throw err;
    }
  }

  try {
    const rows = (await sql`
      WITH inserted AS (
        INSERT INTO catalog_product_consumables (product_id, consumable_id, qty_per_unit)
        VALUES (${productId}::uuid, ${consumableId}::uuid, ${qty}::numeric)
        RETURNING id, product_id, consumable_id, qty_per_unit
      )
      SELECT
        i.id, i.product_id, i.consumable_id, i.qty_per_unit,
        c.name, c.unit, c.external_code, c.is_active
      FROM inserted i
      JOIN catalog_consumables c ON c.id = i.consumable_id
    `) as DbBomRow[];
    const row = rows[0];
    if (!row) throw new Error('conflict');
    return serializeBom(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'conflict') throw err;
    if (/unique|duplicate/i.test(msg)) throw new Error('conflict');
    throw err;
  }
}

export async function patchProductBomLine(
  user: SessionUser,
  productId: string,
  lineId: string,
  input: { qtyPerUnit: string | number },
): Promise<CatalogBomLine> {
  assertCatalogAdmin(user);
  await assertProductExists(productId);

  const qty = formatQty4(input.qtyPerUnit);
  const rows = (await sql`
    WITH updated AS (
      UPDATE catalog_product_consumables
      SET qty_per_unit = ${qty}::numeric
      WHERE id = ${lineId}::uuid AND product_id = ${productId}::uuid
      RETURNING id, product_id, consumable_id, qty_per_unit
    )
    SELECT
      u.id, u.product_id, u.consumable_id, u.qty_per_unit,
      c.name, c.unit, c.external_code, c.is_active
    FROM updated u
    JOIN catalog_consumables c ON c.id = u.consumable_id
  `) as DbBomRow[];

  const row = rows[0];
  if (!row) throw new Error('bom_line_not_found');
  return serializeBom(row);
}

export async function deleteProductBomLine(
  user: SessionUser,
  productId: string,
  lineId: string,
): Promise<void> {
  assertCatalogAdmin(user);
  await assertProductExists(productId);

  const rows = await sql`
    DELETE FROM catalog_product_consumables
    WHERE id = ${lineId}::uuid AND product_id = ${productId}::uuid
    RETURNING id
  `;
  if (rows.length === 0) throw new Error('bom_line_not_found');
}
