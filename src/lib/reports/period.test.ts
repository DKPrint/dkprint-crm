import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { defaultReportPeriod, parseReportPeriod } from './period';

describe('report period §12.4', () => {
  it('defaults to month-to-date when params missing', () => {
    const now = new Date('2026-09-15T12:00:00Z');
    const prev = process.env.APP_TIMEZONE;
    process.env.APP_TIMEZONE = 'UTC';
    try {
      const p = parseReportPeriod(new URLSearchParams(), now);
      assert.equal(p.from, '2026-09-01');
      assert.equal(p.to, '2026-09-15');
    } finally {
      if (prev === undefined) delete process.env.APP_TIMEZONE;
      else process.env.APP_TIMEZONE = prev;
    }
  });

  it('accepts valid from/to', () => {
    const p = parseReportPeriod(new URLSearchParams('from=2026-08-01&to=2026-08-31'));
    assert.deepEqual(p, { from: '2026-08-01', to: '2026-08-31' });
  });

  it('rejects from after to', () => {
    assert.throws(
      () => parseReportPeriod(new URLSearchParams('from=2026-09-10&to=2026-09-01')),
      /validation/,
    );
  });

  it('rejects invalid dates', () => {
    assert.throws(
      () => parseReportPeriod(new URLSearchParams('from=2026-13-01&to=2026-09-01')),
      /validation/,
    );
  });

  it('defaultReportPeriod uses first of month', () => {
    const prev = process.env.APP_TIMEZONE;
    process.env.APP_TIMEZONE = 'UTC';
    try {
      const p = defaultReportPeriod(new Date('2026-03-05T10:00:00Z'));
      assert.equal(p.from, '2026-03-01');
      assert.equal(p.to, '2026-03-05');
    } finally {
      if (prev === undefined) delete process.env.APP_TIMEZONE;
      else process.env.APP_TIMEZONE = prev;
    }
  });
});
