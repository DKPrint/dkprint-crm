import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertClientCreateAccess,
  assertClientPatchAccess,
  assertClientsListAccess,
  canCreateClient,
} from './access';
import type { SessionUser } from '@/lib/auth/assertOrderAccess';

function user(role: SessionUser['role']): SessionUser {
  return { id: 'u1', role, clientId: null };
}

describe('clients access §7', () => {
  it('list: admin, production, designer', () => {
    assert.doesNotThrow(() => assertClientsListAccess(user('admin')));
    assert.doesNotThrow(() => assertClientsListAccess(user('production')));
    assert.doesNotThrow(() => assertClientsListAccess(user('designer')));
  });

  it('list denies photo_center and courier', () => {
    assert.throws(() => assertClientsListAccess(user('photo_center')), /forbidden/);
    assert.throws(() => assertClientsListAccess(user('courier')), /forbidden/);
  });

  it('create/patch: admin, production only', () => {
    assert.doesNotThrow(() => assertClientCreateAccess(user('admin')));
    assert.doesNotThrow(() => assertClientCreateAccess(user('production')));
    assert.throws(() => assertClientCreateAccess(user('designer')), /forbidden/);
    assert.throws(() => assertClientPatchAccess(user('photo_center')), /forbidden/);
  });

  it('canCreateClient helper', () => {
    assert.equal(canCreateClient('admin'), true);
    assert.equal(canCreateClient('production'), true);
    assert.equal(canCreateClient('designer'), false);
  });
});
