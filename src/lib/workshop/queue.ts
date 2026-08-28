import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import { sql } from '@/lib/db';
import { toApiNumber } from '@/lib/money';
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
};

function serialize(row: DbWorkshopOrder): WorkshopOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    clientName: row.client_name,
    status: row.status,
    totalAmount: toApiNumber(row.total_amount),
    slaStartedAt: row.sla_started_at,
    slaStoppedAt: row.sla_stopped_at,
    createdAt: row.created_at,
  };
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
      o.total_amount, o.sla_started_at, o.sla_stopped_at, o.created_at
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

  return rows.map(serialize);
}
