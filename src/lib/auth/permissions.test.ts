import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { can, emptyPermissionFlags } from './permissions';
import { assertOrderAccess, ordersVisibleWhere } from './assertOrderAccess';

const allFlagsTrue = {
  ...emptyPermissionFlags,
  can_access_reports: true,
  can_edit_price: true,
  can_cancel_order: true,
  can_soft_delete_order: true,
  can_manage_sla: true,
};

describe('permissions', () => {
  it('designer never cancels even with flag', () => {
    assert.equal(can('designer', 'cancel_order', allFlagsTrue), false);
  });

  it('designer never soft-deletes even with flag', () => {
    assert.equal(can('designer', 'soft_delete_order', allFlagsTrue), false);
  });

  it('production can cancel by role', () => {
    assert.equal(can('production', 'cancel_order'), true);
  });

  it('photo_center cancel without flag is false; with flag is true', () => {
    assert.equal(can('photo_center', 'cancel_order'), false);
    assert.equal(
      can('photo_center', 'cancel_order', {
        ...emptyPermissionFlags,
        can_cancel_order: true,
      }),
      true,
    );
  });

  it('designer + can_edit_price → edit_price = false', () => {
    assert.equal(can('designer', 'edit_price', allFlagsTrue), false);
  });

  it('photo_center + can_edit_price → edit_price = false', () => {
    assert.equal(can('photo_center', 'edit_price', allFlagsTrue), false);
  });

  it('courier + can_edit_price → edit_price = false', () => {
    assert.equal(can('courier', 'edit_price', allFlagsTrue), false);
  });

  it('production without flag → edit_price = false', () => {
    assert.equal(can('production', 'edit_price'), false);
  });

  it('production with can_edit_price → edit_price = true', () => {
    assert.equal(
      can('production', 'edit_price', {
        ...emptyPermissionFlags,
        can_edit_price: true,
      }),
      true,
    );
  });

  it('admin → edit_price = true', () => {
    assert.equal(can('admin', 'edit_price'), true);
  });

  it('photo_center + can_access_reports → access_reports = false', () => {
    assert.equal(can('photo_center', 'access_reports', allFlagsTrue), false);
  });

  it('courier + can_access_reports → access_reports = false', () => {
    assert.equal(can('courier', 'access_reports', allFlagsTrue), false);
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

  it('photo_center with null clientId throws', () => {
    assert.throws(() =>
      assertOrderAccess({ id: 'u1', role: 'photo_center', clientId: null }, order),
    );
  });

  it('courier only delivery statuses', () => {
    const courier = { id: 'u1', role: 'courier' as const, clientId: null };
    assert.throws(() => assertOrderAccess(courier, order)); // new
    assert.throws(() => assertOrderAccess(courier, { ...order, status: 'accepted' }));
    assert.doesNotThrow(() => assertOrderAccess(courier, { ...order, status: 'ready_for_pickup' }));
    assert.doesNotThrow(() => assertOrderAccess(courier, { ...order, status: 'with_courier' }));
    assert.doesNotThrow(() => assertOrderAccess(courier, { ...order, status: 'delivered' }));
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

  it('photo_center without clientId uses nil sentinel', () => {
    const w = ordersVisibleWhere({ id: 'u', role: 'photo_center', clientId: null });
    assert.equal(w.clientId, '00000000-0000-0000-0000-000000000000');
    assert.equal(w.excludeDeleted, true);
  });

  it('courier returns three delivery statuses + excludeDeleted', () => {
    const w = ordersVisibleWhere({ id: 'u', role: 'courier', clientId: null });
    assert.deepEqual(w.statuses, ['ready_for_pickup', 'with_courier', 'delivered']);
    assert.equal(w.excludeDeleted, true);
    assert.equal(w.clientId, undefined);
  });
});
