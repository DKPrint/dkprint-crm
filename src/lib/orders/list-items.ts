import { sql } from '@/lib/db';

export type OrderListItem = {
  positionNumber: number;
  name: string;
  quantity: number;
  techParams: string | null;
  hasLayout: boolean;
};

type DbListItemRow = {
  order_id: string;
  position_number: number;
  name: string;
  quantity: number;
  tech_params: string | null;
  has_layout: boolean;
};

/** Pure grouping — unit-testable without DB. */
export function groupItemsByOrderId(rows: DbListItemRow[]): Map<string, OrderListItem[]> {
  const itemsByOrder = new Map<string, OrderListItem[]>();
  for (const row of rows) {
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
  return itemsByOrder;
}

/** Batch-load lightweight item rows for order list / workshop-style expand (≤200 orders). */
export async function loadOrderListItems(
  orderIds: string[],
): Promise<Map<string, OrderListItem[]>> {
  if (orderIds.length === 0) return new Map();

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
  `) as DbListItemRow[];

  return groupItemsByOrderId(itemRows);
}
