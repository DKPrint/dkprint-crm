import { sql } from '@/lib/db';
import { toApiNumber } from '@/lib/money';
import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import { assertCatalogAdmin } from './access';
import { bumpImportCounts, resolveProductImport, type ImportRunCounts } from './import-rules';
import { assertLeafCategory } from './categories';
import { exportableProductCode, parseCrmProductCode } from './leaf-and-code';
import { parseCatalogImportBuffer, type CatalogImportSource } from './parse-import-buffer';
import { buildCatalogXlsx, type CatalogExportRow } from './xlsx';
import type { CatalogImportRow } from './import-columns';

type DbCategory = {
  id: string;
  parent_id: string | null;
  name: string;
  external_code: string | null;
};

type DbProduct = {
  id: string;
  category_id: string;
  name: string;
  external_code: string | null;
  unit_price: string;
};

export type CatalogImportResult = {
  runId: string;
  createdCount: number;
  updatedPriceCount: number;
  skippedCount: number;
};

function codeKey(code: string | null | undefined): string | null {
  const trimmed = code?.trim();
  return trimmed ? trimmed : null;
}

async function loadCategoryByCode(): Promise<Map<string, DbCategory>> {
  const rows = (await sql`
    SELECT id, parent_id, name, external_code
    FROM catalog_categories
    WHERE external_code IS NOT NULL
  `) as DbCategory[];
  const map = new Map<string, DbCategory>();
  for (const row of rows) {
    if (row.external_code) map.set(row.external_code, row);
  }
  return map;
}

async function loadProducts(): Promise<{
  byCode: Map<string, DbProduct>;
  byId: Map<string, DbProduct>;
}> {
  const rows = (await sql`
    SELECT id, category_id, name, external_code, unit_price
    FROM catalog_products
  `) as DbProduct[];
  const byCode = new Map<string, DbProduct>();
  const byId = new Map<string, DbProduct>();
  for (const row of rows) {
    byId.set(row.id, row);
    if (row.external_code) byCode.set(row.external_code, row);
  }
  return { byCode, byId };
}

function findProductByImportCode(
  productCode: string,
  byCode: Map<string, DbProduct>,
  byId: Map<string, DbProduct>,
): DbProduct | null {
  const byExternal = byCode.get(productCode);
  if (byExternal) return byExternal;
  const crmId = parseCrmProductCode(productCode);
  if (crmId) return byId.get(crmId) ?? null;
  return null;
}

async function insertCategory(
  parentId: string | null,
  name: string,
  externalCode: string | null,
): Promise<DbCategory> {
  const rows = await sql`
    INSERT INTO catalog_categories (parent_id, name, external_code, sort_order)
    VALUES (${parentId}, ${name}, ${externalCode}, 0)
    RETURNING id, parent_id, name, external_code
  `;
  return rows[0] as DbCategory;
}

async function insertProduct(
  categoryId: string,
  name: string,
  externalCode: string | null,
  unitPrice: string,
): Promise<DbProduct> {
  await assertLeafCategory(categoryId);
  const rows = (await sql`
    INSERT INTO catalog_products (category_id, name, external_code, unit_price, is_active)
    VALUES (${categoryId}::uuid, ${name}, ${externalCode}, ${unitPrice}::numeric, true)
    RETURNING id, category_id, name, external_code, unit_price::text AS unit_price
  `) as DbProduct[];
  const row = rows[0];
  if (!row) throw new Error('product_create_failed');
  return row;
}

/** Index a product for duplicate detection within the same import run. */
export function indexImportedProduct(
  product: DbProduct,
  productKey: string,
  byCode: Map<string, DbProduct>,
  byId: Map<string, DbProduct>,
): void {
  byId.set(product.id, product);
  if (product.external_code) byCode.set(product.external_code, product);
  byCode.set(productKey, product);
}

async function updateProductPrice(productId: string, unitPrice: string): Promise<void> {
  await sql`
    UPDATE catalog_products
    SET unit_price = ${unitPrice}::numeric, updated_at = now()
    WHERE id = ${productId}::uuid
  `;
}

async function logImportRun(input: {
  userId: string;
  filename: string | null;
  replacePrices: boolean;
  counts: ImportRunCounts;
  errorMessage?: string | null;
}): Promise<string> {
  const rows = await sql`
    INSERT INTO catalog_import_runs (
      user_id,
      filename,
      replace_prices,
      created_count,
      updated_price_count,
      skipped_count,
      error_message
    )
    VALUES (
      ${input.userId}::uuid,
      ${input.filename},
      ${input.replacePrices},
      ${input.counts.createdCount},
      ${input.counts.updatedPriceCount},
      ${input.counts.skippedCount},
      ${input.errorMessage ?? null}
    )
    RETURNING id
  `;
  return (rows[0] as { id: string }).id;
}

