import { toApiNumber, formatMoney2 } from '@/lib/money';
import { sql } from '@/lib/db';
import {
  assertOrderAccess,
  ordersVisibleWhere,
  type SessionUser,
} from '@/lib/auth/assertOrderAccess';

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
  status: string;
  created_by_user_id: string;
  created_by_role: string;
  source: string;
  courier_note: string | null;
  ttn_checked: boolean;
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
    status: o.status,
    createdByUserId: o.created_by_user_id,
    createdByRole: o.created_by_role,
    source: o.source,
    courierNote: o.courier_note,
    ttnChecked: o.ttn_checked === true,
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
    techParams: i.tech_params,
    quantity: Number(i.quantity),
    unitPrice: toApiNumber(i.unit_price),
    lineTotal: toApiNumber(i.line_total),
    files: [] as unknown[],
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
      id, order_number, order_date, daily_sequence, client_id, status,
      created_by_user_id, created_by_role, source, courier_note, ttn_checked,
      total_amount, sla_started_at, sla_stopped_at, cancelled_at, cancel_reason,
      deleted_at, created_at, updated_at
    FROM orders
    WHERE id = ${orderId}
    LIMIT 1
  `;
  const order = rows[0] as DbOrder | undefined;
  if (!order) throw new Error('order_not_found');

  assertOrderAccess(user, order, { includeDeleted });

  const items = (await sql`
    SELECT id, order_id, position_number, category_id, tech_params,
           quantity, unit_price, line_total
    FROM order_items
    WHERE order_id = ${orderId}
    ORDER BY position_number ASC
  `) as DbItem[];

  return {
    ...serializeOrder(order),
    items: items.map(serializeItem),
    files: [] as unknown[],
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
      id, order_number, order_date, daily_sequence, client_id, status,
      created_by_user_id, created_by_role, source, courier_note, ttn_checked,
      total_amount, sla_started_at, sla_stopped_at, cancelled_at, cancel_reason,
      deleted_at, created_at, updated_at
    FROM orders
    WHERE
      (${excludeDeleted} = false OR deleted_at IS NULL)
      AND (${clientId}::uuid IS NULL OR client_id = ${clientId}::uuid)
      AND (${statuses}::text[] IS NULL OR status = ANY(${statuses}::text[]))
      AND (${q}::text IS NULL OR order_number ILIKE '%' || ${q} || '%')
      AND (${from}::date IS NULL OR order_date >= ${from}::date)
      AND (${to}::date IS NULL OR order_date <= ${to}::date)
    ORDER BY created_at DESC
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
  await getOrderAccessOnly(user, orderId);
  return sql`
    SELECT id, order_id, order_item_id, action, field_name,
           old_value, new_value, reason, user_id, created_at
    FROM order_audit_logs
    WHERE order_id = ${orderId}
    ORDER BY created_at ASC
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
