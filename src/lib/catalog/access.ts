import type { SessionUser } from '@/lib/auth/assertOrderAccess';

const CATALOG_READ_ROLES = new Set(['admin', 'production', 'photo_center']);

/** Admin-only catalog mutations under /api/admin/catalog/* (TZ §13.1). */
export function assertCatalogAdmin(user: SessionUser): void {
  if (user.role !== 'admin') throw new Error('forbidden');
}

/** Read tree / products for order forms — §15.12. */
export function assertCatalogRead(user: SessionUser): void {
  if (!CATALOG_READ_ROLES.has(user.role)) throw new Error('forbidden');
}
