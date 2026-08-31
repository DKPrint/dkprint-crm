/**
 * Catalog import/export xlsx columns (TZ §13.1).
 * Canonical header row — first sheet, row 1. Values only (no formula execution).
 */
export const CATALOG_XLSX_COLUMNS = [
  'category_code',
  'category_name',
  'subcategory_code',
  'subcategory_name',
  'product_code',
  'product_name',
  'unit_price',
] as const;

export type CatalogXlsxColumn = (typeof CATALOG_XLSX_COLUMNS)[number];

/** Russian / alternate headers accepted on import (case-insensitive). */
export const CATALOG_XLSX_HEADER_ALIASES: Record<CatalogXlsxColumn, readonly string[]> = {
  category_code: ['код_категории', 'код категории'],
  category_name: ['категория', 'название_категории', 'название категории'],
  subcategory_code: ['код_подкатегории', 'код подкатегории'],
  subcategory_name: ['подкатегория', 'название_подкатегории', 'название подкатегории'],
  product_code: ['код', 'sku', 'артикул', 'код_товара', 'код товара'],
  product_name: ['наименование', 'название', 'товар'],
  unit_price: ['цена', 'price', 'unit price'],
};

export const CATALOG_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

export const CATALOG_IMPORT_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);

export type CatalogImportRow = {
  rowNumber: number;
  categoryCode: string | null;
  categoryName: string;
  subcategoryCode: string | null;
  subcategoryName: string | null;
  productCode: string;
  productName: string;
  unitPrice: string;
};
