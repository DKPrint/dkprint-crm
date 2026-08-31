import { sql } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import { assertCatalogAdmin } from './access';

type DbCategory = {
  id: string;
  parent_id: string | null;
  name: string;
  external_code: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CatalogCategoryNode = {
  id: string;
  parentId: string | null;
  name: string;
  externalCode: string | null;
  sortOrder: number;
  isActive: boolean;
  children: CatalogCategoryNode[];
};

function serializeCategory(row: DbCategory): Omit<CatalogCategoryNode, 'children'> {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    externalCode: row.external_code,
    sortOrder: Number(row.sort_order),
    isActive: row.is_active === true,
  };
}

function buildTree(rows: DbCategory[]): CatalogCategoryNode[] {
  const nodes = new Map<string, CatalogCategoryNode>();
  for (const row of rows) {
    nodes.set(row.id, { ...serializeCategory(row), children: [] });
  }
  const roots: CatalogCategoryNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id)!;
    if (row.parent_id && nodes.has(row.parent_id)) {
      nodes.get(row.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (list: CatalogCategoryNode[]) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ru'));
    for (const n of list) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

/** Full category tree for admin (includes inactive). */
export async function listCategoryTree(user: SessionUser): Promise<CatalogCategoryNode[]> {
  assertCatalogAdmin(user);
  const rows = (await sql`
    SELECT id, parent_id, name, external_code, sort_order, is_active, created_at, updated_at
    FROM catalog_categories
    ORDER BY sort_order ASC, name ASC
  `) as DbCategory[];
  return buildTree(rows);
}

export async function createCategory(
  user: SessionUser,
  input: {
    name: string;
    parentId?: string | null;
    externalCode?: string | null;
    sortOrder?: number;
  },
): Promise<Omit<CatalogCategoryNode, 'children'>> {
  assertCatalogAdmin(user);
  const parentId = input.parentId ?? null;
  if (parentId) {
    const parents = await sql`
      SELECT id FROM catalog_categories WHERE id = ${parentId} LIMIT 1
    `;
    if (parents.length === 0) throw new Error('category_not_found');
  }
  const sortOrder = input.sortOrder ?? 0;
  const externalCode = input.externalCode?.trim() ? input.externalCode.trim() : null;
  try {
    const rows = await sql`
      INSERT INTO catalog_categories (parent_id, name, external_code, sort_order)
      VALUES (${parentId}, ${input.name}, ${externalCode}, ${sortOrder})
      RETURNING id, parent_id, name, external_code, sort_order, is_active, created_at, updated_at
    `;
    return serializeCategory(rows[0] as DbCategory);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) throw new Error('conflict');
    throw err;
  }
}

export async function patchCategory(
  user: SessionUser,
  categoryId: string,
  input: {
    name?: string;
    parentId?: string | null;
    externalCode?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  },
): Promise<Omit<CatalogCategoryNode, 'children'>> {
  assertCatalogAdmin(user);
  const existingRows = await sql`
    SELECT id, parent_id, name, external_code, sort_order, is_active, created_at, updated_at
    FROM catalog_categories
    WHERE id = ${categoryId}
    LIMIT 1
  `;
  const existing = existingRows[0] as DbCategory | undefined;
  if (!existing) throw new Error('category_not_found');

  const name = input.name ?? existing.name;
  const parentId = input.parentId !== undefined ? input.parentId : existing.parent_id;
  const sortOrder = input.sortOrder ?? Number(existing.sort_order);
  const isActive = input.isActive ?? existing.is_active === true;
  const externalCode =
    input.externalCode !== undefined
      ? input.externalCode?.trim()
        ? input.externalCode.trim()
        : null
      : existing.external_code;

  if (parentId === categoryId) throw new Error('validation');
  if (parentId) {
    const parents = await sql`
      SELECT id FROM catalog_categories WHERE id = ${parentId} LIMIT 1
    `;
    if (parents.length === 0) throw new Error('category_not_found');
  }

  try {
    const rows = await sql`
      UPDATE catalog_categories
      SET
        name = ${name},
        parent_id = ${parentId},
        external_code = ${externalCode},
        sort_order = ${sortOrder},
        is_active = ${isActive},
        updated_at = now()
      WHERE id = ${categoryId}
      RETURNING id, parent_id, name, external_code, sort_order, is_active, created_at, updated_at
    `;
    return serializeCategory(rows[0] as DbCategory);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(msg)) throw new Error('conflict');
    throw err;
  }
}
