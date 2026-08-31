import { formatMoney2, lineTotal } from '@/lib/money';
import { sql } from '@/lib/db';
import { assertOrderAccess, type SessionUser } from '@/lib/auth/assertOrderAccess';
import { can, type PermissionFlags } from '@/lib/auth/permissions';
import { loadCatalogProductSnapshot } from '@/lib/catalog/read';
import { assertCanEditOrderFields } from './edit-policy';
import { resolveOrderItemLine } from './item-input';
import type { addItemSchema } from './schemas';
import type { z } from 'zod';

type AddItemInput = z.infer<typeof addItemSchema>;

type OrderRow = {
  id: string;
  client_id: string;
  status: string;
  source: string;
  deleted_at: string | null;
};

type ItemRow = {
  id: string;
  order_id: string;
  position_number: number;
  category_id: string | null;
  catalog_product_id: string | null;
  is_manual: boolean;
  name: string;
  tech_params: string | null;
  quantity: number;
  unit_price: string;
  line_total: string;
};

function itemSnapshot(item: {
  name: string;
  quantity: number;
  unitPrice?: string;
  lineTotal?: string;
  categoryId?: string | null;
  techParams?: string | null;
}) {
  return {
    name: item.name,
    quantity: item.quantity,
    ...(item.categoryId !== undefined ? { categoryId: item.categoryId } : {}),
    ...(item.techParams !== undefined ? { techParams: item.techParams } : {}),
    ...(item.unitPrice !== undefined ? { unitPrice: item.unitPrice } : {}),
    ...(item.lineTotal !== undefined ? { lineTotal: item.lineTotal } : {}),
  };
}

async function loadOrderForEdit(orderId: string, user: SessionUser): Promise<OrderRow> {
  const rows = await sql`
    SELECT id, client_id, status, source, deleted_at
    FROM orders
    WHERE id = ${orderId}
    LIMIT 1
  `;
  const order = rows[0] as OrderRow | undefined;
  if (!order) throw new Error('order_not_found');
  assertOrderAccess(user, order);
  return order;
}

/**
 * Order total_amount is the DB sum of stored line_total NUMERIC values
 * (each line_total was written via formatMoney2 / lib/money). Same as
 * summing money-formatted lines; not IEEE float.
 */
function moneyFromDb(value: string | number): string {
  return formatMoney2(value);
}

function toItemRow(row: ItemRow): ItemRow {
  return {
    id: row.id,
    order_id: row.order_id,
    position_number: row.position_number,
    category_id: row.category_id,
    catalog_product_id: row.catalog_product_id,
    is_manual: row.is_manual === true,
    name: row.name,
    tech_params: row.tech_params,
    quantity: row.quantity,
    unit_price: row.unit_price,
    line_total: row.line_total,
  };
}

async function resolveAddItemInput(input: AddItemInput) {
  const catalogProduct =
    input.isManual || !input.catalogProductId
      ? null
      : await loadCatalogProductSnapshot(input.catalogProductId);
  return resolveOrderItemLine(input, catalogProduct);
}

export async function addOrderItem(
  user: SessionUser,
  orderId: string,
  input: AddItemInput,
): Promise<{ item: ItemRow; totalAmount: string }> {
  const order = await loadOrderForEdit(orderId, user);
  assertCanEditOrderFields(user, order, { reason: input.reason });

  const resolved = await resolveAddItemInput(input);
  const lt = formatMoney2(lineTotal(resolved.quantity, resolved.unitPrice));

  const posRows = await sql`
    SELECT coalesce(max(position_number), 0) + 1 AS next_pos
    FROM order_items
    WHERE order_id = ${orderId}
  `;
  const positionNumber = Number((posRows[0] as { next_pos: number }).next_pos);

  const rows = (await sql`
    WITH mutated AS (
      INSERT INTO order_items (
        order_id, position_number, category_id, catalog_product_id, is_manual,
        name, tech_params, quantity, unit_price, line_total
      )
      VALUES (
        ${orderId},
        ${positionNumber},
        ${resolved.categoryId}::uuid,
        ${resolved.catalogProductId}::uuid,
        ${resolved.isManual},
        ${resolved.name},
        ${resolved.techParams},
        ${resolved.quantity},
        ${resolved.unitPrice}::numeric,
        ${lt}::numeric
      )
      RETURNING id, order_id, position_number, category_id, catalog_product_id, is_manual,
                name, tech_params, quantity, unit_price, line_total
    ),
    totals AS (
      SELECT order_id, coalesce(sum(line_total), 0) AS total
      FROM order_items
      WHERE order_id = (SELECT order_id FROM mutated)
      GROUP BY order_id
    ),
    ord AS (
      UPDATE orders
      SET total_amount = totals.total, updated_at = now()
      FROM totals
      WHERE orders.id = totals.order_id
      RETURNING orders.total_amount
    )
    SELECT
      m.id, m.order_id, m.position_number, m.category_id, m.catalog_product_id, m.is_manual,
      m.name, m.tech_params, m.quantity, m.unit_price, m.line_total,
      ord.total_amount
    FROM mutated m
    CROSS JOIN ord
  `) as Array<ItemRow & { total_amount: string }>;

  const row = rows[0];
  if (!row) throw new Error('order_not_found');

  const item = toItemRow(row);

  await sql`
    INSERT INTO order_audit_logs (
      order_id, order_item_id, action, field_name, new_value, reason, user_id
    )
    VALUES (
      ${orderId},
      ${item.id},
      'add_item',
      null,
      ${JSON.stringify(
        itemSnapshot({
          name: resolved.name,
          quantity: resolved.quantity,
          unitPrice: resolved.unitPrice,
          lineTotal: lt,
          categoryId: resolved.categoryId ?? undefined,
          techParams: resolved.techParams,
        }),
      )},
      ${input.reason ?? null},
      ${user.id}
    )
  `;

  return { item, totalAmount: moneyFromDb(row.total_amount) };
}

