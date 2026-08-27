import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import type { OrderStatus } from './status-transitions';

export type EditableOrderRow = {
  client_id: string;
  status: string;
  source: string;
  deleted_at: string | null;
};

/**
 * Field-edit gate per TZ §4.5.
 * Throws Error with code message when not allowed.
 */
export function assertCanEditOrderFields(
  user: SessionUser,
  order: EditableOrderRow,
  opts: { reason?: string } = {},
): void {
  if (order.deleted_at) {
    throw new Error('forbidden');
  }
  if (order.status === 'cancelled') {
    throw new Error('forbidden');
  }

  if (user.role === 'admin') {
    return;
  }

  if (user.role === 'production') {
    if (order.source !== 'production') {
      throw new Error('forbidden');
    }
    return;
  }

  if (user.role === 'photo_center') {
    if (!user.clientId || order.client_id !== user.clientId) {
      throw new Error('forbidden');
    }
    if (order.status !== 'new') {
      throw new Error('forbidden');
    }
    if (!opts.reason?.trim()) {
      throw new Error('reason_required');
    }
    return;
  }

  throw new Error('forbidden');
}

export function isOrderStatus(value: string): value is OrderStatus {
  return (
    value === 'new' ||
    value === 'accepted' ||
    value === 'at_designer' ||
    value === 'in_production' ||
    value === 'ready_for_pickup' ||
    value === 'with_courier' ||
    value === 'delivered' ||
    value === 'cancelled'
  );
}
