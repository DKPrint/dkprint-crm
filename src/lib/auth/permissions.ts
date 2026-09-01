export type Role = 'admin' | 'photo_center' | 'production' | 'designer' | 'courier';

export type PermissionFlags = {
  can_access_reports: boolean;
  can_edit_price: boolean;
  can_cancel_order: boolean;
  can_soft_delete_order: boolean;
  can_manage_sla: boolean;
};

export type Action =
  'access_reports' | 'edit_price' | 'cancel_order' | 'soft_delete_order' | 'manage_sla';

/** All-false permission flags (default when no overrides). */
export const emptyPermissionFlags: PermissionFlags = {
  can_access_reports: false,
  can_edit_price: false,
  can_cancel_order: false,
  can_soft_delete_order: false,
  can_manage_sla: false,
};

/**
 * Effective permissions per TZ §3.
 * Designer never cancel/soft-delete; edit_price only admin or production+flag
 * (designer / photo_center / courier hard-denied even with can_edit_price).
 * access_reports: photo_center / courier hard-denied even with flag.
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
