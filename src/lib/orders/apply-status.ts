import { sql } from '@/lib/db';
import { assertOrderAccess, type SessionUser } from '@/lib/auth/assertOrderAccess';
import { can, type PermissionFlags } from '@/lib/auth/permissions';
import { loadActiveTransitions } from './load-transitions';
import {
  canTransition,
  hasCancelEdge,
  type OrderStatus,
  type TransitionEdge,
} from './status-transitions';
import { isOrderStatus } from './edit-policy';

export type ApplyStatusArgs = {
  orderId: string;
  user: SessionUser;
  mode: 'next' | 'prev' | 'jump' | 'cancel';
  toStatus?: OrderStatus;
  reason?: string;
  flags?: PermissionFlags;
};

type OrderRow = {
  id: string;
  client_id: string;
  status: string;
  deleted_at: string | null;
};

function findNeighbor(
  edges: readonly TransitionEdge[],
  from: OrderStatus,
  direction: 'forward' | 'backward',
  role: SessionUser['role'],
): OrderStatus | null {
  const matches = edges.filter(
    (e) => e.from === from && e.direction === direction && e.roles.includes(role),
  );
  if (matches.length !== 1) return null;
  return matches[0]!.to;
}

/**
 * Apply status change with optimistic lock + status event (TZ §5).
 * UPDATE + event INSERT are a single CTE so an orphan event cannot land alone.
 */
export async function applyStatusChange(args: ApplyStatusArgs): Promise<{
  id: string;
  status: OrderStatus;
  fromStatus: OrderStatus;
}> {
  const { orderId, user, mode, flags } = args;

  // photo_center may cancel (with flag) but never next/prev/jump (TZ §5.3 / §3.2)
  if (user.role === 'photo_center' && mode !== 'cancel') {
    throw new Error('photo_center_cannot_change_status');
  }

  const orderRows = await sql`
    SELECT id, client_id, status, deleted_at
    FROM orders
    WHERE id = ${orderId}
    LIMIT 1
  `;
  const order = orderRows[0] as OrderRow | undefined;
  if (!order) {
    throw new Error('order_not_found');
  }
  if (order.deleted_at) {
    throw new Error('forbidden');
  }

  assertOrderAccess(user, order);

  if (!isOrderStatus(order.status)) {
    throw new Error('invalid_status');
  }
  const fromStatus = order.status;

  const edges = await loadActiveTransitions();

  let toStatus: OrderStatus;
  let isAdminJump = false;
  const reason: string | null = args.reason?.trim() || null;

  if (mode === 'next') {
    const next = findNeighbor(edges, fromStatus, 'forward', user.role);
    if (!next) throw new Error('invalid_transition');
    toStatus = next;
  } else if (mode === 'prev') {
    const prev = findNeighbor(edges, fromStatus, 'backward', user.role);
    if (!prev) throw new Error('invalid_transition');
    toStatus = prev;
  } else if (mode === 'jump') {
    if (!args.toStatus) throw new Error('validation');
    toStatus = args.toStatus;
    isAdminJump = true;
    if (
      !canTransition({ from: fromStatus, to: toStatus, role: user.role, isAdminJump: true }, edges)
    ) {
      throw new Error('invalid_transition');
    }
  } else {
    // cancel: permission via can(); path via cancel edge existence (any roles on edge)
    if (!reason) throw new Error('reason_required');
    if (!can(user.role, 'cancel_order', flags)) {
      throw new Error('forbidden');
    }
    toStatus = 'cancelled';
    if (!hasCancelEdge(edges, fromStatus)) {
      throw new Error('invalid_transition');
    }
  }

  if (mode !== 'jump' && mode !== 'cancel') {
    if (!canTransition({ from: fromStatus, to: toStatus, role: user.role }, edges)) {
      throw new Error('invalid_transition');
    }
  }

  const leavingCancelled = fromStatus === 'cancelled' && toStatus !== 'cancelled';
  const isCancel = toStatus === 'cancelled';

  let updatedRows: Array<{ id: string; status: string }>;

  if (isCancel) {
    updatedRows = (await sql`
      WITH updated AS (
        UPDATE orders
        SET
          status = ${toStatus},
          cancel_reason = ${reason},
          cancelled_at = now(),
          sla_stopped_at = now(),
          updated_at = now()
        WHERE id = ${orderId}
          AND status = ${fromStatus}
          AND deleted_at IS NULL
        RETURNING id, status
      ),
      ev AS (
        INSERT INTO order_status_events (
          order_id, from_status, to_status, changed_by_user_id, reason, is_admin_jump
        )
        SELECT updated.id, ${fromStatus}, ${toStatus}, ${user.id}, ${reason}, false
        FROM updated
        RETURNING id
      )
      SELECT id, status FROM updated
    `) as Array<{ id: string; status: string }>;
  } else if (leavingCancelled) {
    updatedRows = (await sql`
      WITH updated AS (
        UPDATE orders
        SET
          status = ${toStatus},
          sla_stopped_at = NULL,
          updated_at = now()
        WHERE id = ${orderId}
          AND status = ${fromStatus}
          AND deleted_at IS NULL
        RETURNING id, status
      ),
      ev AS (
        INSERT INTO order_status_events (
          order_id, from_status, to_status, changed_by_user_id, reason, is_admin_jump
        )
        SELECT updated.id, ${fromStatus}, ${toStatus}, ${user.id}, ${reason}, ${isAdminJump}
        FROM updated
        RETURNING id
      )
      SELECT id, status FROM updated
    `) as Array<{ id: string; status: string }>;
  } else {
    updatedRows = (await sql`
      WITH updated AS (
        UPDATE orders
        SET
          status = ${toStatus},
          updated_at = now()
        WHERE id = ${orderId}
          AND status = ${fromStatus}
          AND deleted_at IS NULL
        RETURNING id, status
      ),
      ev AS (
        INSERT INTO order_status_events (
          order_id, from_status, to_status, changed_by_user_id, reason, is_admin_jump
        )
        SELECT updated.id, ${fromStatus}, ${toStatus}, ${user.id}, ${reason}, ${isAdminJump}
        FROM updated
        RETURNING id
      )
      SELECT id, status FROM updated
    `) as Array<{ id: string; status: string }>;
  }

  const updated = updatedRows[0];
  if (!updated) {
    throw new Error('status_conflict');
  }

  return {
    id: updated.id,
    status: updated.status as OrderStatus,
    fromStatus,
  };
}
