import { formatMoney2, lineTotal, recalcOrderTotal } from '@/lib/money';
import { sql } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import type { Role } from '@/lib/auth/permissions';
import { calendarDay, formatOrderNumber } from './order-number';
import type { CreateOrderInput } from './schemas';

export type CreateOrderItemInput = {
  categoryId: string;
  techParams?: string | null;
  quantity: number;
  unitPrice: string | number;
};

export type CreatedOrder = {
  id: string;
  orderNumber: string;
  orderDate: string;
  dailySequence: number;
  clientId: string;
  status: string;
  source: string;
  courierNote: string | null;
  totalAmount: string;
  createdByUserId: string;
  createdByRole: string;
  slaStartedAt: string;
  createdAt: string;
  updatedAt: string;
  ttnChecked: boolean;
  items: CreatedItem[];
};

export type CreatedItem = {
  id: string;
  positionNumber: number;
  categoryId: string;
  techParams: string | null;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

const CREATORS = new Set<Role>(['photo_center', 'production', 'admin']);

/**
 * Create order + items atomically via CTE (sequence + order + items).
 * Order number built in SQL to match formatOrderNumber (TZ §4.1).
 */
export async function createOrder(
  user: SessionUser,
  input: CreateOrderInput,
): Promise<CreatedOrder> {
  if (!CREATORS.has(user.role)) {
    throw new Error('forbidden');
  }

  let clientId: string;
  let source: 'photo_center' | 'production' | 'admin';

  if (user.role === 'photo_center') {
    if (!user.clientId) throw new Error('validation');
    clientId = user.clientId;
    source = 'photo_center';
  } else if (user.role === 'production') {
    if (!input.clientId) throw new Error('validation');
    clientId = input.clientId;
    source = 'production';
  } else {
    if (!input.clientId) throw new Error('validation');
    clientId = input.clientId;
    source = 'admin';
  }

  if (!input.items?.length) {
    throw new Error('validation');
  }

  const categoryIdsCheck = [...new Set(input.items.map((it) => it.categoryId))];
  const activeCats = (await sql`
    SELECT id FROM categories
    WHERE id = ANY(${categoryIdsCheck}::uuid[]) AND is_active = true
  `) as Array<{ id: string }>;
  if (activeCats.length !== categoryIdsCheck.length) {
    throw new Error('validation');
  }

  const prepared = input.items.map((it, idx) => {
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) {
      throw new Error('validation');
    }
    const unit = formatMoney2(it.unitPrice);
    if (Number(unit) < 0) throw new Error('validation');
    const lt = formatMoney2(lineTotal(it.quantity, unit));
    return {
      positionNumber: idx + 1,
      categoryId: it.categoryId,
      techParams: it.techParams ?? null,
      quantity: it.quantity,
      unitPrice: unit,
      lineTotal: lt,
    };
  });

  const total = formatMoney2(
    recalcOrderTotal(prepared.map((p) => ({ quantity: p.quantity, unitPrice: p.unitPrice }))),
  );

  const { yymmdd, orderDate } = calendarDay();
  const courierNote = input.courierNote ?? null;

  const positions = prepared.map((p) => p.positionNumber);
  const categoryIds = prepared.map((p) => p.categoryId);
  const techParams = prepared.map((p) => p.techParams ?? '');
  const quantities = prepared.map((p) => p.quantity);
  const unitPrices = prepared.map((p) => p.unitPrice);
  const lineTotals = prepared.map((p) => p.lineTotal);

  // Atomic: sequence upsert + order insert + items via unnest (Neon HTTP txn cannot chain results).
  const rows = await sql`
    WITH seq AS (
      INSERT INTO order_daily_sequences (order_date, last_sequence)
      VALUES (${orderDate}::date, 1)
      ON CONFLICT (order_date)
      DO UPDATE SET last_sequence = order_daily_sequences.last_sequence + 1
      RETURNING last_sequence
    ),
    ord AS (
      INSERT INTO orders (
        order_number, order_date, daily_sequence, client_id, status,
        created_by_user_id, created_by_role, source, courier_note,
        total_amount, sla_started_at
      )
      SELECT
        'DK-' || ${yymmdd} || '-' || seq.last_sequence::text,
        ${orderDate}::date,
        seq.last_sequence,
        ${clientId}::uuid,
        'new',
        ${user.id}::uuid,
        ${user.role},
        ${source},
        ${courierNote},
        ${total}::numeric,
        now()
      FROM seq
      RETURNING
        id, order_number, order_date, daily_sequence, client_id, status,
        created_by_user_id, created_by_role, source, courier_note,
        total_amount, sla_started_at, created_at, updated_at, ttn_checked
    ),
    items AS (
      INSERT INTO order_items (
        order_id, position_number, category_id, tech_params,
        quantity, unit_price, line_total
      )
      SELECT
        ord.id,
        t.position_number,
        t.category_id,
        NULLIF(t.tech_params, ''),
        t.quantity,
        t.unit_price,
        t.line_total
      FROM ord
      CROSS JOIN unnest(
        ${positions}::int[],
        ${categoryIds}::uuid[],
        ${techParams}::text[],
        ${quantities}::int[],
        ${unitPrices}::numeric[],
        ${lineTotals}::numeric[]
      ) AS t(
        position_number, category_id, tech_params,
        quantity, unit_price, line_total
      )
      RETURNING
        id, order_id, position_number, category_id, tech_params,
        quantity, unit_price, line_total
    )
    SELECT
      (SELECT row_to_json(o) FROM ord o) AS order_row,
      (SELECT coalesce(json_agg(row_to_json(i) ORDER BY i.position_number), '[]'::json)
         FROM items i) AS items_json
  `;

  const row = rows[0] as
    | {
        order_row: {
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
          total_amount: string;
          sla_started_at: string;
          created_at: string;
          updated_at: string;
          ttn_checked: boolean;
        };
        items_json: Array<{
          id: string;
          position_number: number;
          category_id: string;
          tech_params: string | null;
          quantity: number;
          unit_price: string;
          line_total: string;
        }>;
      }
    | undefined;

  if (!row?.order_row) {
    throw new Error('conflict');
  }

  const o = row.order_row;
  // Sanity: SQL concat matches formatOrderNumber rules
  const expected = formatOrderNumber(yymmdd, Number(o.daily_sequence));
  if (o.order_number !== expected) {
    console.warn('order_number mismatch', o.order_number, expected);
  }

  const itemsJson = Array.isArray(row.items_json) ? row.items_json : [];

  return {
    id: o.id,
    orderNumber: o.order_number,
    orderDate: String(o.order_date).slice(0, 10),
    dailySequence: Number(o.daily_sequence),
    clientId: o.client_id,
    status: o.status,
    source: o.source,
    courierNote: o.courier_note,
    totalAmount: formatMoney2(o.total_amount),
    createdByUserId: o.created_by_user_id,
    createdByRole: o.created_by_role,
    slaStartedAt: o.sla_started_at,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    ttnChecked: o.ttn_checked === true,
    items: itemsJson.map((i) => ({
      id: i.id,
      positionNumber: i.position_number,
      categoryId: i.category_id,
      techParams: i.tech_params,
      quantity: Number(i.quantity),
      unitPrice: formatMoney2(i.unit_price),
      lineTotal: formatMoney2(i.line_total),
    })),
  };
}
