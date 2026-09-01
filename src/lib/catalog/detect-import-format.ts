import ExcelJS from 'exceljs';
import { FC_PRICE_KNOWN_SHEETS } from './parsers/fc-price';
import { hasCrmCatalogHeaders } from './xlsx';

export type CatalogImportFormat = 'crm' | 'fc_price' | 'unknown';

/** Detect xlsx layout: CRM flat export vs FC multi-sheet price book. */
export async function detectCatalogImportFormat(buffer: Buffer): Promise<CatalogImportFormat> {
  if (process.env.CATALOG_IMPORT_FC_PRICE_FORCE === '1') return 'fc_price';

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const first = workbook.worksheets[0];
  if (first && hasCrmCatalogHeaders(first.getRow(1))) return 'crm';

  if (workbook.worksheets.length >= 2) {
    const sheetNames = workbook.worksheets
      .map((s) => s.name?.trim())
      .filter((n): n is string => Boolean(n));
    const matches = sheetNames.filter((n) => FC_PRICE_KNOWN_SHEETS.has(n)).length;
    if (matches >= 2) return 'fc_price';
  }

  return 'unknown';
}
