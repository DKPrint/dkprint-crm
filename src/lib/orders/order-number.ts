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

/** APP_TIMEZONE with Europe/Minsk default (TZ §4.1). */
export function appTimeZone(): string {
  return process.env.APP_TIMEZONE || 'Europe/Minsk';
}

type CalendarParts = {
  year: string;
  month: string;
  day: string;
};

function calendarPartsInTimeZone(date: Date, timeZone: string): CalendarParts {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    fmt
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  );
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
  };
}

/** Parts of "now" in a given IANA timezone as YYMMDD. */
export function yymmddInTimeZone(date: Date, timeZone: string): string {
  const { year, month, day } = calendarPartsInTimeZone(date, timeZone);
  return `${year.slice(-2)}${month}${day}`;
}

/** Calendar day in APP_TIMEZONE: YYMMDD + DATE string for order_daily_sequences. */
export function calendarDay(now: Date = new Date()): {
  yymmdd: string;
  orderDate: string;
} {
  const tz = appTimeZone();
  const { year, month, day } = calendarPartsInTimeZone(now, tz);
  return {
    yymmdd: `${year.slice(-2)}${month}${day}`,
    orderDate: `${year}-${month}-${day}`,
  };
}
