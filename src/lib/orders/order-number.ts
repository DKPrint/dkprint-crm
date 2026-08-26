/**
 * Format DK-YYMMDD-N for a calendar date in APP_TIMEZONE (TZ §4.1).
 * Sequence allocation is DB-side (order_daily_sequences); this only formats.
 */
export function formatOrderNumber(orderDateYmd: string, sequence: number): string {
  // orderDateYmd = YYMMDD
  if (!/^\d{6}$/.test(orderDateYmd)) {
    throw new Error('invalid_order_date');
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error('invalid_sequence');
  }
  return `DK-${orderDateYmd}-${sequence}`;
}

/** Parts of "now" in a given IANA timezone as YYMMDD. */
export function yymmddInTimeZone(date: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    fmt
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}${parts.month}${parts.day}`;
}
