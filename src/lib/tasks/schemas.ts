import { z } from 'zod';

export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const TASK_STATUSES = ['open', 'in_progress', 'done', 'cancelled'] as const;
export const TASK_FILTERS = ['my', 'created', 'all'] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskFilter = (typeof TASK_FILTERS)[number];

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).nullable().optional(),
  orderId: z.string().uuid().nullable().optional(),
  assigneeUserId: z.string().uuid(),
  priority: z.enum(TASK_PRIORITIES).optional().default('normal'),
  status: z.enum(TASK_STATUSES).optional().default('open'),
  dueAt: z.string().datetime().nullable().optional(),
});

export const patchTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  assigneeUserId: z.string().uuid().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type PatchTaskInput = z.infer<typeof patchTaskSchema>;

export function parseTaskFilter(raw: string | null): TaskFilter {
  if (raw === 'my' || raw === 'created' || raw === 'all') return raw;
  return 'all';
}
