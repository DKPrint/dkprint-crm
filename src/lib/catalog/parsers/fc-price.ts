/**
 * Parse «Прайс ФЦ» multi-sheet matrix xlsx → flat CatalogImportRow[] (TZ §13.1).
 */
import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import { formatMoney2 } from '@/lib/money';
import type { CatalogImportRow } from '../import-columns';

/** Known worksheet names in FC price workbooks (9 sheets). */
export const FC_PRICE_KNOWN_SHEETS = new Set([
  'Фотопечать',
  'Распечатка',
  'Сувенирка',
  'Полиграфия',
  'Широкоформатка+УФ',
  'Медальоны',
  'Фотокниги',
  'Готовая продукция',
  'Шары и упаковка',
]);

type ParsedItem = {
  category: string;
  subcategory: string;
  name: string;
  price: string;
};

const NOISE = [
  'скидка',
  'печать выполняется',
  'обращаем внимание',
  'утвержден',
  'прейскурант',
  'срок изготовления',
  'гарантийный',
  'стоимость двухсторонней',
  'нанесение изображения методом',
  'в стоимость готового изделия',
];

function cellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v == null) return null;
  if (typeof v === 'object' && v !== null && 'result' in v) {
    return (v as { result: unknown }).result;
  }
  if (typeof v === 'object' && v !== null && 'text' in v) {
    return (v as { text: string }).text;
  }
  if (v instanceof Date) return v.toISOString();
  return v;
}

function cellStr(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object' && v !== null && 'richText' in v) {
    const parts = (v as ExcelJS.CellRichTextValue).richText;
    return parts
      .map((t) => t.text ?? '')
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const raw = cellValue(cell);
  if (raw == null) return '';
  return String(raw).replace(/\s+/g, ' ').trim();
}

function isNoise(text: string): boolean {
  const t = text.toLowerCase();
  return NOISE.some((n) => t.includes(n));
}

function parsePriceTokens(raw: string): string[] {
  const s = raw.trim();
  if (!s) return [];
  if (/^от\s+/i.test(s)) return [s.replace(/\s+/g, ' ')];
  if (s.includes('/')) {
    const parts = s.split('/').map((p) => p.trim());
    const out: string[] = [];
    for (const p of parts) {
      const n = normalizePrice(p);
      if (n) out.push(n);
    }
    if (out.length > 0) return out;
  }
  const one = normalizePrice(s);
  return one ? [one] : [];
}

function normalizePrice(raw: string): string | null {
  let s = raw.trim().replace(/\s+/g, '').replace(',', '.');
  s = s.replace(/руб\.?$/i, '').replace(/br$/i, '');
  if (!s) return null;
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    if (/^от\d/i.test(s)) return raw.trim();
    return null;
  }
  try {
    return formatMoney2(s);
  } catch {
    return null;
  }
}

function isNumericCell(cell: ExcelJS.Cell): boolean {
  const v = cellValue(cell);
  if (typeof v === 'number') return true;
  return parsePriceTokens(cellStr(cell)).length > 0;
}

function looksLikeSection(text: string): boolean {
  if (!text || text.length < 3 || isNoise(text)) return false;
  if (parsePriceTokens(text).length > 0) return false;
  if (text.length > 130) return false;
  const letters = [...text].filter((c) => /[a-zA-Zа-яА-ЯёЁ]/.test(c));
  if (letters.length === 0) return false;
  const upper = letters.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length;
  if (upper / letters.length > 0.65) return true;
  const markers = [
    'ПЕЧАТЬ',
    'СКАН',
    'ЛАМИН',
    'ФОТО',
    'КАЛЕНД',
    'БЛОКН',
    'БЕЙДЖ',
    'ТЕКСТИЛ',
    'ГЕЛИЕВ',
    'УПАКОВ',
    'ОФОРМЛ',
    'LAYFLAT',
    'ФОТОКНИГ',
    'ФОТОЖУРН',
    'ВИЗИТК',
    'МЕДАЛ',
    'РАМК',
  ];
  const tu = text.toUpperCase();
  return markers.some((m) => tu.includes(m)) && text.length < 100;
}

