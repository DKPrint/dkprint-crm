import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertAdminUsersAccess } from './access';
import {
  editablePermissionKeys,
  normalizePermissionOverridesForRole,
  permissionInputToFlags,
} from './permissions';
import { wouldRemoveLastActiveAdmin } from './guards';
import type { SessionUser } from '@/lib/auth/assertOrderAccess';

function user(role: SessionUser['role']): SessionUser {
  return { id: 'u1', role, clientId: null };
}

describe('admin-users access §13', () => {
  it('allows admin only', () => {
    assert.doesNotThrow(() => assertAdminUsersAccess(user('admin')));
    assert.throws(() => assertAdminUsersAccess(user('production')), /forbidden/);
  });
});

describe('permission overrides §3.2', () => {
  it('designer: strips cancel/soft-delete flags', () => {
    const flags = permissionInputToFlags({
      canCancelOrder: true,
      canSoftDeleteOrder: true,
      canAccessReports: true,
    });
    const normalized = normalizePermissionOverridesForRole('designer', flags);
    assert.equal(normalized.can_cancel_order, false);
    assert.equal(normalized.can_soft_delete_order, false);
    assert.equal(normalized.can_access_reports, true);
  });

  it('designer UI hides cancel/soft-delete keys', () => {
    const keys = editablePermissionKeys('designer');
    assert.equal(keys.includes('can_cancel_order'), false);
    assert.equal(keys.includes('can_soft_delete_order'), false);
    assert.equal(keys.includes('can_access_reports'), true);
  });

  it('production keeps all editable keys', () => {
    const keys = editablePermissionKeys('production');
    assert.equal(keys.includes('can_cancel_order'), true);
  });
});

describe('last admin guard', () => {
  it('detects deactivation of last admin', () => {
    assert.equal(
      wouldRemoveLastActiveAdmin({ role: 'admin', isActive: true }, { isActive: false }),
      true,
    );
    assert.equal(
      wouldRemoveLastActiveAdmin({ role: 'admin', isActive: true }, { role: 'production' }),
      true,
    );
    assert.equal(
      wouldRemoveLastActiveAdmin({ role: 'production', isActive: true }, { isActive: false }),
      false,
    );
    assert.equal(
      wouldRemoveLastActiveAdmin({ role: 'admin', isActive: false }, { isActive: false }),
      false,
    );
  });
});
