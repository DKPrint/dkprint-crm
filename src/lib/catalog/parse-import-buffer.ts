import type { CatalogImportRow } from './import-columns';
import { detectCatalogImportFormat } from './detect-import-format';
import { parseFcPriceXlsx } from './parsers/fc-price';
import { parseCatalogXlsx } from './xlsx';

export type CatalogImportSource = 'auto' | 'crm' | 'fc_price';

export type ParsedCatalogImport = {
  format: 'crm' | 'fc_price';
  rows: CatalogImportRow[];
  warnings: string[];
};

async function resolveFormat(
  buffer: Buffer,
  source: CatalogImportSource,
): Promise<'crm' | 'fc_price'> {
  if (source === 'crm') return 'crm';
  if (source === 'fc_price') return 'fc_price';
  const detected = await detectCatalogImportFormat(buffer);
  if (detected === 'unknown') throw new Error('unknown_import_format');
  return detected;
}

/** Parse import buffer (auto-detect or forced source). */
export async function parseCatalogImportBuffer(
  buffer: Buffer,
  source: CatalogImportSource = 'auto',
): Promise<ParsedCatalogImport> {
  const format = await resolveFormat(buffer, source);
  if (format === 'crm') {
    const rows = await parseCatalogXlsx(buffer);
    return { format: 'crm', rows, warnings: [] };
  }
  const { rows, warnings } = await parseFcPriceXlsx(buffer);
  return { format: 'fc_price', rows, warnings };
}

export type CatalogImportPreviewStats = {
  rows: number;
  categories: number;
  subcategories: number;
  products: number;
};

export function buildCatalogImportPreview(
  format: 'crm' | 'fc_price',
  rows: CatalogImportRow[],
  warnings: string[],
  sampleSize = 20,
) {
  const categoryNames = new Set(rows.map((r) => r.categoryName));
  const subcategoryNames = new Set(
    rows.map((r) => r.subcategoryName?.trim()).filter((n): n is string => Boolean(n)),
  );

  return {
    format,
    stats: {
      rows: rows.length,
      categories: categoryNames.size,
      subcategories: subcategoryNames.size,
      products: rows.length,
    } satisfies CatalogImportPreviewStats,
    warnings,
    sample: rows.slice(0, sampleSize),
  };
}
