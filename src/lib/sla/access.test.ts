import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertSlaManageAccess } from './access';
import { can } from '@/lib/auth/permissions';
import { emptyPermissionFlags } from '@/lib/auth/permissions';

describe('sla access §11', () => {
  it('admin can manage SLA', () => {
    assert.doesNotThrow(() => assertSlaManageAccess('admin', emptyPermissionFlags));
  });

  it('production with can_manage_sla can manage SLA', () => {
    assert.doesNotThrow(() =>
      assertSlaManageAccess('production', { ...emptyPermissionFlags, can_manage_sla: true }),
    );
  });

  it('production without flag denied', () => {
    assert.throws(() => assertSlaManageAccess('production', emptyPermissionFlags), /forbidden/);
  });

  it('can() manage_sla matches access helper', () => {
    assert.equal(can('admin', 'manage_sla'), true);
    assert.equal(
      can('production', 'manage_sla', { ...emptyPermissionFlags, can_manage_sla: true }),
      true,
    );
    assert.equal(can('designer', 'manage_sla'), false);
  });
});
