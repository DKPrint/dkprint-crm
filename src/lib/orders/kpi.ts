/** KPI / revenue inclusion (TZ §6.1, §20.5.5). */

export type KpiOrderFields = {
  deleted_at: string | null;
  status: string;
};

/** Pure predicate: order counts toward KPI / revenue. */
export function isInKpi(order: KpiOrderFields): boolean {
  return order.deleted_at == null && order.status !== 'cancelled';
}

/** SQL fragment text for WHERE clauses (compose carefully). */
export const KPI_SQL_PREDICATE = `deleted_at IS NULL AND status <> 'cancelled'`;
