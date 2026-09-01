import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertClientSoftDeletable } from './soft-delete';

describe('client soft-delete guards', () => {
  it('blocks photo_center client (user_id set)', () => {
    assert.throws(
      () => assertClientSoftDeletable({ user_id: 'u1', deleted_at: null }),
      /cannot_delete_photo_center_client/,
    );
  });

  it('allows external client', () => {
    assert.doesNotThrow(() => assertClientSoftDeletable({ user_id: null, deleted_at: null }));
  });

  it('blocks already deleted', () => {
    assert.throws(
      () => assertClientSoftDeletable({ user_id: null, deleted_at: '2026-01-01' }),
      /conflict/,
    );
  });
});
