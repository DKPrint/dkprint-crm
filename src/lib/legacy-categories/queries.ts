import { sql } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import { assertCatalogAdmin } from '@/lib/catalog/access';
import type { CreateLegacyCategoryInput, PatchLegacyCategoryInput } from './schemas';

type DbRow = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type LegacyCategory = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
};

function serialize(row: DbRow): LegacyCategory {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function listLegacyCategories(user: SessionUser): Promise<LegacyCategory[]> {
  assertCatalogAdmin(user);
  const rows = (await sql`
    SELECT id, name, sort_order, is_active, created_at
    FROM categories
    ORDER BY sort_order ASC, name ASC
  `) as DbRow[];
  return rows.map(serialize);
}

export async function createLegacyCategory(
  user: SessionUser,
  input: CreateLegacyCategoryInput,
): Promise<LegacyCategory> {
  assertCatalogAdmin(user);
  const sortOrder = input.sortOrder ?? 0;
  const isActive = input.isActive ?? true;
  const rows = (await sql`
    INSERT INTO categories (name, sort_order, is_active)
    VALUES (${input.name}, ${sortOrder}, ${isActive})
    RETURNING id, name, sort_order, is_active, created_at
  `) as DbRow[];
  const row = rows[0];
  if (!row) throw new Error('validation');
  return serialize(row);
}

export async function patchLegacyCategory(
  user: SessionUser,
  categoryId: string,
  input: PatchLegacyCategoryInput,
): Promise<LegacyCategory> {
  assertCatalogAdmin(user);
  const existingRows = (await sql`
    SELECT id, name, sort_order, is_active, created_at
    FROM categories
    WHERE id = ${categoryId}::uuid
    LIMIT 1
  `) as DbRow[];
  const existing = existingRows[0];
  if (!existing) throw new Error('category_not_found');

  const name = input.name ?? existing.name;
  const sortOrder = input.sortOrder ?? existing.sort_order;
  const isActive = input.isActive ?? existing.is_active;

  const rows = (await sql`
    UPDATE categories
    SET name = ${name}, sort_order = ${sortOrder}, is_active = ${isActive}
    WHERE id = ${categoryId}::uuid
    RETURNING id, name, sort_order, is_active, created_at
  `) as DbRow[];
  const row = rows[0];
  if (!row) throw new Error('category_not_found');
  return serialize(row);
}

export async function deleteLegacyCategory(user: SessionUser, categoryId: string): Promise<void> {
  assertCatalogAdmin(user);
  const used = (await sql`
    SELECT 1 FROM order_items WHERE category_id = ${categoryId}::uuid LIMIT 1
  `) as unknown[];
  if (used.length > 0) {
    const rows = (await sql`
      UPDATE categories SET is_active = false WHERE id = ${categoryId}::uuid
      RETURNING id
    `) as Array<{ id: string }>;
    if (!rows[0]) throw new Error('category_not_found');
    return;
  }
  const rows = (await sql`
    DELETE FROM categories WHERE id = ${categoryId}::uuid RETURNING id
  `) as Array<{ id: string }>;
  if (!rows[0]) throw new Error('category_not_found');
}
