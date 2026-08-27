import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { assertOrderAccess, type SessionUser } from '@/lib/auth/assertOrderAccess';
import { can, type PermissionFlags } from '@/lib/auth/permissions';

/** Pure password check — unit-testable without DB. */
export async function verifyUserPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export type SoftDeleteArgs = {
  orderId: string;
  user: SessionUser;
  password: string;
  comment: string;
  flags?: PermissionFlags;
};

/**
 * Soft-delete order (TZ §6.2 / §6.4). Does not change status.
 * Requires password of the current user.
 */
export async function softDeleteOrder({
  orderId,
  user,
  password,
  comment,
  flags,
}: SoftDeleteArgs): Promise<{ id: string }> {
  if (!can(user.role, 'soft_delete_order', flags)) {
    throw new Error('forbidden');
  }
  if (!comment.trim()) {
    throw new Error('validation');
  }

  const hashRows = await sql`
    SELECT password_hash FROM users WHERE id = ${user.id} LIMIT 1
  `;
  const hashRow = hashRows[0] as { password_hash: string } | undefined;
  if (!hashRow) {
    throw new Error('forbidden');
  }

  const ok = await verifyUserPassword(password, hashRow.password_hash);
  if (!ok) {
    throw new Error('invalid_password');
  }

  const orderRows = await sql`
    SELECT id, client_id, status, deleted_at
    FROM orders
    WHERE id = ${orderId}
    LIMIT 1
  `;
  const order = orderRows[0] as
    { id: string; client_id: string; status: string; deleted_at: string | null } | undefined;
  if (!order) {
    throw new Error('order_not_found');
  }

  assertOrderAccess(user, order, { includeDeleted: user.role === 'admin' });

  if (order.deleted_at) {
    throw new Error('conflict');
  }

  const updated = await sql`
    UPDATE orders
    SET
      deleted_at = now(),
      deleted_by_user_id = ${user.id},
      delete_comment = ${comment.trim()},
      sla_stopped_at = COALESCE(sla_stopped_at, now()),
      updated_at = now()
    WHERE id = ${orderId}
      AND deleted_at IS NULL
    RETURNING id
  `;

  if (!updated[0]) {
    throw new Error('conflict');
  }

  return { id: (updated[0] as { id: string }).id };
}
