import type { Role } from '@/lib/auth/permissions';

/** True if demoting/deactivating would remove the last active admin. */
export function wouldRemoveLastActiveAdmin(
  current: { role: Role; isActive: boolean },
  patch: { role?: Role; isActive?: boolean },
): boolean {
  if (current.role !== 'admin' || !current.isActive) return false;
  const losesAdmin =
    patch.isActive === false || (patch.role !== undefined && patch.role !== 'admin');
  return losesAdmin;
}
