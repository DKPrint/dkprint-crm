import { can, type PermissionFlags, type Role } from '@/lib/auth/permissions';

/** Reports: admin or can_access_reports (TZ §12.4 / §15.14). */
export function assertReportsAccess(role: Role, flags: PermissionFlags): void {
  if (!can(role, 'access_reports', flags)) throw new Error('forbidden');
}
