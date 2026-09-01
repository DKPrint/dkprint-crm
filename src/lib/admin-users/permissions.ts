import type { PermissionFlags, PermissionGrantFlags, Role } from '@/lib/auth/permissions';
import { emptyPermissionFlags } from '@/lib/auth/permissions';

export type PermissionOverridesInput = {
  canAccessReports?: boolean;
  canEditPrice?: boolean;
  canCancelOrder?: boolean;
  canSoftDeleteOrder?: boolean;
  canManageSla?: boolean;
  denyAccessReports?: boolean;
  denyEditPrice?: boolean;
  denyCancelOrder?: boolean;
  denySoftDeleteOrder?: boolean;
  denyManageSla?: boolean;
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
    deny_access_reports: input.denyAccessReports ?? base.deny_access_reports,
    deny_edit_price: input.denyEditPrice ?? base.deny_edit_price,
    deny_cancel_order: input.denyCancelOrder ?? base.deny_cancel_order,
    deny_soft_delete_order: input.denySoftDeleteOrder ?? base.deny_soft_delete_order,
    deny_manage_sla: input.denyManageSla ?? base.deny_manage_sla,
  };
}

/** Designer: cancel/soft-delete grant flags are never stored (TZ §3.2 / §13).
 * photo_center / courier: reports grant flag never stored (TZ §3 matrix).
 */
export function normalizePermissionOverridesForRole(
  role: Role,
  flags: PermissionFlags,
): PermissionFlags {
  let next = flags;
  if (role === 'designer') {
    next = {
      ...next,
      can_cancel_order: false,
      can_soft_delete_order: false,
    };
  }
  if (role === 'photo_center' || role === 'courier') {
    next = { ...next, can_access_reports: false };
  }
  return next;
}

export function flagsToApiPermissions(flags: PermissionFlags) {
  return {
    canAccessReports: flags.can_access_reports,
    canEditPrice: flags.can_edit_price,
    canCancelOrder: flags.can_cancel_order,
    canSoftDeleteOrder: flags.can_soft_delete_order,
    canManageSla: flags.can_manage_sla,
    denyAccessReports: flags.deny_access_reports,
    denyEditPrice: flags.deny_edit_price,
    denyCancelOrder: flags.deny_cancel_order,
    denySoftDeleteOrder: flags.deny_soft_delete_order,
    denyManageSla: flags.deny_manage_sla,
  };
}

export { effectivePermission } from '@/lib/auth/permissions';

/** Permission grant flags editable in admin UI for the given role. */
export function editablePermissionKeys(role: Role): Array<keyof PermissionGrantFlags> {
  const all: Array<keyof PermissionGrantFlags> = [
    'can_access_reports',
    'can_edit_price',
    'can_cancel_order',
    'can_soft_delete_order',
    'can_manage_sla',
  ];
  if (role === 'designer') {
    return all.filter((k) => k !== 'can_cancel_order' && k !== 'can_soft_delete_order');
  }
  if (role === 'photo_center' || role === 'courier') {
    return all.filter((k) => k !== 'can_access_reports' && k !== 'can_edit_price');
  }
  return [...all];
}
