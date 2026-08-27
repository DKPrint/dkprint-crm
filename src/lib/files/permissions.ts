import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import type { FileBlock } from './constants';

/** Courier has no file access at all (§9.3). */
export function assertNotCourier(user: SessionUser): void {
  if (user.role === 'courier') {
    throw new Error('forbidden');
  }
}

/** Read/list/download for any non-courier with order access. */
export function canReadFiles(user: SessionUser): boolean {
  return user.role !== 'courier';
}

/**
 * Upload permission per §9.3 / role matrix §3.
 * Photo center: client only; designer: designer block; admin: both; production: client.
 */
export function canUploadBlock(user: SessionUser, block: FileBlock): boolean {
  if (user.role === 'courier') return false;
  if (user.role === 'admin') return true;
  if (block === 'client') {
    return user.role === 'photo_center' || user.role === 'production';
  }
  return user.role === 'designer';
}

/** Deny uploads on cancelled or soft-deleted orders. */
export function assertOrderAllowsUpload(order: {
  status: string;
  deleted_at: string | null;
}): void {
  if (order.deleted_at) throw new Error('forbidden');
  if (order.status === 'cancelled') throw new Error('forbidden');
}
