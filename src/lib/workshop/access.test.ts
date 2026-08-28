import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canAccessWorkshop, assertWorkshopAccess } from './access';
import { WORKSHOP_STATUSES } from './constants';

describe('workshop access §12.2', () => {
  it('allows admin, production, designer', () => {
    assert.equal(canAccessWorkshop('admin'), true);
    assert.equal(canAccessWorkshop('production'), true);
    assert.equal(canAccessWorkshop('designer'), true);
  });

  it('denies photo_center and courier', () => {
    assert.equal(canAccessWorkshop('photo_center'), false);
    assert.equal(canAccessWorkshop('courier'), false);
  });

  it('assertWorkshopAccess throws forbidden for courier', () => {
    assert.throws(
      () => assertWorkshopAccess({ id: 'u1', role: 'courier', clientId: null }),
      /forbidden/,
    );
  });
});

describe('workshop statuses §12.2', () => {
  it('includes accepted through ready_for_pickup without new', () => {
    assert.deepEqual(WORKSHOP_STATUSES, [
      'accepted',
      'at_designer',
      'in_production',
      'ready_for_pickup',
    ]);
    assert.equal(WORKSHOP_STATUSES.includes('new' as never), false);
  });
});
