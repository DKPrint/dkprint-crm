import { toApiNumber, formatMoney2 } from '@/lib/money';
import { sql } from '@/lib/db';
import {
  assertOrderAccess,
  ordersVisibleWhere,
  type SessionUser,
} from '@/lib/auth/assertOrderAccess';
import { listFilesForOrder } from '@/lib/files/queries';
import { isOrderStatus } from './edit-policy';
import { loadActiveTransitions } from './load-transitions';
import { getStatusNeighbors, type OrderStatus } from './status-transitions';

export type OrderListFilters = {
  status?: string[];
  clientId?: string;
  q?: string;
  from?: string;
  to?: string;
  includeDeleted?: boolean;
};

type DbOrder = {
  id: string;
  order_number: string;
  order_date: string;
  daily_sequence: number;
  client_id: string;
  client_name: string | null;
  status: string;
  created_by_user_id: string;
  created_by_role: string;
  source: string;
  courier_note: string | null;
  ttn_checked: boolean;
  is_urgent: boolean;
  total_amount: string;
  sla_started_at: string;
  sla_stopped_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type DbItem = {
  id: string;
  order_id: string;
  position_number: number;
  category_id: string;
  category_name: string | null;
  name: string;
  tech_params: string | null;
  quantity: number;
  unit_price: string;
  line_total: string;
};

export function serializeOrder(o: DbOrder) {
  return {
    id: o.id,
    orderNumber: o.order_number,
    orderDate: String(o.order_date).slice(0, 10),
    dailySequence: Number(o.daily_sequence),
    clientId: o.client_id,
    clientName: o.client_name ?? null,
    status: o.status,
    createdByUserId: o.created_by_user_id,
    createdByRole: o.created_by_role,
    source: o.source,
    courierNote: o.courier_note,
    ttnChecked: o.ttn_checked === true,
    isUrgent: o.is_urgent === true,
    totalAmount: toApiNumber(o.total_amount),
    slaStartedAt: o.sla_started_at,
    slaStoppedAt: o.sla_stopped_at,
    cancelledAt: o.cancelled_at,
    cancelReason: o.cancel_reason,
    deletedAt: o.deleted_at,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  };
}

export function serializeItem(i: DbItem) {
  return {
    id: i.id,
    orderId: i.order_id,
    positionNumber: i.position_number,
    categoryId: i.category_id,
    categoryName: i.category_name ?? null,
    name: i.name,
    techParams: i.tech_params,
    quantity: Number(i.quantity),
    unitPrice: toApiNumber(i.unit_price),
    lineTotal: toApiNumber(i.line_total),
  };
}

export async function getOrderById(
  user: SessionUser,
  orderId: string,
  opts: { includeDeleted?: boolean } = {},
) {
  const includeDeleted = user.role === 'admin' && opts.includeDeleted === true;
  const rows = await sql`
    SELECT
      o.id, o.order_number, o.order_date, o.daily_sequence, o.client_id,
      c.name AS client_name, o.status,
      o.created_by_user_id, o.created_by_role, o.source, o.courier_note, o.ttn_checked,
      o.is_urgent,
      o.total_amount, o.sla_started_at, o.sla_stopped_at, o.cancelled_at, o.cancel_reason,
      o.deleted_at, o.created_at, o.updated_at
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    WHERE o.id = ${orderId}
    LIMIT 1
  `;
  const order = rows[0] as DbOrder | undefined;
  if (!order) throw new Error('order_not_found');

  assertOrderAccess(user, order, { includeDeleted });

  const items = (await sql`
    SELECT
      oi.id, oi.order_id, oi.position_number, oi.category_id,
      cat.name AS category_name, oi.name, oi.tech_params,
      oi.quantity, oi.unit_price, oi.line_total
    FROM order_items oi
    LEFT JOIN categories cat ON cat.id = oi.category_id
    WHERE oi.order_id = ${orderId}
    ORDER BY oi.position_number ASC
  `) as DbItem[];

  const files =
    user.role === 'courier' ? [] : await listFilesForOrder(user, orderId, { includeDeleted });

  let statusPrev: OrderStatus | null = null;
  let statusNext: OrderStatus | null = null;
  if (user.role !== 'photo_center' && isOrderStatus(order.status)) {
    const edges = await loadActiveTransitions();
    const neighbors = getStatusNeighbors(order.status, user.role, edges);
    statusPrev = neighbors.prev;
    statusNext = neighbors.next;
  }

  return {
    ...serializeOrder(order),
    statusPrev,
    statusNext,
    items: items.map(serializeItem),
    files,
  };
}

export async function listOrders(user: SessionUser, filters: OrderListFilters) {
  // Never treat null clientId as “all clients” for photo_center
  if (user.role === 'photo_center' && !user.clientId) {
    return [];
  }

  const visibility = ordersVisibleWhere(user);
  const includeDeleted = user.role === 'admin' && filters.includeDeleted === true ? true : false;

  let clientId: string | null = visibility.clientId ?? filters.clientId ?? null;
  if (user.role === 'photo_center') {
    clientId = user.clientId;
  }

  let statuses: string[] | null = filters.status?.length ? filters.status : null;
  if (visibility.statuses) {
    if (statuses) {
      statuses = statuses.filter((s) => visibility.statuses!.includes(s));
    } else {
      statuses = visibility.statuses;
    }
  }

  const q = filters.q?.trim() || null;
  const from = filters.from || null;
  const to = filters.to || null;
  const excludeDeleted = includeDeleted ? false : visibility.excludeDeleted;

  const rows = (await sql`
    SELECT
      o.id, o.order_number, o.order_date, o.daily_sequence, o.client_id,
      c.name AS client_name, o.status,
      o.created_by_user_id, o.created_by_role, o.source, o.courier_note, o.ttn_checked,
      o.is_urgent,
      o.total_amount, o.sla_started_at, o.sla_stopped_at, o.cancelled_at, o.cancel_reason,
      o.deleted_at, o.created_at, o.updated_at
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    WHERE
      (${excludeDeleted} = false OR o.deleted_at IS NULL)
      AND (${clientId}::uuid IS NULL OR o.client_id = ${clientId}::uuid)
      AND (${statuses}::text[] IS NULL OR o.status = ANY(${statuses}::text[]))
      AND (
        ${q}::text IS NULL
        OR o.order_number ILIKE '%' || ${q} || '%'
        OR c.name ILIKE '%' || ${q} || '%'
      )
      AND (${from}::date IS NULL OR o.order_date >= ${from}::date)
      AND (${to}::date IS NULL OR o.order_date <= ${to}::date)
    ORDER BY o.created_at DESC
    LIMIT 200
  `) as DbOrder[];

  return rows.map(serializeOrder);
}

export async function listStatusEvents(user: SessionUser, orderId: string) {
  await getOrderAccessOnly(user, orderId);
  return sql`
    SELECT id, order_id, from_status, to_status, changed_by_user_id,
           reason, is_admin_jump, created_at
    FROM order_status_events
    WHERE order_id = ${orderId}
    ORDER BY created_at ASC
  `;
}

export async function listAuditLogs(user: SessionUser, orderId: string) {
  if (user.role !== 'admin' && user.role !== 'production') {
    throw new Error('forbidden');
  }
  await getOrderAccessOnly(user, orderId);
  return sql`
    SELECT
      a.id, a.order_id, a.order_item_id, a.action, a.field_name,
      a.old_value, a.new_value, a.reason, a.user_id, a.created_at,
      u.display_name AS user_display_name
    FROM order_audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.order_id = ${orderId}
    ORDER BY a.created_at ASC
  `;
}

async function getOrderAccessOnly(user: SessionUser, orderId: string) {
  const rows = await sql`
    SELECT client_id, status, deleted_at FROM orders WHERE id = ${orderId} LIMIT 1
  `;
  const order = rows[0] as
    { client_id: string; status: string; deleted_at: string | null } | undefined;
  if (!order) throw new Error('order_not_found');
  assertOrderAccess(user, order, {
    includeDeleted: user.role === 'admin',
  });
}

/** Re-export for callers that need money formatting on create response. */
export { formatMoney2, toApiNumber };
