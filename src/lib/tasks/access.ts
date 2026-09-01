import type { SessionUser } from '@/lib/auth/assertOrderAccess';
import type { Role } from '@/lib/auth/permissions';

const TASKS_ROLES = new Set<Role>(['admin', 'production', 'designer', 'photo_center']);

/** TZ §12.3: courier has no tasks module. */
export function assertTasksAccess(user: SessionUser): void {
  if (user.role === 'courier' || !TASKS_ROLES.has(user.role)) {
    throw new Error('forbidden');
  }
}

export type TaskFilter = 'my' | 'created' | 'all';

/** Pure helper for tests — list scope is never company-wide. */
export function taskMatchesFilter(
  filter: TaskFilter,
  userId: string,
  task: { assigneeUserId: string; creatorUserId: string },
): boolean {
  if (filter === 'my') return task.assigneeUserId === userId;
  if (filter === 'created') return task.creatorUserId === userId;
  return task.assigneeUserId === userId || task.creatorUserId === userId;
}

export function assertTaskParticipant(
  user: SessionUser,
  task: { assignee_user_id: string; creator_user_id: string },
): void {
  assertTasksAccess(user);
  if (task.assignee_user_id !== user.id && task.creator_user_id !== user.id) {
    throw new Error('forbidden');
  }
}
