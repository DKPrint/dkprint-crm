import { assertOrderAccess, type SessionUser } from '@/lib/auth/assertOrderAccess';
import { sql } from '@/lib/db';
import { assertCanWriteComment } from './permissions';

type DbComment = {
  id: string;
  order_id: string;
  user_id: string;
  author_name: string;
  body: string;
  is_problematic_layout: boolean;
  created_at: string;
};

export type CommentMeta = {
  id: string;
  orderId: string;
  userId: string;
  authorName: string;
  body: string;
  isProblematicLayout: boolean;
  createdAt: string;
};

function serialize(row: DbComment): CommentMeta {
  return {
    id: row.id,
    orderId: row.order_id,
    userId: row.user_id,
    authorName: row.author_name,
    body: row.body,
    isProblematicLayout: row.is_problematic_layout === true,
    createdAt: row.created_at,
  };
}

async function getOrderAccessRow(orderId: string) {
  const rows = await sql`
    SELECT client_id, status, deleted_at
    FROM orders
    WHERE id = ${orderId}
    LIMIT 1
  `;
  const order = rows[0] as
    { client_id: string; status: string; deleted_at: string | null } | undefined;
  if (!order) throw new Error('order_not_found');
  return order;
}

export async function listCommentsForOrder(
  user: SessionUser,
  orderId: string,
  opts: { includeDeleted?: boolean } = {},
): Promise<CommentMeta[]> {
  const order = await getOrderAccessRow(orderId);
  assertOrderAccess(user, order, opts);

  const rows = (await sql`
    SELECT
      c.id, c.order_id, c.user_id, u.display_name AS author_name,
      c.body, c.is_problematic_layout, c.created_at
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.order_id = ${orderId}
    ORDER BY c.created_at DESC
  `) as DbComment[];

  return rows.map(serialize);
}

/** Clear ⚠️ Problematic layout on all comments (TZ §10.1 — production/admin). */
export async function clearProblematicLayout(
  user: SessionUser,
  orderId: string,
): Promise<{ cleared: number }> {
  if (user.role !== 'admin' && user.role !== 'production') {
    throw new Error('forbidden');
  }

  const order = await getOrderAccessRow(orderId);
  assertOrderAccess(user, order);
  if (order.deleted_at) throw new Error('forbidden');

  const rows = (await sql`
    UPDATE comments
    SET is_problematic_layout = false
    WHERE order_id = ${orderId} AND is_problematic_layout = true
    RETURNING id
  `) as Array<{ id: string }>;

  return { cleared: rows.length };
}

export async function createComment(
  user: SessionUser,
  orderId: string,
  input: { body: string; isProblematicLayout: boolean },
): Promise<CommentMeta> {
  assertCanWriteComment(user);

  const order = await getOrderAccessRow(orderId);
  assertOrderAccess(user, order);

  if (order.deleted_at) {
    throw new Error('forbidden');
  }

  const rows = (await sql`
    INSERT INTO comments (order_id, user_id, body, is_problematic_layout)
    VALUES (${orderId}, ${user.id}, ${input.body}, ${input.isProblematicLayout})
    RETURNING id, order_id, user_id, body, is_problematic_layout, created_at
  `) as Array<Omit<DbComment, 'author_name'>>;

  const row = rows[0];
  if (!row) throw new Error('internal_error');

  const authorRows = await sql`
    SELECT display_name FROM users WHERE id = ${user.id} LIMIT 1
  `;
  const authorName = (authorRows[0] as { display_name: string } | undefined)?.display_name ?? '—';

  return serialize({ ...row, author_name: authorName });
}

export async function orderHasProblematicLayout(orderId: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM comments
    WHERE order_id = ${orderId} AND is_problematic_layout = true
    LIMIT 1
  `;
  return rows.length > 0;
}
