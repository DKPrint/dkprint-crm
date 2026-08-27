import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calendarDay, formatOrderNumber } from './order-number';

/**
 * In-memory mock of order_daily_sequences upsert (create-order.ts SQL):
 *   INSERT … VALUES (date, 1)
 *   ON CONFLICT DO UPDATE SET last_sequence = last_sequence + 1
 *   RETURNING last_sequence
 * Production source of truth remains the SQL CTE — this only documents semantics.
 */
function nextDailySequence(store: Map<string, number>, orderDate: string): number {
  const next = (store.get(orderDate) ?? 0) + 1;
  store.set(orderDate, next);
  return next;
}

describe('create-order number allocation (pure)', () => {
  it('sequence N produces DK-YYMMDD-N', () => {
    assert.equal(formatOrderNumber('260827', 1), 'DK-260827-1');
    assert.equal(formatOrderNumber('260827', 7), 'DK-260827-7');
    // Mirrors SQL: 'DK-' || yymmdd || '-' || last_sequence::text
    const yymmdd = '260901';
    const lastSequence = 12;
    assert.equal(`DK-${yymmdd}-${lastSequence}`, formatOrderNumber(yymmdd, lastSequence));
  });

  it('daily sequence upsert: first insert → 1, conflict → +1', () => {
    const store = new Map<string, number>();
    const orderDate = '2026-08-27';
    const yymmdd = '260827';

    const seq1 = nextDailySequence(store, orderDate);
    assert.equal(seq1, 1);
    assert.equal(formatOrderNumber(yymmdd, seq1), 'DK-260827-1');

    const seq2 = nextDailySequence(store, orderDate);
    assert.equal(seq2, 2);
    assert.equal(formatOrderNumber(yymmdd, seq2), 'DK-260827-2');

    assert.equal(store.get(orderDate), 2);
  });

  it('concurrent-ish sequential calls for same day yield 1 then 2', () => {
    const store = new Map<string, number>();
    const orderDate = '2026-08-27';
    const yymmdd = '260827';

    // Simulate two callers racing on the same date: sequential atomic increments
    const a = nextDailySequence(store, orderDate);
    const b = nextDailySequence(store, orderDate);

    assert.deepEqual([a, b], [1, 2]);
    assert.equal(formatOrderNumber(yymmdd, a), 'DK-260827-1');
    assert.equal(formatOrderNumber(yymmdd, b), 'DK-260827-2');
  });

  it('different calendar days have independent sequences', () => {
    const store = new Map<string, number>();
    assert.equal(nextDailySequence(store, '2026-08-27'), 1);
    assert.equal(nextDailySequence(store, '2026-08-28'), 1);
    assert.equal(nextDailySequence(store, '2026-08-27'), 2);
  });

  it('calendarDay + formatOrderNumber align with APP_TIMEZONE day key', () => {
    const prev = process.env.APP_TIMEZONE;
    process.env.APP_TIMEZONE = 'Europe/Minsk';
    try {
      const store = new Map<string, number>();
      const day = calendarDay(new Date('2026-08-26T22:00:00Z'));
      const seq = nextDailySequence(store, day.orderDate);
      assert.equal(day.yymmdd, '260827');
      assert.equal(day.orderDate, '2026-08-27');
      assert.equal(formatOrderNumber(day.yymmdd, seq), 'DK-260827-1');
    } finally {
      if (prev === undefined) delete process.env.APP_TIMEZONE;
      else process.env.APP_TIMEZONE = prev;
    }
  });
});
