import { sql } from '@/lib/db';
import { assertOrderAccess, type SessionUser } from '@/lib/auth/assertOrderAccess';
import { assertCanEditOrderFields } from './edit-policy';
import type { PatchOrderInput } from './schemas';

type OrderEditRow = {
  id: string;
  client_id: string;
  status: string;
  source: string;
  deleted_at: string | null;
  courier_note: string | null;
};

/**
 * PATCH order fields with edit-policy + audit when reason required (TZ §4.5).
 */
export async function updateOrder(
  user: SessionUser,
  orderId: string,
  input: PatchOrderInput,
): Promise<{ id: string }> {
  const rows = await sql`
    SELECT id, client_id, status, source, deleted_at, courier_note
    FROM orders
    WHERE id = ${orderId}
    LIMIT 1
  `;
  const order = rows[0] as OrderEditRow | undefined;
  if (!order) throw new Error('order_not_found');

  assertOrderAccess(user, order);
  assertCanEditOrderFields(user, order, { reason: input.reason });

  if (input.courierNote === undefined) {
    return { id: order.id };
  }

  const oldNote = order.courier_note;
  const newNote = input.courierNote;

  await sql`
    UPDATE orders
    SET courier_note = ${newNote}, updated_at = now()
    WHERE id = ${orderId}
      AND deleted_at IS NULL
      AND status <> 'cancelled'
  `;

  if (user.role === 'photo_center' || input.reason) {
    await sql`
      INSERT INTO order_audit_logs (
        order_id, action, field_name, old_value, new_value, reason, user_id
      )
      VALUES (
        ${orderId},
        'update_order',
        'courier_note',
        ${oldNote},
        ${newNote},
        ${input.reason ?? null},
        ${user.id}
      )
    `;
  }

  return { id: order.id };
}

/** PATCH ttn_checked — production|admin (TZ §15.2). */
export async function updateTtn(
  user: SessionUser,
  orderId: string,
  ttnChecked: boolean,
): Promise<{ id: string; ttnChecked: boolean }> {
  if (user.role !== 'production' && user.role !== 'admin') {
    throw new Error('forbidden');
  }

  const rows = await sql`
    SELECT id, client_id, status, deleted_at, ttn_checked
    FROM orders
    WHERE id = ${orderId}
    LIMIT 1
  `;
  const order = rows[0] as
    | {
        id: string;
        client_id: string;
        status: string;
        deleted_at: string | null;
        ttn_checked: boolean;
      }
    | undefined;
  if (!order) throw new Error('order_not_found');
  if (order.deleted_at || order.status === 'cancelled') throw new Error('forbidden');

  assertOrderAccess(user, order);

  const updated = await sql`
    UPDATE orders
    SET ttn_checked = ${ttnChecked}, updated_at = now()
    WHERE id = ${orderId}
    RETURNING id, ttn_checked
  `;
  const u = updated[0] as { id: string; ttn_checked: boolean };
  return { id: u.id, ttnChecked: u.ttn_checked === true };
}

/** PATCH courier_note with access + edit policy. */
export async function updateCourierNote(
  user: SessionUser,
  orderId: string,
  courierNote: string | null,
  reason?: string,
): Promise<{ id: string }> {
  return updateOrder(user, orderId, { courierNote, reason });
}
