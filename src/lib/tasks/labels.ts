import type { TaskPriority, TaskStatus } from './schemas';

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Высокий',
  urgent: 'Срочный',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  open: 'Открыта',
  in_progress: 'В работе',
  done: 'Готова',
  cancelled: 'Отменена',
};

export function priorityLabel(priority: string): string {
  return PRIORITY_LABELS[priority as TaskPriority] ?? priority;
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as TaskStatus] ?? status;
}

export function taskFilterLabel(filter: 'my' | 'created' | 'all'): string {
  if (filter === 'my') return 'Мои';
  if (filter === 'created') return 'Поставленные';
  return 'Все';
}
