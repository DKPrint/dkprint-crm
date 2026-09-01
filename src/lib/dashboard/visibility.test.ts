import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NIL_CLIENT_ID, orderVisibilitySql } from './visibility';

describe('dashboard order visibility', () => {
  it('photo_center scopes to clientId', () => {
    const vis = orderVisibilitySql({ id: 'u', role: 'photo_center', clientId: 'c1' });
    assert.equal(vis.clientId, 'c1');
    assert.equal(vis.excludeDeleted, true);
    assert.equal(vis.statuses, null);
  });

  it('photo_center without clientId uses nil sentinel', () => {
    const vis = orderVisibilitySql({ id: 'u', role: 'photo_center', clientId: null });
    assert.equal(vis.clientId, NIL_CLIENT_ID);
  });

  it('courier limits to delivery statuses', () => {
    const vis = orderVisibilitySql({ id: 'u', role: 'courier', clientId: null });
    assert.deepEqual(vis.statuses, ['ready_for_pickup', 'with_courier', 'delivered']);
  });

  it('admin sees all non-deleted orders', () => {
    const vis = orderVisibilitySql({ id: 'u', role: 'admin', clientId: null });
    assert.equal(vis.clientId, null);
    assert.equal(vis.statuses, null);
    assert.equal(vis.excludeDeleted, true);
  });
});