function slugCode(text: string, maxLen = 48): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (base) return base.slice(0, maxLen).replace(/-$/, '');
  return createHash('sha1').update(text).digest('hex').slice(0, Math.min(maxLen, 16));
}

function productCode(category: string, subcategory: string, name: string, price: string): string {
  const key = `${category}|${subcategory}|${name}|${price}`;
  const hash = createHash('sha1').update(key).digest('hex').slice(0, 8);
  const prefix = slugCode(category, 16);
  const sub = subcategory ? slugCode(subcategory, 12) : 'root';
  return `${prefix}-${sub}-${hash}`;
}

function itemKey(item: ParsedItem): string {
  return `${item.category}\0${item.subcategory}\0${item.name}\0${item.price}`;
}

function addItem(items: ParsedItem[], seen: Set<string>, item: ParsedItem): void {
  if (!item.name.trim() || !item.price.trim()) return;
  const key = itemKey(item);
  if (seen.has(key)) return;
  seen.add(key);
  items.push(item);
}

function parseCanvasMatrixRow(
  category: string,
  subsection: string,
  row: ExcelJS.Row,
  items: ParsedItem[],
  seen: Set<string>,
): void {
  const pairs: Array<[number, number]> = [
    [1, 2],
    [3, 4],
    [5, 6],
    [7, 8],
  ];
  for (const [fmtCol, priceCol] of pairs) {
    const fmt = cellStr(row.getCell(fmtCol));
    const prices = parsePriceTokens(cellStr(row.getCell(priceCol)));
    if (!fmt || prices.length === 0) continue;
    if (fmt.toLowerCase().includes('формат') || fmt.toLowerCase().includes('стоимость')) continue;
    for (const price of prices) {
      addItem(items, seen, {
        category,
        subcategory: subsection,
        name: `${fmt} см`,
        price,
      });
    }
  }
}

function parseReadyMadeRow(
  category: string,
  subsection: string,
  row: ExcelJS.Row,
  items: ParsedItem[],
  seen: Set<string>,
): void {
  for (const [nameCol, priceCol] of [
    [1, 3],
    [4, 6],
  ] as const) {
    const name = cellStr(row.getCell(nameCol));
    const prices = parsePriceTokens(cellStr(row.getCell(priceCol)));
    if (!name || prices.length === 0 || isNoise(name)) continue;
    for (const price of prices) {
      addItem(items, seen, { category, subcategory: subsection, name, price });
    }
  }
}

