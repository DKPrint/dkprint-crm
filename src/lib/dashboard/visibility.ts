import { ordersVisibleWhere, type SessionUser } from '@/lib/auth/assertOrderAccess';

/** Sentinel when photo_center has no clientId — matches assertOrderAccess list guard. */
export const NIL_CLIENT_ID = '00000000-0000-0000-0000-000000000000';

export type OrderVisibilitySql = {
  clientId: string | null;
  statuses: string[] | null;
  excludeDeleted: boolean;
};

/** Params for dashboard order queries — mirrors listOrders visibility (TZ §3.4). */
export function orderVisibilitySql(user: SessionUser): OrderVisibilitySql {
  if (user.role === 'photo_center' && !user.clientId) {
    return { clientId: NIL_CLIENT_ID, statuses: null, excludeDeleted: true };
  }

  const v = ordersVisibleWhere(user);
  return {
    clientId: v.clientId ?? null,
    statuses: v.statuses ?? null,
    excludeDeleted: v.excludeDeleted,
  };
}
