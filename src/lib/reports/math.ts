import Decimal from 'decimal.js';
import { toApiNumber } from '@/lib/money';

/** Safe percent: 0 when total is 0. */
export function ratePct(part: number, total: number): number {
  if (total <= 0) return 0;
  return toApiNumber(new Decimal(part).times(100).div(total));
}
