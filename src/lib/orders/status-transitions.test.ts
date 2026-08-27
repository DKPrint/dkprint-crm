import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canTransition } from './status-transitions';

describe('status-transitions stub', () => {
  it('allows happy forward new→accepted for production', () => {
    assert.equal(canTransition({ from: 'new', to: 'accepted', role: 'production' }), true);
  });

  it('forbids production→with_courier', () => {
    assert.equal(
      canTransition({
        from: 'ready_for_pickup',
        to: 'with_courier',
        role: 'production',
      }),
      false,
    );
  });

  it('denies designer cancel', () => {
    assert.equal(canTransition({ from: 'accepted', to: 'cancelled', role: 'designer' }), false);
  });

  it('allows admin jump', () => {
    assert.equal(
      canTransition({
        from: 'new',
        to: 'ready_for_pickup',
        role: 'admin',
        isAdminJump: true,
      }),
      true,
    );
  });
});
