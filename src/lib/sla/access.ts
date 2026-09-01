import { can, type PermissionFlags, type Role } from '@/lib/auth/permissions';

/** SLA admin: role admin or can_manage_sla flag (TZ §11). */
export function assertSlaManageAccess(role: Role, flags: PermissionFlags): void {
  if (!can(role, 'manage_sla', flags)) throw new Error('forbidden');
}
