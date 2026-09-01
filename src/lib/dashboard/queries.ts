import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import { navItemsFor } from '@/lib/auth/nav';
import type { PermissionFlags } from '@/lib/auth/permissions';
import { sql } from '@/lib/db';
import { toApiNumber } from '@/lib/money';
import { ORDER_STATUSES, statusLabel } from '@/lib/orders/status-labels';
import { ratePct } from '@/lib/reports/math';
import { defaultReportPeriod, type ReportPeriod } from '@/lib/reports/period';
import { FALLBACK_SLA_TARGET_HOURS } from '@/lib/sla/constants';
import { WORKSHOP_STATUSES } from '@/lib/workshop/constants';
import {
  canSeeDashboardKpi,
  canSeeSlaMetrics,
  canSeeTasksMetrics,
  canSeeWorkshopMetrics,
  courierDeliveryEmphasis,
} from './access';
import { orderVisibilitySql } from './visibility';

const MONTH_NAMES_RU = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];

export function dashboardPeriodLabel(period: ReportPeriod): string {
  const m = Number.parseInt(period.from.slice(5, 7), 10);
  const y = period.from.slice(0, 4);
  const name = MONTH_NAMES_RU[m - 1] ?? period.from.slice(0, 7);
  return `${name} ${y}`;
}

export type DashboardRecentOrder = {
  id: string;
  orderNumber: string;
  clientName: string | null;
  status: string;
  totalAmount: number;
  isUrgent: boolean;
  createdAt: string;
};

export type DashboardSlaPreviewRow = {
  orderId: string;
  orderNumber: string;
  clientName: string;
  status: string;
  overdueHours: number;
};

export type DashboardPayload = {
  period: ReportPeriod & { label: string };
  statusCounts: Array<{ status: string; label: string; count: number }>;
  urgentCount: number;
  recentOrders: DashboardRecentOrder[];
  workshopQueueCount?: number;
  slaOverdue?: { count: number; preview: DashboardSlaPreviewRow[] };
  tasks?: { openCount: number; overdueCount: number };
  kpi?: {
    orderCount: number;
    revenue: number;
    avgCheck: number;
    deliveredPct: number;
  };
  deliveryEmphasis: boolean;
  quickLinks: Array<{ href: string; label: string }>;
  showReportsLink: boolean;
};

async function loadSlaTargetHours(): Promise<number> {
  const goalRows = (await sql`
    SELECT target_hours
    FROM sla_goals
    WHERE is_system_default = true AND is_active = true
    ORDER BY target_hours ASC
    LIMIT 1
  `) as Array<{ target_hours: number }>;
  const h = goalRows[0]?.target_hours;
  return typeof h === 'number' && h > 0 ? h : FALLBACK_SLA_TARGET_HOURS;
}

async function dashboardKpiSummary(
  user: SessionUser,
  period: ReportPeriod,
): Promise<DashboardPayload['kpi']> {
  const { clientId, statuses, excludeDeleted } = orderVisibilitySql(user);

  const rows = (await sql`
    SELECT
      COUNT(*)::int AS order_count,
      COALESCE(SUM(o.total_amount), 0) AS revenue,
      COALESCE(AVG(o.total_amount), 0) AS avg_check,
      COUNT(*) FILTER (WHERE o.status = 'delivered')::int AS delivered_count
    FROM orders o
    WHERE o.deleted_at IS NULL
      AND o.status <> 'cancelled'
      AND o.order_date >= ${period.from}::date
      AND o.order_date <= ${period.to}::date
      AND (${excludeDeleted} = false OR o.deleted_at IS NULL)
      AND (${clientId}::uuid IS NULL OR o.client_id = ${clientId}::uuid)
      AND (${statuses}::text[] IS NULL OR o.status = ANY(${statuses}::text[]))
  `) as Array<{
    order_count: number;
    revenue: string | number;
    avg_check: string | number;
    delivered_count: number;
  }>;

  const row = rows[0]!;
  return {
    orderCount: row.order_count,
    revenue: toApiNumber(row.revenue),
    avgCheck: toApiNumber(row.avg_check),
    deliveredPct: ratePct(row.delivered_count, row.order_count),
  };
}

