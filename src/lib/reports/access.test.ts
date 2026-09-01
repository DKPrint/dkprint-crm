import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertReportsAccess } from './access';
import { emptyPermissionFlags } from '@/lib/auth/permissions';

describe('reports access §12.4', () => {
  it('allows admin without flag', () => {
    assert.doesNotThrow(() => assertReportsAccess('admin', emptyPermissionFlags));
  });

  it('allows production with can_access_reports', () => {
    assert.doesNotThrow(() =>
      assertReportsAccess('production', {
        ...emptyPermissionFlags,
        can_access_reports: true,
      }),
    );
  });

  it('denies production without flag', () => {
    assert.throws(() => assertReportsAccess('production', emptyPermissionFlags), /forbidden/);
  });

  it('allows designer with flag; denies courier without', () => {
    assert.doesNotThrow(() =>
      assertReportsAccess('designer', { ...emptyPermissionFlags, can_access_reports: true }),
    );
    assert.throws(() => assertReportsAccess('courier', emptyPermissionFlags), /forbidden/);
  });
});
