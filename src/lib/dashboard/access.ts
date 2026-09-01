import { can, type PermissionFlags, type Role } from '@/lib/auth/permissions';
import { canAccessWorkshop } from '@/lib/workshop/access';

const TASKS_ROLES = new Set<Role>(['admin', 'production', 'designer', 'photo_center']);

/** KPI money block: admin always; production/designer with can_access_reports; never photo_center/courier. */
export function canSeeDashboardKpi(role: Role, flags: PermissionFlags): boolean {
  return can(role, 'access_reports', flags);
}

export function canSeeWorkshopMetrics(role: Role): boolean {
  return canAccessWorkshop(role);
}

export function canSeeSlaMetrics(role: Role): boolean {
  return canAccessWorkshop(role);
}

export function canSeeTasksMetrics(role: Role): boolean {
  return TASKS_ROLES.has(role);
}

export function courierDeliveryEmphasis(role: Role): boolean {
  return role === 'courier';
}