export async function patchOrderItem(
  user: SessionUser,
  orderId: string,
  itemId: string,
  input: {
    categoryId?: string;
    name?: string;
    techParams?: string | null;
    quantity?: number;
    reason?: string;
  },
): Promise<{ item: ItemRow; totalAmount: string }> {
  const order = await loadOrderForEdit(orderId, user);
  assertCanEditOrderFields(user, order, { reason: input.reason });

  const itemRows = await sql`
    SELECT id, order_id, position_number, category_id, catalog_product_id, is_manual,
           name, tech_params, quantity, unit_price, line_total
    FROM order_items
    WHERE id = ${itemId} AND order_id = ${orderId}
    LIMIT 1
  `;
  const existing = itemRows[0] as ItemRow | undefined;
  if (!existing) throw new Error('item_not_found');

  const quantity = input.quantity ?? Number(existing.quantity);
  const categoryId = input.categoryId ?? existing.category_id;
  const name = input.name ?? existing.name;
  const techParams = input.techParams !== undefined ? input.techParams : existing.tech_params;

  const unchanged =
    categoryId === existing.category_id &&
    name === existing.name &&
    (techParams ?? null) === (existing.tech_params ?? null) &&
    quantity === Number(existing.quantity);

  if (unchanged) {
    const totalRows = await sql`
      SELECT total_amount FROM orders WHERE id = ${orderId} LIMIT 1
    `;
    const totalAmount = (totalRows[0] as { total_amount: string } | undefined)?.total_amount;
    if (totalAmount == null) throw new Error('order_not_found');
    return { item: toItemRow(existing), totalAmount: moneyFromDb(totalAmount) };
  }

  const unit = formatMoney2(existing.unit_price);
  const lt = formatMoney2(lineTotal(quantity, unit));

  const rows = (await sql`
    WITH mutated AS (
      UPDATE order_items
      SET
        category_id = ${categoryId}::uuid,
        name = ${name},
        tech_params = ${techParams},
        quantity = ${quantity},
        line_total = ${lt}::numeric
      WHERE id = ${itemId} AND order_id = ${orderId}
      RETURNING id, order_id, position_number, category_id, catalog_product_id, is_manual,
                name, tech_params, quantity, unit_price, line_total
    ),
    totals AS (
      SELECT order_id, coalesce(sum(line_total), 0) AS total
      FROM order_items
      WHERE order_id = (SELECT order_id FROM mutated)
      GROUP BY order_id
    ),
    ord AS (
      UPDATE orders
      SET total_amount = totals.total, updated_at = now()
      FROM totals
      WHERE orders.id = totals.order_id
      RETURNING orders.total_amount
    )
    SELECT
      m.id, m.order_id, m.position_number, m.category_id, m.catalog_product_id, m.is_manual,
      m.name, m.tech_params, m.quantity, m.unit_price, m.line_total,
      ord.total_amount
    FROM mutated m
    CROSS JOIN ord
  `) as Array<ItemRow & { total_amount: string }>;

  const row = rows[0];
  if (!row) throw new Error('item_not_found');

  const item = toItemRow(row);

  await sql`
    INSERT INTO order_audit_logs (
      order_id, order_item_id, action, field_name, old_value, new_value, reason, user_id
    )
    VALUES (
      ${orderId},
      ${itemId},
      'patch_item',
      null,
      ${JSON.stringify(
        itemSnapshot({
          name: existing.name,
          quantity: Number(existing.quantity),
          categoryId: existing.category_id,
          techParams: existing.tech_params,
        }),
      )},
      ${JSON.stringify(
        itemSnapshot({
          name,
          quantity,
          categoryId,
          techParams: techParams ?? null,
        }),
      )},
      ${input.reason ?? null},
      ${user.id}
    )
  `;

  return { item, totalAmount: moneyFromDb(row.total_amount) };
}

