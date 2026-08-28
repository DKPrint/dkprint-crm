import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canWriteComment, assertCanWriteComment } from './permissions';

describe('comment permissions §10.1', () => {
  it('allows admin, production, designer, photo_center', () => {
    assert.equal(canWriteComment({ id: 'u1', role: 'admin', clientId: null }), true);
    assert.equal(canWriteComment({ id: 'u1', role: 'production', clientId: null }), true);
    assert.equal(canWriteComment({ id: 'u1', role: 'designer', clientId: null }), true);
    assert.equal(canWriteComment({ id: 'u1', role: 'photo_center', clientId: 'c1' }), true);
  });

  it('denies courier write', () => {
    assert.equal(canWriteComment({ id: 'u1', role: 'courier', clientId: null }), false);
    assert.throws(
      () => assertCanWriteComment({ id: 'u1', role: 'courier', clientId: null }),
      /forbidden/,
    );
  });
});
