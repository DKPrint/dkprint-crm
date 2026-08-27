import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isInKpi, KPI_SQL_PREDICATE } from './kpi';

describe('kpi', () => {
  it('includes active non-cancelled orders', () => {
    assert.equal(isInKpi({ deleted_at: null, status: 'new' }), true);
    assert.equal(isInKpi({ deleted_at: null, status: 'delivered' }), true);
  });

  it('excludes cancelled', () => {
    assert.equal(isInKpi({ deleted_at: null, status: 'cancelled' }), false);
  });

  it('excludes soft-deleted', () => {
    assert.equal(isInKpi({ deleted_at: '2026-01-01T00:00:00Z', status: 'new' }), false);
  });

  it('exposes SQL predicate text', () => {
    assert.match(KPI_SQL_PREDICATE, /deleted_at IS NULL/);
    assert.match(KPI_SQL_PREDICATE, /cancelled/);
  });
});
