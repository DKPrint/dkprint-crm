import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import { sql } from '@/lib/db';
import { toApiNumber } from '@/lib/money';
import { isOrderStatus } from '@/lib/orders/edit-policy';
import { loadActiveTransitions } from '@/lib/orders/load-transitions';
import { getStatusNeighbors, type OrderStatus } from '@/lib/orders/status-transitions';
import { assertWorkshopAccess } from './access';
import { WORKSHOP_STATUSES } from './constants';

type DbWorkshopOrder = {
  id: string;
  order_number: string;
  client_name: string | null;
  status: string;
  total_amount: string;
  sla_started_at: string;
  sla_stopped_at: string | null;
  created_at: string;
  is_urgent: boolean;
};

export type WorkshopOrderItem = {
  positionNumber: number;
  name: string;
  quantity: number;
  techParams: string | null;
  hasLayout: boolean;
};

export type WorkshopOrder = {
  id: string;
  orderNumber: string;
  clientName: string | null;
  status: string;
  totalAmount: number;
  slaStartedAt: string;
  slaStoppedAt: string | null;
  createdAt: string;
  isUrgent: boolean;
  statusPrev: OrderStatus | null;
  statusNext: OrderStatus | null;
  items: WorkshopOrderItem[];
};

function serialize(
  row: DbWorkshopOrder,
  role: SessionUser['role'],
  edges: Awaited<ReturnType<typeof loadActiveTransitions>>,
  items: WorkshopOrderItem[],
): WorkshopOrder {
  const base: WorkshopOrder = {
    id: row.id,
    orderNumber: row.order_number,
    clientName: row.client_name,
    status: row.status,
    totalAmount: toApiNumber(row.total_amount),
    slaStartedAt: row.sla_started_at,
    slaStoppedAt: row.sla_stopped_at,
    createdAt: row.created_at,
    isUrgent: row.is_urgent === true,
    statusPrev: null,
    statusNext: null,
    items,
  };
  if (isOrderStatus(row.status)) {
    const neighbors = getStatusNeighbors(row.status, role, edges);
    base.statusPrev = neighbors.prev;
    base.statusNext = neighbors.next;
  }
  return base;
}

/**
 * Active workshop queue (TZ §12.2, §15.9).
 * KPI filter: deleted_at IS NULL; statuses accepted…ready_for_pickup only.
 */
export async function listWorkshopQueue(user: SessionUser): Promise<WorkshopOrder[]> {
  assertWorkshopAccess(user);

  const rows = (await sql`
    SELECT
      o.id, o.order_number, c.name AS client_name, o.status,
      o.total_amount, o.sla_started_at, o.sla_stopped_at, o.created_at, o.is_urgent
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    WHERE o.deleted_at IS NULL
      AND o.status = ANY(${[...WORKSHOP_STATUSES]}::text[])
    ORDER BY
      CASE o.status
        WHEN 'accepted' THEN 1
        WHEN 'at_designer' THEN 2
        WHEN 'in_production' THEN 3
        WHEN 'ready_for_pickup' THEN 4
        ELSE 5
      END,
      o.created_at ASC
  `) as DbWorkshopOrder[];

  const edges = await loadActiveTransitions();
  if (rows.length === 0) return [];

  const orderIds = rows.map((r) => r.id);
  const itemRows = (await sql`
    SELECT
      oi.order_id,
      oi.position_number,
      oi.name,
      oi.quantity,
      oi.tech_params,
      EXISTS (
        SELECT 1 FROM files f
        WHERE f.order_item_id = oi.id
          AND f.block = 'client'
          AND f.upload_status = 'confirmed'
      ) AS has_layout
    FROM order_items oi
    WHERE oi.order_id = ANY(${orderIds}::uuid[])
    ORDER BY oi.position_number ASC
  `) as Array<{
    order_id: string;
    position_number: number;
    name: string;
    quantity: number;
    tech_params: string | null;
    has_layout: boolean;
  }>;

  const itemsByOrder = new Map<string, WorkshopOrderItem[]>();
  for (const row of itemRows) {
    const list = itemsByOrder.get(row.order_id) ?? [];
    list.push({
      positionNumber: Number(row.position_number),
      name: row.name,
      quantity: Number(row.quantity),
      techParams: row.tech_params,
      hasLayout: row.has_layout === true,
    });
    itemsByOrder.set(row.order_id, list);
  }

  return rows.map((row) => serialize(row, user.role, edges, itemsByOrder.get(row.id) ?? []));
}
