import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import { assertClientSoftDeleteAccess, canCreateClient } from './access';

const admin: SessionUser = { id: 'a1', role: 'admin', clientId: null };
const production: SessionUser = { id: 'p1', role: 'production', clientId: null };

describe('client soft-delete access §7', () => {
  it('admin can soft-delete', () => {
    assert.doesNotThrow(() => assertClientSoftDeleteAccess(admin));
  });

  it('production forbidden', () => {
    assert.throws(() => assertClientSoftDeleteAccess(production), /forbidden/);
  });
});

describe('canCreateClient', () => {
  it('admin and production can create', () => {
    assert.equal(canCreateClient('admin'), true);
    assert.equal(canCreateClient('production'), true);
  });

  it('designer cannot create', () => {
    assert.equal(canCreateClient('designer'), false);
  });
});
