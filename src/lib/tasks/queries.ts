import { sql } from '@/lib/db';
import { assertOrderAccess, type SessionUser } from '@/lib/auth/assertOrderAccess';
import { assertTaskParticipant, assertTasksAccess } from './access';
import type { CreateTaskInput, PatchTaskInput, TaskFilter } from './schemas';

type DbTask = {
  id: string;
  title: string;
  description: string | null;
  order_id: string | null;
  assignee_user_id: string;
  creator_user_id: string;
  priority: string;
  status: string;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  assignee_name: string;
  creator_name: string;
  order_number: string | null;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  orderId: string | null;
  orderNumber: string | null;
  assigneeUserId: string;
  assigneeName: string;
  creatorUserId: string;
  creatorName: string;
  priority: string;
  status: string;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function serializeTask(row: DbTask): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    orderId: row.order_id,
    orderNumber: row.order_number,
    assigneeUserId: row.assignee_user_id,
    assigneeName: row.assignee_name,
    creatorUserId: row.creator_user_id,
    creatorName: row.creator_name,
    priority: row.priority,
    status: row.status,
    dueAt: row.due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function assertOrderLink(user: SessionUser, orderId: string): Promise<void> {
  const rows = (await sql`
    SELECT client_id, status, deleted_at FROM orders WHERE id = ${orderId}::uuid LIMIT 1
  `) as { client_id: string; status: string; deleted_at: string | null }[];
  const order = rows[0];
  if (!order) throw new Error('order_not_found');
  assertOrderAccess(user, order, { includeDeleted: user.role === 'admin' });
}

async function assertAssignee(assigneeUserId: string): Promise<void> {
  const rows = (await sql`
    SELECT id, role, is_active FROM users WHERE id = ${assigneeUserId}::uuid LIMIT 1
  `) as { id: string; role: string; is_active: boolean }[];
  const assignee = rows[0];
  if (!assignee || assignee.is_active !== true) throw new Error('validation');
  if (assignee.role === 'courier') throw new Error('validation');
}

export async function listAssigneeCandidates(
  user: SessionUser,
): Promise<{ id: string; displayName: string; role: string }[]> {
  assertTasksAccess(user);
  const rows = (await sql`
    SELECT id, display_name, role
    FROM users
    WHERE is_active = true AND role <> 'courier'
    ORDER BY display_name ASC
  `) as { id: string; display_name: string; role: string }[];
  return rows.map((r) => ({ id: r.id, displayName: r.display_name, role: r.role }));
}

export async function listTasks(
  user: SessionUser,
  filters: { filter: TaskFilter; orderId?: string },
): Promise<Task[]> {
  assertTasksAccess(user);
  const filter = filters.filter;
  const orderId = filters.orderId ?? null;

  const rows = (await sql`
    SELECT
      t.id, t.title, t.description, t.order_id,
      t.assignee_user_id, t.creator_user_id,
      t.priority, t.status, t.due_at, t.created_at, t.updated_at,
      assignee.display_name AS assignee_name,
      creator.display_name AS creator_name,
      o.order_number
    FROM tasks t
    JOIN users assignee ON assignee.id = t.assignee_user_id
    JOIN users creator ON creator.id = t.creator_user_id
    LEFT JOIN orders o ON o.id = t.order_id
    WHERE
      (
        (${filter} = 'my' AND t.assignee_user_id = ${user.id}::uuid)
        OR (${filter} = 'created' AND t.creator_user_id = ${user.id}::uuid)
        OR (
          ${filter} = 'all'
          AND (t.assignee_user_id = ${user.id}::uuid OR t.creator_user_id = ${user.id}::uuid)
        )
      )
      AND (${orderId}::uuid IS NULL OR t.order_id = ${orderId}::uuid)
    ORDER BY t.updated_at DESC
    LIMIT 200
  `) as DbTask[];

  return rows.map(serializeTask);
}

export async function getTaskById(user: SessionUser, taskId: string): Promise<Task> {
  assertTasksAccess(user);
  const rows = (await sql`
    SELECT
      t.id, t.title, t.description, t.order_id,
      t.assignee_user_id, t.creator_user_id,
      t.priority, t.status, t.due_at, t.created_at, t.updated_at,
      assignee.display_name AS assignee_name,
      creator.display_name AS creator_name,
      o.order_number
    FROM tasks t
    JOIN users assignee ON assignee.id = t.assignee_user_id
    JOIN users creator ON creator.id = t.creator_user_id
    LEFT JOIN orders o ON o.id = t.order_id
    WHERE t.id = ${taskId}::uuid
    LIMIT 1
  `) as DbTask[];

  const row = rows[0];
  if (!row) throw new Error('task_not_found');
  assertTaskParticipant(user, row);
  return serializeTask(row);
}

export async function createTask(user: SessionUser, input: CreateTaskInput): Promise<Task> {
  assertTasksAccess(user);
  await assertAssignee(input.assigneeUserId);

  const orderId = input.orderId ?? null;
  if (orderId) await assertOrderLink(user, orderId);

  const description = input.description?.trim() ? input.description.trim() : null;
  const dueAt = input.dueAt ?? null;
  const priority = input.priority ?? 'normal';
  const status = input.status ?? 'open';

  const rows = (await sql`
    INSERT INTO tasks (
      title, description, order_id, assignee_user_id, creator_user_id,
      priority, status, due_at
    )
    VALUES (
      ${input.title},
      ${description},
      ${orderId}::uuid,
      ${input.assigneeUserId}::uuid,
      ${user.id}::uuid,
      ${priority},
      ${status},
      ${dueAt}::timestamptz
    )
    RETURNING id
  `) as { id: string }[];

  const id = rows[0]?.id;
  if (!id) throw new Error('validation');
  return getTaskById(user, id);
}

export async function patchTask(
  user: SessionUser,
  taskId: string,
  input: PatchTaskInput,
): Promise<Task> {
  const existingRows = (await sql`
    SELECT
      id, title, description, order_id, assignee_user_id, creator_user_id,
      priority, status, due_at, created_at, updated_at
    FROM tasks
    WHERE id = ${taskId}::uuid
    LIMIT 1
  `) as Omit<DbTask, 'assignee_name' | 'creator_name' | 'order_number'>[];

  const existing = existingRows[0];
  if (!existing) throw new Error('task_not_found');
  assertTaskParticipant(user, existing);

  if (input.assigneeUserId) await assertAssignee(input.assigneeUserId);

  const title = input.title ?? existing.title;
  const description =
    input.description !== undefined
      ? input.description?.trim()
        ? input.description.trim()
        : null
      : existing.description;
  const assigneeUserId = input.assigneeUserId ?? existing.assignee_user_id;
  const priority = input.priority ?? existing.priority;
  const status = input.status ?? existing.status;
  const dueAt = input.dueAt !== undefined ? input.dueAt : existing.due_at;

  await sql`
    UPDATE tasks
    SET
      title = ${title},
      description = ${description},
      assignee_user_id = ${assigneeUserId}::uuid,
      priority = ${priority},
      status = ${status},
      due_at = ${dueAt}::timestamptz,
      updated_at = now()
    WHERE id = ${taskId}::uuid
  `;

  return getTaskById(user, taskId);
}

export async function deleteTask(user: SessionUser, taskId: string): Promise<void> {
  const existingRows = (await sql`
    SELECT assignee_user_id, creator_user_id FROM tasks WHERE id = ${taskId}::uuid LIMIT 1
  `) as { assignee_user_id: string; creator_user_id: string }[];

  const existing = existingRows[0];
  if (!existing) throw new Error('task_not_found');
  assertTaskParticipant(user, existing);

  await sql`DELETE FROM tasks WHERE id = ${taskId}::uuid`;
}
