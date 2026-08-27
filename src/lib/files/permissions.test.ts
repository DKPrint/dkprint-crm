import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canUploadBlock, assertNotCourier } from './permissions';
import type { SessionUser } from '@/lib/auth/assertOrderAccess';

function user(role: SessionUser['role'], clientId: string | null = null): SessionUser {
  return { id: 'u1', role, clientId };
}

describe('file permissions §9.3', () => {
  it('courier denied on all file ops', () => {
    assert.throws(() => assertNotCourier(user('courier')), /forbidden/);
    assert.equal(canUploadBlock(user('courier'), 'client'), false);
    assert.equal(canUploadBlock(user('courier'), 'designer'), false);
  });

  it('client block upload roles', () => {
    assert.equal(canUploadBlock(user('admin'), 'client'), true);
    assert.equal(canUploadBlock(user('production'), 'client'), true);
    assert.equal(canUploadBlock(user('photo_center', 'c1'), 'client'), true);
    assert.equal(canUploadBlock(user('designer'), 'client'), false);
  });

  it('designer block upload roles', () => {
    assert.equal(canUploadBlock(user('admin'), 'designer'), true);
    assert.equal(canUploadBlock(user('designer'), 'designer'), true);
    assert.equal(canUploadBlock(user('production'), 'designer'), false);
    assert.equal(canUploadBlock(user('photo_center', 'c1'), 'designer'), false);
  });
});
