import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import type { Role } from '@/lib/auth/permissions';

const CLIENTS_LIST_ROLES = new Set<Role>(['admin', 'production', 'designer']);
const CLIENTS_MUTATE_ROLES = new Set<Role>(['admin', 'production']);

/** TZ §7: client directory list + card read — admin, production, designer. */
export function assertClientsListAccess(user: SessionUser): void {
  if (!CLIENTS_LIST_ROLES.has(user.role)) throw new Error('forbidden');
}

/** TZ §7: create external client — admin, production only. */
export function assertClientCreateAccess(user: SessionUser): void {
  if (!CLIENTS_MUTATE_ROLES.has(user.role)) throw new Error('forbidden');
}

/** TZ §7: patch client fields — admin, production only. */
export function assertClientPatchAccess(user: SessionUser): void {
  assertClientCreateAccess(user);
}

export function canCreateClient(role: Role): boolean {
  return CLIENTS_MUTATE_ROLES.has(role);
}
