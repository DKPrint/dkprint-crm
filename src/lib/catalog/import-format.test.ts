import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectCatalogImportFormat } from './detect-import-format';
import { parseFcPriceXlsx } from './parsers/fc-price';
import { parseCatalogImportBuffer, buildCatalogImportPreview } from './parse-import-buffer';
import { parseCatalogXlsx } from './xlsx';

const GOLDEN_IMPORT = resolve(process.cwd(), 'docs/Прайс-ФЦ-01.09.2026-import.xlsx');
const FC_SOURCE =
  process.env.FC_PRICE_XLSX ?? resolve(process.cwd(), '../Downloads/Прайс ФЦ 01.09.2026.xlsx');

describe('detectCatalogImportFormat', () => {
  it('detects CRM flat export xlsx', async () => {
    assert.ok(existsSync(GOLDEN_IMPORT), 'golden import xlsx missing');
    const buffer = readFileSync(GOLDEN_IMPORT);
    assert.equal(await detectCatalogImportFormat(buffer), 'crm');
  });

  it('detects FC price multi-sheet xlsx', async () => {
    if (!existsSync(FC_SOURCE)) {
      console.log('skip: FC source xlsx not found');
      return;
    }
    const buffer = readFileSync(FC_SOURCE);
    assert.equal(await detectCatalogImportFormat(buffer), 'fc_price');
  });

  it('returns unknown for non-catalog xlsx', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('data').addRow(['foo', 'bar']);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    assert.equal(await detectCatalogImportFormat(buf), 'unknown');
  });
});

describe('parseFcPriceXlsx golden', () => {
  it('parses FC source into 553 rows matching golden CRM export count', async () => {
    if (!existsSync(FC_SOURCE)) {
      console.log('skip: FC source xlsx not found');
      return;
    }
    assert.ok(existsSync(GOLDEN_IMPORT), 'golden import xlsx missing');

    const fcBuffer = readFileSync(FC_SOURCE);
    const { rows, warnings } = await parseFcPriceXlsx(fcBuffer);
    assert.equal(rows.length, 553);
    assert.ok(Array.isArray(warnings));

    const goldenRows = await parseCatalogXlsx(readFileSync(GOLDEN_IMPORT));
    assert.equal(goldenRows.length, 553);
    assert.equal(rows.length, goldenRows.length);
  });

  it('buildCatalogImportPreview stats for FC parse', async () => {
    if (!existsSync(FC_SOURCE)) return;
    const { rows, warnings } = await parseFcPriceXlsx(readFileSync(FC_SOURCE));
    const preview = buildCatalogImportPreview('fc_price', rows, warnings);
    assert.equal(preview.format, 'fc_price');
    assert.equal(preview.stats.rows, 553);
    assert.equal(preview.stats.products, 553);
    assert.equal(preview.stats.categories, 9);
    assert.equal(preview.sample.length, 20);
  });
});

describe('parseCatalogImportBuffer', () => {
  it('auto-parses golden CRM import', async () => {
    const buffer = readFileSync(GOLDEN_IMPORT);
    const parsed = await parseCatalogImportBuffer(buffer, 'auto');
    assert.equal(parsed.format, 'crm');
    assert.equal(parsed.rows.length, 553);
  });

  it('throws unknown_import_format for forced crm on FC source', async () => {
    if (!existsSync(FC_SOURCE)) return;
    await assert.rejects(
      () => parseCatalogImportBuffer(readFileSync(FC_SOURCE), 'crm'),
      (err: Error) => err.message.includes('missing_column'),
    );
  });
});
