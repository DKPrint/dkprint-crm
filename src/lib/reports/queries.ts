import { sql } from '@/lib/db';
import { toApiNumber } from '@/lib/money';
import { ORDER_STATUSES, statusLabel } from '@/lib/orders/status-labels';
import { FALLBACK_SLA_TARGET_HOURS } from '@/lib/sla/constants';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/lib/tasks/schemas';
import { priorityLabel, statusLabel as taskStatusLabel } from '@/lib/tasks/labels';
import { ratePct } from './math';
import type { ReportPeriod } from './period';

export type ReportSummary = {
  period: ReportPeriod;
  orderCount: number;
  revenue: number;
  avgCheck: number;
  deliveredPct: number;
};

export async function reportSummary(period: ReportPeriod): Promise<ReportSummary> {
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
  `) as Array<{
    order_count: number;
    revenue: string | number;
    avg_check: string | number;
    delivered_count: number;
  }>;

  const row = rows[0]!;
  return {
    period,
    orderCount: row.order_count,
    revenue: toApiNumber(row.revenue),
    avgCheck: toApiNumber(row.avg_check),
    deliveredPct: ratePct(row.delivered_count, row.order_count),
  };
}

export type FunnelRow = {
  status: string;
  label: string;
  count: number;
};

export async function reportFunnel(period: ReportPeriod): Promise<{
  period: ReportPeriod;
  rows: FunnelRow[];
}> {
  const rows = (await sql`
    SELECT o.status, COUNT(*)::int AS count
    FROM orders o
    WHERE o.deleted_at IS NULL
      AND o.order_date >= ${period.from}::date
      AND o.order_date <= ${period.to}::date
    GROUP BY o.status
  `) as Array<{ status: string; count: number }>;

  const byStatus = new Map(rows.map((r) => [r.status, r.count]));
  return {
    period,
    rows: ORDER_STATUSES.map((status) => ({
      status,
      label: statusLabel(status),
      count: byStatus.get(status) ?? 0,
    })),
  };
}

export type ByClientRow = {
  clientId: string;
  clientName: string;
  orderCount: number;
  revenue: number;
};

export async function reportByClient(period: ReportPeriod): Promise<{
  period: ReportPeriod;
  rows: ByClientRow[];
}> {
  const rows = (await sql`
    SELECT
      c.id AS client_id,
      c.name AS client_name,
      COUNT(*)::int AS order_count,
      COALESCE(SUM(o.total_amount), 0) AS revenue
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    WHERE o.deleted_at IS NULL
      AND o.status <> 'cancelled'
      AND o.order_date >= ${period.from}::date
      AND o.order_date <= ${period.to}::date
    GROUP BY c.id, c.name
    ORDER BY revenue DESC, order_count DESC
    LIMIT 200
  `) as Array<{
    client_id: string;
    client_name: string;
    order_count: number;
    revenue: string | number;
  }>;

  return {
    period,
    rows: rows.map((r) => ({
      clientId: r.client_id,
      clientName: r.client_name,
      orderCount: r.order_count,
      revenue: toApiNumber(r.revenue),
    })),
  };
}

export type ByCategoryRow = {
  categoryKey: string;
  categoryName: string;
  lineCount: number;
  revenue: number;
};

export async function reportByCategory(period: ReportPeriod): Promise<{
  period: ReportPeriod;
  rows: ByCategoryRow[];
}> {
  const rows = (await sql`
    SELECT
      COALESCE(oi.catalog_category_id::text, cc.id::text, legacy_cat.id::text, 'none') AS category_key,
      COALESCE(
        oi.catalog_category_path,
        CASE
          WHEN cc_parent.id IS NOT NULL THEN cc_parent.name || ' / ' || cc.name
          ELSE cc.name
        END,
        legacy_cat.name,
        'Без категории'
      ) AS category_name,
      COUNT(*)::int AS line_count,
      COALESCE(SUM(oi.line_total), 0) AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN catalog_categories cc ON cc.id = oi.category_id
    LEFT JOIN catalog_categories cc_parent ON cc_parent.id = cc.parent_id
    LEFT JOIN categories legacy_cat
      ON legacy_cat.id = oi.category_id AND cc.id IS NULL
    WHERE o.deleted_at IS NULL
      AND o.status <> 'cancelled'
      AND o.order_date >= ${period.from}::date
      AND o.order_date <= ${period.to}::date
    GROUP BY 1, 2
    ORDER BY revenue DESC, line_count DESC
    LIMIT 200
  `) as Array<{
    category_key: string;
    category_name: string;
    line_count: number;
    revenue: string | number;
  }>;

  return {
    period,
    rows: rows.map((r) => ({
      categoryKey: r.category_key,
      categoryName: r.category_name,
      lineCount: r.line_count,
      revenue: toApiNumber(r.revenue),
    })),
  };
}

export type SlaOverdueRow = {
  orderId: string;
  orderNumber: string;
  clientName: string;
  status: string;
  slaStartedAt: string;
  overdueHours: number;
};

export async function reportSlaOverdue(period: ReportPeriod): Promise<{
  period: ReportPeriod;
  targetHours: number;
  rows: SlaOverdueRow[];
}> {
  const goalRows = (await sql`
    SELECT target_hours
    FROM sla_goals
    WHERE is_system_default = true AND is_active = true
    ORDER BY target_hours ASC
    LIMIT 1
  `) as Array<{ target_hours: number }>;
  const targetHours =
    typeof goalRows[0]?.target_hours === 'number' && goalRows[0].target_hours > 0
      ? goalRows[0].target_hours
      : FALLBACK_SLA_TARGET_HOURS;

  const rows = (await sql`
    SELECT
      o.id,
      o.order_number,
      c.name AS client_name,
      o.status,
      o.sla_started_at,
      EXTRACT(
        EPOCH FROM (now() - (o.sla_started_at + (${targetHours} * interval '1 hour')))
      ) / 3600.0 AS overdue_hours
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    WHERE o.deleted_at IS NULL
      AND o.status NOT IN ('cancelled', 'delivered')
      AND o.sla_stopped_at IS NULL
      AND o.sla_started_at + (${targetHours} * interval '1 hour') < now()
      AND o.order_date >= ${period.from}::date
      AND o.order_date <= ${period.to}::date
    ORDER BY o.sla_started_at ASC
    LIMIT 500
  `) as Array<{
    id: string;
    order_number: string;
    client_name: string;
    status: string;
    sla_started_at: string;
    overdue_hours: string | number;
  }>;

  return {
    period,
    targetHours,
    rows: rows.map((r) => ({
      orderId: r.id,
      orderNumber: r.order_number,
      clientName: r.client_name,
      status: r.status,
      slaStartedAt: r.sla_started_at,
      overdueHours: toApiNumber(r.overdue_hours),
    })),
  };
}

export type TasksReport = {
  period: ReportPeriod;
  byStatus: Array<{ status: string; label: string; count: number }>;
  byPriority: Array<{ priority: string; label: string; count: number }>;
  openOverdueCount: number;
};

export async function reportTasks(period: ReportPeriod): Promise<TasksReport> {
  const statusRows = (await sql`
    SELECT status, COUNT(*)::int AS count
    FROM tasks
    WHERE created_at::date >= ${period.from}::date
      AND created_at::date <= ${period.to}::date
    GROUP BY status
  `) as Array<{ status: string; count: number }>;

  const priorityRows = (await sql`
    SELECT priority, COUNT(*)::int AS count
    FROM tasks
    WHERE created_at::date >= ${period.from}::date
      AND created_at::date <= ${period.to}::date
    GROUP BY priority
  `) as Array<{ priority: string; count: number }>;

  const overdueRows = (await sql`
    SELECT COUNT(*)::int AS count
    FROM tasks
    WHERE created_at::date >= ${period.from}::date
      AND created_at::date <= ${period.to}::date
      AND status IN ('open', 'in_progress')
      AND due_at IS NOT NULL
      AND due_at < now()
  `) as Array<{ count: number }>;

  const byStatusMap = new Map(statusRows.map((r) => [r.status, r.count]));
  const byPriorityMap = new Map(priorityRows.map((r) => [r.priority, r.count]));

  return {
    period,
    byStatus: TASK_STATUSES.map((status) => ({
      status,
      label: taskStatusLabel(status),
      count: byStatusMap.get(status) ?? 0,
    })),
    byPriority: TASK_PRIORITIES.map((priority) => ({
      priority,
      label: priorityLabel(priority),
      count: byPriorityMap.get(priority) ?? 0,
    })),
    openOverdueCount: overdueRows[0]?.count ?? 0,
  };
}

export type TtnRateReport = {
  period: ReportPeriod;
  total: number;
  checked: number;
  ratePct: number;
};

export async function reportTtnRate(period: ReportPeriod): Promise<TtnRateReport> {
  const rows = (await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE o.ttn_checked)::int AS checked
    FROM orders o
    WHERE o.deleted_at IS NULL
      AND o.status <> 'cancelled'
      AND o.order_date >= ${period.from}::date
      AND o.order_date <= ${period.to}::date
  `) as Array<{ total: number; checked: number }>;

  const row = rows[0]!;
  return {
    period,
    total: row.total,
    checked: row.checked,
    ratePct: ratePct(row.checked, row.total),
  };
}
