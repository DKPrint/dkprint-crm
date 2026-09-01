import { calendarDay } from '@/lib/orders/order-number';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ReportPeriod = {
  from: string;
  to: string;
};

function isValidYmd(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d;
}

/** Default: first day of current month → today in APP_TIMEZONE. */
export function defaultReportPeriod(now: Date = new Date()): ReportPeriod {
  const { orderDate } = calendarDay(now);
  const from = `${orderDate.slice(0, 7)}-01`;
  return { from, to: orderDate };
}

/**
 * Parse from/to query params. Missing either → month-to-date default.
 * Throws Error('validation') when dates invalid or from > to.
 */
export function parseReportPeriod(
  searchParams: URLSearchParams,
  now: Date = new Date(),
): ReportPeriod {
  const rawFrom = searchParams.get('from')?.trim() || null;
  const rawTo = searchParams.get('to')?.trim() || null;

  if (!rawFrom && !rawTo) {
    return defaultReportPeriod(now);
  }

  const from = rawFrom ?? defaultReportPeriod(now).from;
  const to = rawTo ?? defaultReportPeriod(now).to;

  if (!isValidYmd(from) || !isValidYmd(to)) {
    throw new Error('validation', { cause: 'invalid_date' });
  }
  if (from > to) {
    throw new Error('validation', { cause: 'from_after_to' });
  }
  return { from, to };
}
