import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatOrderNumber, yymmddInTimeZone } from './order-number';

describe('order-number', () => {
  it('formats DK-YYMMDD-N', () => {
    assert.equal(formatOrderNumber('260826', 3), 'DK-260826-3');
  });

  it('uses APP_TIMEZONE calendar day', () => {
    // 2026-08-26 22:00 UTC → still 26th in Europe/Minsk (UTC+3)
    const d = new Date('2026-08-26T22:00:00Z');
    assert.equal(yymmddInTimeZone(d, 'Europe/Minsk'), '260827');
  });
});
