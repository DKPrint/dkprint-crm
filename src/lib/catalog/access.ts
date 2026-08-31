import type { SessionUser } from '@/lib/auth/assertOrderAccess';

/** Admin-only catalog mutations/reads under /api/admin/catalog/* (TZ §13.1). */
export function assertCatalogAdmin(user: SessionUser): void {
  if (user.role !== 'admin') throw new Error('forbidden');
}
