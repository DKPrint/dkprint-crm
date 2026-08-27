import { sql } from '@/lib/db';
import type { PermissionFlags } from './permissions';

const emptyFlags: PermissionFlags = {
  can_access_reports: false,
  can_edit_price: false,
  can_cancel_order: false,
  can_soft_delete_order: false,
  can_manage_sla: false,
};

/** Load permission_overrides for a user (defaults all false). */
export async function loadPermissionFlags(userId: string): Promise<PermissionFlags> {
  const rows = await sql`
    SELECT
      can_access_reports,
      can_edit_price,
      can_cancel_order,
      can_soft_delete_order,
      can_manage_sla
    FROM permission_overrides
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  const row = rows[0] as PermissionFlags | undefined;
  if (!row) return { ...emptyFlags };
  return {
    can_access_reports: row.can_access_reports === true,
    can_edit_price: row.can_edit_price === true,
    can_cancel_order: row.can_cancel_order === true,
    can_soft_delete_order: row.can_soft_delete_order === true,
    can_manage_sla: row.can_manage_sla === true,
  };
}