function parseStandardSheet(sheet: ExcelJS.Worksheet, category: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const seen = new Set<string>();
  let section = category;
  let subsection = '';
  let colHeaders: Record<number, string> = {};
  let inCanvas = false;

  for (let r = 1; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const vals: Record<number, string> = {};
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const s = cellStr(cell);
      if (s) vals[col] = s;
    });
    if (Object.keys(vals).length === 0) continue;

    const c1 = vals[1] ?? '';
    const rowHasPrice = Object.keys(vals).some((c) => {
      const n = Number(c);
      return n !== 1 && isNumericCell(row.getCell(n));
    });

    if (c1 === 'КАРТИНЫ НА ХОЛСТЕ') {
      inCanvas = true;
      subsection = c1;
      colHeaders = {};
      continue;
    }
    if (inCanvas && c1.toLowerCase().includes('формат') && !rowHasPrice) {
      continue;
    }
    if (inCanvas && rowHasPrice) {
      parseCanvasMatrixRow(category, subsection, row, items, seen);
      continue;
    }
    if (inCanvas && c1 && !rowHasPrice) {
      inCanvas = false;
    }

    if (category === 'Готовая продукция') {
      parseReadyMadeRow(category, subsection || section, row, items, seen);
      if (
        Object.keys(vals).some((c) => {
          const n = Number(c);
          return (n === 3 || n === 6) && parsePriceTokens(vals[n] ?? '').length > 0;
        })
      ) {
        continue;
      }
    }

    const headerCandidates = Object.fromEntries(
      Object.entries(vals).filter(([c, v]) => c !== '1' && !parsePriceTokens(v).length),
    );
    if (Object.keys(headerCandidates).length > 0 && !rowHasPrice && c1 && !looksLikeSection(c1)) {
      colHeaders = Object.fromEntries(
        Object.entries(headerCandidates).map(([k, v]) => [Number(k), v]),
      );
      continue;
    }
    if (Object.keys(headerCandidates).length > 0 && !c1 && !rowHasPrice) {
      colHeaders = Object.fromEntries(
        Object.entries(headerCandidates).map(([k, v]) => [Number(k), v]),
      );
      continue;
    }

    if (c1 && looksLikeSection(c1) && !rowHasPrice) {
      if (section === category || c1 === c1.toUpperCase()) {
        section = c1;
        subsection = '';
      } else {
        subsection = c1;
      }
      colHeaders = {};
      continue;
    }

    if (isNoise(c1)) continue;
    if (!rowHasPrice) continue;

    for (const colStr of Object.keys(vals)) {
      const col = Number(colStr);
      if (col === 1) continue;
      const prices = parsePriceTokens(vals[col] ?? '');
      if (prices.length === 0) continue;

      const colHeader = colHeaders[col] ?? '';
      const skipHeaders = new Set(['стоимость', 'цена', 'формат', '2026-10-01 00:00:00']);

      for (const price of prices) {
        const parts: string[] = [];
        if (c1) parts.push(c1);
        for (const mc of Object.keys(vals)
          .map(Number)
          .sort((a, b) => a - b)) {
          if (mc <= 1 || mc >= col) continue;
          if (parsePriceTokens(vals[mc] ?? '').length > 0) continue;
          const t = vals[mc] ?? '';
          if (t && !parts.includes(t)) parts.push(t);
        }
        if (colHeader && !skipHeaders.has(colHeader.toLowerCase()) && !parts.includes(colHeader)) {
          parts.push(colHeader);
        }
        const name = parts.join(' — ') || category;
        addItem(items, seen, {
          category,
          subcategory: subsection || (section !== category ? section : ''),
          name,
          price,
        });
      }
    }
  }

  return items;
}

function collectWarnings(items: ParsedItem[], emptySheets: string[]): string[] {
  const warnings: string[] = [];
  for (const sheet of emptySheets) {
    warnings.push(`Лист «${sheet}»: позиций не найдено`);
  }
  const approx = items.filter((i) => /^от\s/i.test(i.price)).length;
  if (approx > 0) {
    warnings.push(`Цены «от …»: ${approx} позиций (точная сумма не зафиксирована)`);
  }
  return warnings;
}

/** Parse FC price workbook buffer into CRM import rows. */
export async function parseFcPriceXlsx(
  buffer: Buffer,
): Promise<{ rows: CatalogImportRow[]; warnings: string[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const all: ParsedItem[] = [];
  const emptySheets: string[] = [];

  for (const sheet of workbook.worksheets) {
    if (!sheet.name) continue;
    const parsed = parseStandardSheet(sheet, sheet.name);
    if (parsed.length === 0) emptySheets.push(sheet.name);
    all.push(...parsed);
  }

  if (all.length === 0) throw new Error('no_data_rows');

  const warnings = collectWarnings(all, emptySheets);
  const rows: CatalogImportRow[] = all.map((item, index) => ({
    rowNumber: index + 2,
    categoryCode: slugCode(item.category, 32),
    categoryName: item.category,
    subcategoryCode: item.subcategory ? slugCode(item.subcategory, 32) : null,
    subcategoryName: item.subcategory || null,
    productCode: productCode(item.category, item.subcategory, item.name, item.price),
    productName: item.name,
    unitPrice: item.price.startsWith('от') ? item.price : formatMoney2(item.price),
  }));

  return { rows, warnings };
}
