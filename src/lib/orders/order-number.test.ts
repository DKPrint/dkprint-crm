import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appTimeZone, calendarDay, formatOrderNumber, yymmddInTimeZone } from './order-number';

describe('order-number', () => {
  it('formats DK-YYMMDD-N', () => {
    assert.equal(formatOrderNumber('260826', 3), 'DK-260826-3');
  });

  it('uses APP_TIMEZONE calendar day', () => {
    // 2026-08-26 22:00 UTC → still 26th in Europe/Minsk (UTC+3) → 27th
    const d = new Date('2026-08-26T22:00:00Z');
    assert.equal(yymmddInTimeZone(d, 'Europe/Minsk'), '260827');
  });

  it('calendarDay returns yymmdd and YYYY-MM-DD in APP_TIMEZONE', () => {
    const prev = process.env.APP_TIMEZONE;
    process.env.APP_TIMEZONE = 'Europe/Minsk';
    try {
      assert.equal(appTimeZone(), 'Europe/Minsk');
      const d = new Date('2026-08-26T22:00:00Z');
      const day = calendarDay(d);
      assert.equal(day.yymmdd, '260827');
      assert.equal(day.orderDate, '2026-08-27');
      assert.equal(formatOrderNumber(day.yymmdd, 1), 'DK-260827-1');
    } finally {
      if (prev === undefined) delete process.env.APP_TIMEZONE;
      else process.env.APP_TIMEZONE = prev;
    }
  });

  it('SQL-style concat matches formatOrderNumber for sequence N', () => {
    const yymmdd = '260827';
    const seq = 42;
    const sqlStyle = `DK-${yymmdd}-${seq}`;
    assert.equal(sqlStyle, formatOrderNumber(yymmdd, seq));
  });
});
