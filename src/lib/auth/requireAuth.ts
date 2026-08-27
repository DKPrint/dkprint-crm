import { auth } from '@/auth';
import { sql } from '@/lib/db';
import type { Role } from './permissions';
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
 * Role/clientId come from DB (not JWT) so deactivated or role-changed users are gated.
 */
export async function requireAuth(): Promise<{
  user: AuthSessionUser;
} | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;

  const rows = await sql`
    SELECT id, email, display_name, role, client_id, is_active
    FROM users
    WHERE id = ${user.id}
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
