import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/** Canonical money helpers — never use IEEE float for sums (TZ §8). */
export function lineTotal(quantity: number, unitPrice: string | number): Decimal {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('quantity must be a positive integer');
  }
  return new Decimal(unitPrice).times(quantity).toDecimalPlaces(2);
}

export function sumLineTotals(amounts: Array<string | number | Decimal>): Decimal {
  let acc = new Decimal(0);
  for (const v of amounts) {
    acc = acc.plus(v);
  }
  return acc.toDecimalPlaces(2);
}

/** API / JSON: number with 2 decimal places. */
export function toApiNumber(value: Decimal | string | number): number {
  return new Decimal(value).toDecimalPlaces(2).toNumber();
}

export function formatMoney2(value: Decimal | string | number): string {
  return new Decimal(value).toFixed(2);
}