async function ensureCategory(
  categoriesByCode: Map<string, DbCategory>,
  input: { code: string | null; name: string; parentId: string | null },
): Promise<{ category: DbCategory; created: boolean }> {
  const key = codeKey(input.code);
  if (key) {
    const existing = categoriesByCode.get(key);
    if (existing) return { category: existing, created: false };
  }
  const created = await insertCategory(input.parentId, input.name, key);
  if (key) categoriesByCode.set(key, created);
  return { category: created, created: true };
}

export async function importCatalogRows(
  user: SessionUser,
  rows: CatalogImportRow[],
  options: { filename: string | null; replacePrices: boolean },
): Promise<CatalogImportResult> {
  assertCatalogAdmin(user);
  const categoriesByCode = await loadCategoryByCode();
  const { byCode: productsByCode, byId: productsById } = await loadProducts();

  let counts: ImportRunCounts = {
    createdCount: 0,
    updatedPriceCount: 0,
    skippedCount: 0,
  };

  try {
    for (const row of rows) {
      const root = await ensureCategory(categoriesByCode, {
        code: row.categoryCode,
        name: row.categoryName,
        parentId: null,
      });

      let leaf = root.category;
      let subCreated = false;
      const subKey = codeKey(row.subcategoryCode);
      const subName = row.subcategoryName?.trim();
      if (subKey || subName) {
        const sub = await ensureCategory(categoriesByCode, {
          code: row.subcategoryCode,
          name: subName || subKey || row.categoryName,
          parentId: root.category.id,
        });
        leaf = sub.category;
        subCreated = sub.created;
      }

      const productKey = row.productCode.trim();
      const existing = findProductByImportCode(productKey, productsByCode, productsById);
      const action = resolveProductImport(
        existing ? { unitPrice: existing.unit_price } : null,
        row.unitPrice,
        options.replacePrices,
      );

      if (action === 'create') {
        // crm:{uuid} is export-only; do not persist it as external_code.
        const externalToStore = parseCrmProductCode(productKey) ? null : productKey;
        const created = await insertProduct(
          leaf.id,
          row.productName,
          externalToStore,
          row.unitPrice,
        );
        indexImportedProduct(created, productKey, productsByCode, productsById);
      } else if (action === 'update_price' && existing) {
        await updateProductPrice(existing.id, row.unitPrice);
        existing.unit_price = row.unitPrice;
      }

      counts = bumpImportCounts(counts, action, root.created, subCreated);
    }

    const runId = await logImportRun({
      userId: user.id,
      filename: options.filename,
      replacePrices: options.replacePrices,
      counts,
    });

    return { runId, ...counts };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const runId = await logImportRun({
      userId: user.id,
      filename: options.filename,
      replacePrices: options.replacePrices,
      counts,
      errorMessage: message,
    });
    throw Object.assign(new Error(message), { runId, counts });
  }
}

export async function importCatalogXlsx(
  user: SessionUser,
  buffer: Buffer,
  options: {
    filename: string | null;
    replacePrices: boolean;
    source?: CatalogImportSource;
  },
): Promise<CatalogImportResult> {
  const { rows } = await parseCatalogImportBuffer(buffer, options.source ?? 'auto');
  return importCatalogRows(user, rows, options);
}

export async function exportCatalogXlsx(user: SessionUser): Promise<Buffer> {
  assertCatalogAdmin(user);
  const categories = (await sql`
    SELECT id, parent_id, name, external_code
    FROM catalog_categories
    ORDER BY sort_order ASC, name ASC
  `) as DbCategory[];

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const products = (await sql`
    SELECT id, category_id, name, external_code, unit_price
    FROM catalog_products
    ORDER BY name ASC
  `) as DbProduct[];

  const exportRows: CatalogExportRow[] = products.map((p) => {
    const productCode = exportableProductCode(p.external_code, p.id);
    const leaf = categoryById.get(p.category_id);
    if (!leaf) {
      return {
        categoryCode: null,
        categoryName: '—',
        subcategoryCode: null,
        subcategoryName: null,
        productCode,
        productName: p.name,
        unitPrice: toApiNumber(p.unit_price),
      };
    }

    if (leaf.parent_id) {
      const root = categoryById.get(leaf.parent_id);
      return {
        categoryCode: root?.external_code ?? null,
        categoryName: root?.name ?? leaf.name,
        subcategoryCode: leaf.external_code,
        subcategoryName: leaf.name,
        productCode,
        productName: p.name,
        unitPrice: toApiNumber(p.unit_price),
      };
    }

    return {
      categoryCode: leaf.external_code,
      categoryName: leaf.name,
      subcategoryCode: null,
      subcategoryName: null,
      productCode,
      productName: p.name,
      unitPrice: toApiNumber(p.unit_price),
    };
  });

  return buildCatalogXlsx(exportRows);
}
