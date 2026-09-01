/**
 * Parse «Прайс ФЦ *.xlsx» (multi-sheet matrix layout) → flat CSV for review + CRM import xlsx.
 *
 * Usage:
 *   npm run parse:fc-price [path/to/file.xlsx]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { parseFcPriceXlsx } from '../src/lib/catalog/parsers/fc-price';
import { buildCatalogXlsx } from '../src/lib/catalog/xlsx';

const DEFAULT_INPUT = resolve(process.cwd(), '../Downloads/Прайс ФЦ 01.09.2026.xlsx');

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(','));
  }
  return `\ufeff${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const inputPath = resolve(process.argv[2] ?? process.env.FC_PRICE_XLSX ?? DEFAULT_INPUT);
  const baseName = basename(inputPath, '.xlsx').replace(/\s+/g, '-');
  const parsedOut = resolve(process.cwd(), `docs/${baseName}-parsed.csv`);
  const importOut = resolve(process.cwd(), `docs/${baseName}-import.xlsx`);

  const buffer = readFileSync(inputPath);
  const { rows, warnings } = await parseFcPriceXlsx(buffer);

  const parsedRows = rows.map((r) => [
    r.categoryName,
    r.subcategoryName ?? '',
    r.productName,
    r.unitPrice,
  ]);
  writeFileSync(parsedOut, toCsv(['category', 'subcategory', 'name', 'price'], parsedRows), 'utf8');

  const importRows = rows.map((r) => ({
    categoryCode: r.categoryCode,
    categoryName: r.categoryName,
    subcategoryCode: r.subcategoryCode,
    subcategoryName: r.subcategoryName,
    productCode: r.productCode,
    productName: r.productName,
    unitPrice: Number.parseFloat(r.unitPrice.startsWith('от') ? '0' : r.unitPrice),
  }));
  const importBuffer = await buildCatalogXlsx(importRows);
  writeFileSync(importOut, importBuffer);

  console.log(`Input:  ${inputPath}`);
  console.log(`Parsed: ${parsedOut} (${rows.length} rows)`);
  console.log(`Import: ${importOut} (CRM xlsx)`);
  if (warnings.length > 0) {
    console.log('Warnings:');
    for (const w of warnings) console.log(`  - ${w}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
