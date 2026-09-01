import { z } from 'zod';
import { ORDER_STATUSES } from '@/lib/orders/status-labels';

const slaStatuses = ORDER_STATUSES.filter((s) => s !== 'cancelled') as [string, ...string[]];
const statusSchema = z.enum(slaStatuses);

export const createSlaGoalSchema = z.object({
  fromStatus: statusSchema,
  toStatus: statusSchema,
  targetHours: z.number().int().min(1).max(9999),
  isActive: z.boolean().optional(),
  isSystemDefault: z.boolean().optional(),
});

export const patchSlaGoalSchema = z
  .object({
    fromStatus: statusSchema.optional(),
    toStatus: statusSchema.optional(),
    targetHours: z.number().int().min(1).max(9999).optional(),
    isActive: z.boolean().optional(),
    isSystemDefault: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.fromStatus !== undefined ||
      data.toStatus !== undefined ||
      data.targetHours !== undefined ||
      data.isActive !== undefined ||
      data.isSystemDefault !== undefined,
    { message: 'empty patch' },
  );

export type CreateSlaGoalInput = z.infer<typeof createSlaGoalSchema>;
export type PatchSlaGoalInput = z.infer<typeof patchSlaGoalSchema>;
