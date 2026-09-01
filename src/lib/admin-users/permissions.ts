import type { PermissionFlags, Role } from '@/lib/auth/permissions';
import { emptyPermissionFlags } from '@/lib/auth/permissions';

export type PermissionOverridesInput = {
  canAccessReports?: boolean;
  canEditPrice?: boolean;
  canCancelOrder?: boolean;
  canSoftDeleteOrder?: boolean;
  canManageSla?: boolean;
};

export function permissionInputToFlags(
  input: PermissionOverridesInput | undefined,
  base: PermissionFlags = emptyPermissionFlags,
): PermissionFlags {
  if (!input) return { ...base };
  return {
    can_access_reports: input.canAccessReports ?? base.can_access_reports,
    can_edit_price: input.canEditPrice ?? base.can_edit_price,
    can_cancel_order: input.canCancelOrder ?? base.can_cancel_order,
    can_soft_delete_order: input.canSoftDeleteOrder ?? base.can_soft_delete_order,
    can_manage_sla: input.canManageSla ?? base.can_manage_sla,
  };
}

/** Designer: cancel/soft-delete flags are never stored (TZ §3.2 / §13). */
export function normalizePermissionOverridesForRole(
  role: Role,
  flags: PermissionFlags,
): PermissionFlags {
  if (role !== 'designer') return flags;
  return {
    ...flags,
    can_cancel_order: false,
    can_soft_delete_order: false,
  };
}

export function flagsToApiPermissions(flags: PermissionFlags) {
  return {
    canAccessReports: flags.can_access_reports,
    canEditPrice: flags.can_edit_price,
    canCancelOrder: flags.can_cancel_order,
    canSoftDeleteOrder: flags.can_soft_delete_order,
    canManageSla: flags.can_manage_sla,
  };
}

/** Permission flags editable in admin UI for the given role. */
export function editablePermissionKeys(role: Role): Array<keyof PermissionFlags> {
  const all: Array<keyof PermissionFlags> = [
    'can_access_reports',
    'can_edit_price',
    'can_cancel_order',
    'can_soft_delete_order',
    'can_manage_sla',
  ];
  if (role === 'designer') {
    return all.filter((k) => k !== 'can_cancel_order' && k !== 'can_soft_delete_order');
  }
  return all;
}
