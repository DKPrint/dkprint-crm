import type { SessionUser } from '@/lib/auth/assertOrderAccess';

/** Admin-only user management (TZ §13 / §15.11). */
export function assertAdminUsersAccess(user: SessionUser): void {
  if (user.role !== 'admin') throw new Error('forbidden');
}
