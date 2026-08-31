import Decimal from 'decimal.js';

/** Max NUMERIC(12,4): 8 digits before decimal + 4 after. */
const QTY_MAX = new Decimal('99999999.9999');

/** BOM qty_per_unit — NUMERIC(12,4), not money (TZ §14.21). */
export function formatQty4(value: string | number): string {
  const d = new Decimal(value);
  if (!d.isFinite() || d.lte(0)) throw new Error('validation');
  const rounded = d.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  if (rounded.lte(0)) throw new Error('validation');
  if (rounded.gt(QTY_MAX)) throw new Error('validation');
  return rounded.toFixed(4);
}

export function toQtyNumber(value: string | number): number {
  return new Decimal(formatQty4(value)).toNumber();
}
