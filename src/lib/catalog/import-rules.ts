import { formatMoney2 } from '@/lib/money';

/** Category row: match by external_code; existing → do not overwrite fields. */
export type CategoryImportAction = 'create' | 'skip';

/** Product row: match by external_code (TZ §13.1). */
export type ProductImportAction = 'create' | 'skip' | 'update_price';

export function resolveCategoryImport(existingId: string | null): CategoryImportAction {
  return existingId ? 'skip' : 'create';
}

/**
 * Existing product matched by external_code:
 * - default: skip (do not overwrite name/category/price)
 * - replacePrices: update unit_price only when it differs
 */
export function resolveProductImport(
  existing: { unitPrice: string | number } | null,
  fileUnitPrice: string | number,
  replacePrices: boolean,
): ProductImportAction {
  if (!existing) return 'create';
  if (!replacePrices) return 'skip';
  if (formatMoney2(existing.unitPrice) === formatMoney2(fileUnitPrice)) return 'skip';
  return 'update_price';
}

export type ImportRunCounts = {
  createdCount: number;
  updatedPriceCount: number;
  skippedCount: number;
};

export function bumpImportCounts(
  counts: ImportRunCounts,
  action: ProductImportAction,
  categoryCreated: boolean,
  subcategoryCreated: boolean,
): ImportRunCounts {
  let { createdCount, updatedPriceCount, skippedCount } = counts;
  if (categoryCreated || subcategoryCreated) createdCount += 1;
  if (action === 'create') createdCount += 1;
  else if (action === 'update_price') updatedPriceCount += 1;
  else skippedCount += 1;
  return { createdCount, updatedPriceCount, skippedCount };
}
