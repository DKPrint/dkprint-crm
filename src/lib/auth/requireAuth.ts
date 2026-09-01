import { auth } from '@/auth';
import { sql } from '@/lib/db';
import type { PermissionFlags, Role } from './permissions';
import type { SessionUser } from './assertOrderAccess';

export type { SessionUser };

/** Session user with Auth.js fields; use after requireAuth(). */
export type AuthSessionUser = SessionUser & {
  email?: string | null;
  name?: string | null;
};

/**
 * Returns the current session if authenticated and user is still active in DB.
 * Returns null when unauthenticated or deactivated (TZ §15.1).
 * Role/clientId/flags come from DB (not JWT) so deactivated or role-changed users are gated.
 */
export async function requireAuth(): Promise<{
  user: AuthSessionUser;
  flags: PermissionFlags;
} | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;

  const rows = await sql`
    SELECT
      u.id,
      u.email,
      u.display_name,
      u.role,
      u.client_id,
      u.is_active,
      po.can_access_reports,
      po.can_edit_price,
      po.can_cancel_order,
      po.can_soft_delete_order,
      po.can_manage_sla,
      po.deny_access_reports,
      po.deny_edit_price,
      po.deny_cancel_order,
      po.deny_soft_delete_order,
      po.deny_manage_sla
    FROM users u
    LEFT JOIN permission_overrides po ON po.user_id = u.id
    WHERE u.id = ${user.id}
    LIMIT 1
  `;
  const row = rows[0] as
    | {
        id: string;
        email: string;
        display_name: string;
        role: Role;
        client_id: string | null;
        is_active: boolean;
        can_access_reports: boolean | null;
        can_edit_price: boolean | null;
        can_cancel_order: boolean | null;
        can_soft_delete_order: boolean | null;
        can_manage_sla: boolean | null;
        deny_access_reports: boolean | null;
        deny_edit_price: boolean | null;
        deny_cancel_order: boolean | null;
        deny_soft_delete_order: boolean | null;
        deny_manage_sla: boolean | null;
      }
    | undefined;

  if (!row || row.is_active !== true) {
    return null;
  }

  return {
    user: {
      id: row.id,
      role: row.role,
      clientId: row.client_id,
      email: row.email,
      name: row.display_name,
    },
    flags: {
      can_access_reports: row.can_access_reports === true,
      can_edit_price: row.can_edit_price === true,
      can_cancel_order: row.can_cancel_order === true,
      can_soft_delete_order: row.can_soft_delete_order === true,
      can_manage_sla: row.can_manage_sla === true,
      deny_access_reports: row.deny_access_reports === true,
      deny_edit_price: row.deny_edit_price === true,
      deny_cancel_order: row.deny_cancel_order === true,
      deny_soft_delete_order: row.deny_soft_delete_order === true,
      deny_manage_sla: row.deny_manage_sla === true,
    },
  };
}

/** Typed helper: extract SessionUser from requireAuth() result. */
export function sessionUser(authResult: { user: AuthSessionUser }): SessionUser {
  return {
    id: authResult.user.id,
    role: authResult.user.role,
    clientId: authResult.user.clientId,
  };
}
