import type { Role } from '@/lib/auth/permissions';
import type { SessionUser } from '@/lib/auth/assertOrderAccess';

const WORKSHOP_ROLES = new Set<Role>(['admin', 'production', 'designer']);

export function canAccessWorkshop(role: Role): boolean {
  return WORKSHOP_ROLES.has(role);
}

/** Workshop API/page gate (TZ §12.2). */
export function assertWorkshopAccess(user: SessionUser): void {
  if (!canAccessWorkshop(user.role)) {
    throw new Error('forbidden');
  }
}