export async function deleteOrderItem(
  user: SessionUser,
  orderId: string,
  itemId: string,
  reason?: string,
): Promise<{ totalAmount: string }> {
  const order = await loadOrderForEdit(orderId, user);
  assertCanEditOrderFields(user, order, { reason });

  // Atomic last-item guard + delete + total recalc (sum of remaining line_totals).
  // Do not set order_item_id on audit: FK would block DELETE of the item.
  const rows = (await sql`
    WITH victim AS (
      SELECT id FROM order_items WHERE id = ${itemId} AND order_id = ${orderId}
    ),
    cnt AS (
      SELECT count(*)::int AS c FROM order_items WHERE order_id = ${orderId}
    ),
    deleted AS (
      DELETE FROM order_items oi
      USING victim, cnt
      WHERE oi.id = victim.id AND cnt.c > 1
      RETURNING oi.order_id
    ),
    totals AS (
      SELECT coalesce(sum(line_total), 0) AS total
      FROM order_items
      WHERE order_id = ${orderId}
    ),
    ord AS (
      UPDATE orders
      SET total_amount = (SELECT total FROM totals), updated_at = now()
      WHERE id = ${orderId} AND EXISTS (SELECT 1 FROM deleted)
      RETURNING total_amount
    )
    SELECT
      (SELECT total_amount FROM ord) AS total_amount,
      EXISTS (SELECT 1 FROM victim) AS item_found,
      (SELECT c FROM cnt) AS item_count,
      EXISTS (SELECT 1 FROM deleted) AS did_delete
  `) as Array<{
    total_amount: string | null;
    item_found: boolean;
    item_count: number;
    did_delete: boolean;
  }>;

  const result = rows[0];
  if (!result?.did_delete) {
    if (!result?.item_found) throw new Error('item_not_found');
    if (Number(result.item_count) <= 1) throw new Error('cannot_delete_last_item');
    throw new Error('item_not_found');
  }

  await sql`
    INSERT INTO order_audit_logs (
      order_id, action, field_name, old_value, reason, user_id
    )
    VALUES (
      ${orderId},
      'delete_item',
      'order_item_id',
      ${itemId},
      ${reason ?? null},
      ${user.id}
    )
  `;

  return { totalAmount: moneyFromDb(result.total_amount!) };
}

export async function patchItemPrice(
  user: SessionUser,
  orderId: string,
  itemId: string,
  unitPrice: string | number,
  reason: string | undefined,
  flags?: PermissionFlags,
): Promise<{ item: ItemRow; totalAmount: string }> {
  if (!can(user.role, 'edit_price', flags)) {
    throw new Error('forbidden');
  }

  const order = await loadOrderForEdit(orderId, user);
  if (order.deleted_at || order.status === 'cancelled') {
    throw new Error('forbidden');
  }

  const itemRows = await sql`
    SELECT id, order_id, position_number, category_id, catalog_product_id, is_manual,
           name, tech_params, quantity, unit_price, line_total
    FROM order_items
    WHERE id = ${itemId} AND order_id = ${orderId}
    LIMIT 1
  `;
  const existing = itemRows[0] as ItemRow | undefined;
  if (!existing) throw new Error('item_not_found');

  const unit = formatMoney2(unitPrice);
  const oldUnit = formatMoney2(existing.unit_price);

  if (unit === oldUnit) {
    const totalRows = await sql`
      SELECT total_amount FROM orders WHERE id = ${orderId} LIMIT 1
    `;
    const totalAmount = (totalRows[0] as { total_amount: string } | undefined)?.total_amount;
    if (totalAmount == null) throw new Error('order_not_found');
    return { item: toItemRow(existing), totalAmount: moneyFromDb(totalAmount) };
  }

  const lt = formatMoney2(lineTotal(Number(existing.quantity), unit));

  const rows = (await sql`
    WITH mutated AS (
      UPDATE order_items
      SET unit_price = ${unit}::numeric, line_total = ${lt}::numeric
      WHERE id = ${itemId} AND order_id = ${orderId}
      RETURNING id, order_id, position_number, category_id, catalog_product_id, is_manual,
                name, tech_params, quantity, unit_price, line_total
    ),
    totals AS (
      SELECT order_id, coalesce(sum(line_total), 0) AS total
      FROM order_items
      WHERE order_id = (SELECT order_id FROM mutated)
      GROUP BY order_id
    ),
    ord AS (
      UPDATE orders
      SET total_amount = totals.total, updated_at = now()
      FROM totals
      WHERE orders.id = totals.order_id
      RETURNING orders.total_amount
    )
    SELECT
      m.id, m.order_id, m.position_number, m.category_id, m.catalog_product_id, m.is_manual,
      m.name, m.tech_params, m.quantity, m.unit_price, m.line_total,
      ord.total_amount
    FROM mutated m
    CROSS JOIN ord
  `) as Array<ItemRow & { total_amount: string }>;

  const row = rows[0];
  if (!row) throw new Error('item_not_found');

  const item = toItemRow(row);

  await sql`
    INSERT INTO order_audit_logs (
      order_id, order_item_id, action, field_name, old_value, new_value, reason, user_id
    )
    VALUES (
      ${orderId},
      ${itemId},
      'patch_price',
      'unit_price',
      ${oldUnit},
      ${unit},
      ${reason ?? null},
      ${user.id}
    )
  `;

  return { item, totalAmount: moneyFromDb(row.total_amount) };
}