export async function dashboardPayload(
  user: SessionUser,
  flags: PermissionFlags,
  now: Date = new Date(),
): Promise<DashboardPayload> {
  const period = defaultReportPeriod(now);
  const periodWithLabel = { ...period, label: dashboardPeriodLabel(period) };
  const vis = orderVisibilitySql(user);

  const statusRows = (await sql`
    SELECT o.status, COUNT(*)::int AS count
    FROM orders o
    WHERE (${vis.excludeDeleted} = false OR o.deleted_at IS NULL)
      AND (${vis.clientId}::uuid IS NULL OR o.client_id = ${vis.clientId}::uuid)
      AND (${vis.statuses}::text[] IS NULL OR o.status = ANY(${vis.statuses}::text[]))
    GROUP BY o.status
  `) as Array<{ status: string; count: number }>;

  const statusMap = new Map(statusRows.map((r) => [r.status, r.count]));
  const statusCounts = ORDER_STATUSES.map((status) => ({
    status,
    label: statusLabel(status),
    count: statusMap.get(status) ?? 0,
  }));

  const urgentRows = (await sql`
    SELECT COUNT(*)::int AS count
    FROM orders o
    WHERE o.is_urgent = true
      AND o.deleted_at IS NULL
      AND o.status NOT IN ('cancelled', 'delivered')
      AND (${vis.clientId}::uuid IS NULL OR o.client_id = ${vis.clientId}::uuid)
      AND (${vis.statuses}::text[] IS NULL OR o.status = ANY(${vis.statuses}::text[]))
  `) as Array<{ count: number }>;

  const recentRows = (await sql`
    SELECT
      o.id,
      o.order_number,
      c.name AS client_name,
      o.status,
      o.total_amount,
      o.is_urgent,
      o.created_at
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    WHERE (${vis.excludeDeleted} = false OR o.deleted_at IS NULL)
      AND (${vis.clientId}::uuid IS NULL OR o.client_id = ${vis.clientId}::uuid)
      AND (${vis.statuses}::text[] IS NULL OR o.status = ANY(${vis.statuses}::text[]))
    ORDER BY o.created_at DESC
    LIMIT 8
  `) as Array<{
    id: string;
    order_number: string;
    client_name: string | null;
    status: string;
    total_amount: string;
    is_urgent: boolean;
    created_at: string;
  }>;

  const recentOrders: DashboardRecentOrder[] = recentRows.map((r) => ({
    id: r.id,
    orderNumber: r.order_number,
    clientName: r.client_name,
    status: r.status,
    totalAmount: toApiNumber(r.total_amount),
    isUrgent: r.is_urgent === true,
    createdAt: r.created_at,
  }));

  const payload: DashboardPayload = {
    period: periodWithLabel,
    statusCounts,
    urgentCount: urgentRows[0]?.count ?? 0,
    recentOrders,
    deliveryEmphasis: courierDeliveryEmphasis(user.role),
    quickLinks: navItemsFor(user.role, flags).filter((item) => item.href !== '/dashboard'),
    showReportsLink: canSeeDashboardKpi(user.role, flags),
  };

  if (canSeeWorkshopMetrics(user.role)) {
    const workshopRows = (await sql`
      SELECT COUNT(*)::int AS count
      FROM orders o
      WHERE o.deleted_at IS NULL
        AND o.status = ANY(${[...WORKSHOP_STATUSES]}::text[])
    `) as Array<{ count: number }>;
    payload.workshopQueueCount = workshopRows[0]?.count ?? 0;
  }

  if (canSeeSlaMetrics(user.role)) {
    const targetHours = await loadSlaTargetHours();
    const slaRows = (await sql`
      SELECT
        o.id,
        o.order_number,
        c.name AS client_name,
        o.status,
        EXTRACT(
          EPOCH FROM (now() - (o.sla_started_at + (${targetHours} * interval '1 hour')))
        ) / 3600.0 AS overdue_hours
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      WHERE o.deleted_at IS NULL
        AND o.status NOT IN ('cancelled', 'delivered')
        AND o.sla_stopped_at IS NULL
        AND o.sla_started_at + (${targetHours} * interval '1 hour') < now()
      ORDER BY o.sla_started_at ASC
      LIMIT 5
    `) as Array<{
      id: string;
      order_number: string;
      client_name: string;
      status: string;
      overdue_hours: string | number;
    }>;

    const countRows = (await sql`
      SELECT COUNT(*)::int AS count
      FROM orders o
      WHERE o.deleted_at IS NULL
        AND o.status NOT IN ('cancelled', 'delivered')
        AND o.sla_stopped_at IS NULL
        AND o.sla_started_at + (${targetHours} * interval '1 hour') < now()
    `) as Array<{ count: number }>;

    payload.slaOverdue = {
      count: countRows[0]?.count ?? 0,
      preview: slaRows.map((r) => ({
        orderId: r.id,
        orderNumber: r.order_number,
        clientName: r.client_name,
        status: r.status,
        overdueHours: toApiNumber(r.overdue_hours),
      })),
    };
  }

  if (canSeeTasksMetrics(user.role)) {
    const taskRows = (await sql`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('open', 'in_progress'))::int AS open_count,
        COUNT(*) FILTER (
          WHERE status IN ('open', 'in_progress')
            AND due_at IS NOT NULL
            AND due_at < now()
        )::int AS overdue_count
      FROM tasks
      WHERE assignee_user_id = ${user.id}::uuid
         OR creator_user_id = ${user.id}::uuid
    `) as Array<{ open_count: number; overdue_count: number }>;

    payload.tasks = {
      openCount: taskRows[0]?.open_count ?? 0,
      overdueCount: taskRows[0]?.overdue_count ?? 0,
    };
  }

  if (canSeeDashboardKpi(user.role, flags)) {
    payload.kpi = await dashboardKpiSummary(user, period);
  }

  return payload;
}
