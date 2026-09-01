import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calendarDay } from '@/lib/orders/order-number';
import { defaultReportPeriod } from '@/lib/reports/period';
import { dashboardPeriodLabel } from './queries';

describe('dashboard period', () => {
  it('uses current calendar month through today in APP_TIMEZONE', () => {
    const now = new Date('2026-09-15T12:00:00Z');
    const period = defaultReportPeriod(now);
    const { orderDate } = calendarDay(now);
    assert.equal(period.from, `${orderDate.slice(0, 7)}-01`);
    assert.equal(period.to, orderDate);
  });

  it('builds Russian month label from period.from', () => {
    assert.equal(dashboardPeriodLabel({ from: '2026-09-01', to: '2026-09-15' }), 'сентябрь 2026');
    assert.equal(dashboardPeriodLabel({ from: '2026-01-01', to: '2026-01-10' }), 'январь 2026');
  });
});
