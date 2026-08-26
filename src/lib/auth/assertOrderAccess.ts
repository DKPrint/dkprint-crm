import type { Role } from './permissions';

export type SessionUser = {
  id: string;
  role: Role;
  clientId: string | null;
};

export type OrderAccessRow = {
  client_id: string;
  status: string;
  deleted_at: string | null;
};

const COURIER_STATUSES = new Set(['ready_for_pickup', 'with_courier', 'delivered']);

/**
 * Visibility / mutation gate for a single order (TZ §3.4, §20.9).
 * Soft-deleted: only admin with includeDeleted may see.
 */
export function assertOrderAccess(
  user: SessionUser,
  order: OrderAccessRow,
  opts: { includeDeleted?: boolean } = {},
): void {
  if (order.deleted_at && !(user.role === 'admin' && opts.includeDeleted)) {
    throw new Error('order_not_found');
  }

  if (user.role === 'photo_center') {
    if (!user.clientId || order.client_id !== user.clientId) {
      throw new Error('forbidden');
    }
    return;
  }

  if (user.role === 'courier') {
    if (!COURIER_STATUSES.has(order.status)) {
      throw new Error('forbidden');
    }
    return;
  }

  // admin | production | designer — all non-deleted (handled above)
}

/** SQL-ish filter helper for list queries. */
export function ordersVisibleWhere(user: SessionUser): {
  clientId?: string;
  statuses?: string[];
  excludeDeleted: boolean;
} {
  if (user.role === 'photo_center') {
    return { clientId: user.clientId ?? undefined, excludeDeleted: true };
  }
  if (user.role === 'courier') {
    return {
      statuses: ['ready_for_pickup', 'with_courier', 'delivered'],
      excludeDeleted: true,
    };
  }
  return { excludeDeleted: true };
}
