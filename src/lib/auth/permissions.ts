export type Role = 'admin' | 'photo_center' | 'production' | 'designer' | 'courier';

export type PermissionGrantFlags = {
  can_access_reports: boolean;
  can_edit_price: boolean;
  can_cancel_order: boolean;
  can_soft_delete_order: boolean;
  can_manage_sla: boolean;
};

export type PermissionDenyFlags = {
  deny_access_reports: boolean;
  deny_edit_price: boolean;
  deny_cancel_order: boolean;
  deny_soft_delete_order: boolean;
  deny_manage_sla: boolean;
};

/** Grant + deny overrides stored in permission_overrides (TZ §3.2). */
export type PermissionFlags = PermissionGrantFlags & PermissionDenyFlags;

export type Action =
  'access_reports' | 'edit_price' | 'cancel_order' | 'soft_delete_order' | 'manage_sla';

const DENY_BY_ACTION: Record<Action, keyof PermissionDenyFlags> = {
  access_reports: 'deny_access_reports',
  edit_price: 'deny_edit_price',
  cancel_order: 'deny_cancel_order',
  soft_delete_order: 'deny_soft_delete_order',
  manage_sla: 'deny_manage_sla',
};

/** All-false permission flags (default when no overrides). */
export const emptyPermissionFlags: PermissionFlags = {
  can_access_reports: false,
  can_edit_price: false,
  can_cancel_order: false,
  can_soft_delete_order: false,
  can_manage_sla: false,
  deny_access_reports: false,
  deny_edit_price: false,
  deny_cancel_order: false,
  deny_soft_delete_order: false,
  deny_manage_sla: false,
};

/**
 * Effective permissions per TZ §3.
 * Designer never cancel/soft-delete; edit_price only admin or production+flag
 * (designer / photo_center / courier hard-denied even with can_edit_price).
 * access_reports: photo_center / courier hard-denied even with flag.
 * Admin deny_* flags override role grants (§3.2).
 */
export function can(
  role: Role,
  action: Action,
  flags: PermissionFlags = emptyPermissionFlags,
): boolean {
  if (role === 'designer' && (action === 'cancel_order' || action === 'soft_delete_order')) {
    return false;
  }

  if (
    action === 'edit_price' &&
    (role === 'designer' || role === 'photo_center' || role === 'courier')
  ) {
    return false;
  }

  if (action === 'access_reports' && (role === 'photo_center' || role === 'courier')) {
    return false;
  }

  if (flags[DENY_BY_ACTION[action]]) {
    return false;
  }

  switch (action) {
    case 'access_reports':
      return role === 'admin' || flags.can_access_reports;
    case 'edit_price':
      return role === 'admin' || (role === 'production' && flags.can_edit_price);
    case 'cancel_order':
      return role === 'admin' || role === 'production' || flags.can_cancel_order;
    case 'soft_delete_order':
      return role === 'admin' || role === 'production' || flags.can_soft_delete_order;
    case 'manage_sla':
      return role === 'admin' || flags.can_manage_sla;
    default:
      return false;
  }
}

/** UI helper: same as can() — explicit name for admin user form. */
export function effectivePermission(role: Role, action: Action, flags: PermissionFlags): boolean {
  return can(role, action, flags);
}

export const GRANT_FLAG_KEYS: Array<keyof PermissionGrantFlags> = [
  'can_access_reports',
  'can_edit_price',
  'can_cancel_order',
  'can_soft_delete_order',
  'can_manage_sla',
];

export const DENY_FLAG_BY_GRANT: Record<keyof PermissionGrantFlags, keyof PermissionDenyFlags> = {
  can_access_reports: 'deny_access_reports',
  can_edit_price: 'deny_edit_price',
  can_cancel_order: 'deny_cancel_order',
  can_soft_delete_order: 'deny_soft_delete_order',
  can_manage_sla: 'deny_manage_sla',
};

export const GRANT_FLAG_BY_ACTION: Record<Action, keyof PermissionGrantFlags> = {
  access_reports: 'can_access_reports',
  edit_price: 'can_edit_price',
  cancel_order: 'can_cancel_order',
  soft_delete_order: 'can_soft_delete_order',
  manage_sla: 'can_manage_sla',
};
