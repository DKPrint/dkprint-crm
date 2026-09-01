import ExcelJS from 'exceljs';
import { formatMoney2 } from '@/lib/money';
import {
  CATALOG_XLSX_COLUMNS,
  CATALOG_XLSX_HEADER_ALIASES,
  type CatalogImportRow,
  type CatalogXlsxColumn,
} from './import-columns';

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function columnIndexByHeader(headerRow: ExcelJS.Row): Map<CatalogXlsxColumn, number> {
  const map = new Map<CatalogXlsxColumn, number>();
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const raw = normalizeHeader(cell.value);
    if (!raw) return;
    for (const col of CATALOG_XLSX_COLUMNS) {
      if (raw === col || CATALOG_XLSX_HEADER_ALIASES[col].some((a) => raw === a)) {
        map.set(col, colNumber);
      }
    }
  });
  return map;
}

function cellText(row: ExcelJS.Row, col: number | undefined): string {
  if (!col) return '';
  const value = row.getCell(col).value;
  if (value == null) return '';
  if (typeof value === 'object' && value !== null && 'text' in value) {
    return String((value as { text: string }).text).trim();
  }
  if (typeof value === 'object' && value !== null && 'result' in value) {
    return String((value as { result: unknown }).result ?? '').trim();
  }
  return String(value).trim();
}

function parsePrice(raw: string, rowNumber: number): string {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  if (!cleaned) throw new Error(`invalid_price_row_${rowNumber}`);
  try {
    return formatMoney2(cleaned);
  } catch {
    throw new Error(`invalid_price_row_${rowNumber}`);
  }
}

/** Parse first worksheet; values only (no formula evaluation). */
export async function parseCatalogXlsx(buffer: Buffer): Promise<CatalogImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) throw new Error('empty_workbook');

  const headerRow = sheet.getRow(1);
  const cols = columnIndexByHeader(headerRow);
  for (const required of ['product_code', 'product_name', 'unit_price'] as const) {
    if (!cols.has(required)) throw new Error(`missing_column_${required}`);
  }

  const rows: CatalogImportRow[] = [];
  for (let i = 2; i <= sheet.rowCount; i += 1) {
    const row = sheet.getRow(i);
    const productCode = cellText(row, cols.get('product_code'));
    const productName = cellText(row, cols.get('product_name'));
    const priceRaw = cellText(row, cols.get('unit_price'));
    if (!productCode && !productName && !priceRaw) continue;
    if (!productCode) throw new Error(`missing_product_code_row_${i}`);
    if (!productName) throw new Error(`missing_product_name_row_${i}`);

    const categoryName = cellText(row, cols.get('category_name'));
    if (!categoryName) throw new Error(`missing_category_name_row_${i}`);

    rows.push({
      rowNumber: i,
      categoryCode: cellText(row, cols.get('category_code')) || null,
      categoryName,
      subcategoryCode: cellText(row, cols.get('subcategory_code')) || null,
      subcategoryName: cellText(row, cols.get('subcategory_name')) || null,
      productCode,
      productName,
      unitPrice: parsePrice(priceRaw, i),
    });
  }

  if (rows.length === 0) throw new Error('no_data_rows');
  return rows;
}

export type CatalogExportRow = {
  categoryCode: string | null;
  categoryName: string;
  subcategoryCode: string | null;
  subcategoryName: string | null;
  productCode: string;
  productName: string;
  unitPrice: number;
};

export async function buildCatalogXlsx(rows: CatalogExportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('catalog');
  sheet.addRow([...CATALOG_XLSX_COLUMNS]);
  for (const row of rows) {
    sheet.addRow([
      row.categoryCode ?? '',
      row.categoryName,
      row.subcategoryCode ?? '',
      row.subcategoryName ?? '',
      row.productCode,
      row.productName,
      formatMoney2(row.unitPrice),
    ]);
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
