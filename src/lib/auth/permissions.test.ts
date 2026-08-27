import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { can } from './permissions';
import { assertOrderAccess, ordersVisibleWhere } from './assertOrderAccess';

describe('permissions', () => {
  it('designer never cancels even with flag', () => {
    assert.equal(
      can('designer', 'cancel_order', {
        can_access_reports: false,
        can_edit_price: false,
        can_cancel_order: true,
        can_soft_delete_order: true,
        can_manage_sla: false,
      }),
      false,
    );
  });

  it('production can cancel by role', () => {
    assert.equal(can('production', 'cancel_order'), true);
  });
});

describe('assertOrderAccess', () => {
  const order = {
    client_id: 'c1',
    status: 'new',
    deleted_at: null,
  };

  it('isolates photo_center', () => {
    assert.throws(() =>
      assertOrderAccess({ id: 'u1', role: 'photo_center', clientId: 'c2' }, order),
    );
    assert.doesNotThrow(() =>
      assertOrderAccess({ id: 'u1', role: 'photo_center', clientId: 'c1' }, order),
    );
  });

  it('courier only delivery statuses', () => {
    assert.throws(() => assertOrderAccess({ id: 'u1', role: 'courier', clientId: null }, order));
    assert.doesNotThrow(() =>
      assertOrderAccess(
        { id: 'u1', role: 'courier', clientId: null },
        { ...order, status: 'ready_for_pickup' },
      ),
    );
  });

  it('soft-deleted: non-admin throws; admin with includeDeleted does not', () => {
    const deleted = { ...order, deleted_at: '2026-08-27T12:00:00Z' };
    assert.throws(() =>
      assertOrderAccess({ id: 'u1', role: 'production', clientId: null }, deleted),
    );
    assert.throws(() =>
      assertOrderAccess({ id: 'u1', role: 'photo_center', clientId: 'c1' }, deleted),
    );
    assert.throws(() => assertOrderAccess({ id: 'u1', role: 'admin', clientId: null }, deleted));
    assert.doesNotThrow(() =>
      assertOrderAccess({ id: 'u1', role: 'admin', clientId: null }, deleted, {
        includeDeleted: true,
      }),
    );
  });
});

describe('ordersVisibleWhere', () => {
  it('photo_center filters by clientId', () => {
    const w = ordersVisibleWhere({ id: 'u', role: 'photo_center', clientId: 'c1' });
    assert.equal(w.clientId, 'c1');
    assert.equal(w.excludeDeleted, true);
  });

  it('courier returns three delivery statuses + excludeDeleted', () => {
    const w = ordersVisibleWhere({ id: 'u', role: 'courier', clientId: null });
    assert.deepEqual(w.statuses, ['ready_for_pickup', 'with_courier', 'delivered']);
    assert.equal(w.excludeDeleted, true);
    assert.equal(w.clientId, undefined);
  });
});
