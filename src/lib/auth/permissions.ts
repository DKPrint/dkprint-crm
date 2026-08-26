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

const emptyFlags: PermissionFlags = {
  can_access_reports: false,
  can_edit_price: false,
  can_cancel_order: false,
  can_soft_delete_order: false,
  can_manage_sla: false,
};

/** Effective permissions per TZ §3 — designer never cancel/soft-delete. */
export function can(role: Role, action: Action, flags: PermissionFlags = emptyFlags): boolean {
  if (role === 'designer' && (action === 'cancel_order' || action === 'soft_delete_order')) {
    return false;
  }

  switch (action) {
    case 'access_reports':
      return role === 'admin' || flags.can_access_reports;
    case 'edit_price':
      return role === 'admin' || flags.can_edit_price;
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
