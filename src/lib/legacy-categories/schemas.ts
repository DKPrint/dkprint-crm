import { z } from 'zod';

export const createLegacyCategorySchema = z.object({
  name: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export const patchLegacyCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined || data.sortOrder !== undefined || data.isActive !== undefined,
    { message: 'empty patch' },
  );

export type CreateLegacyCategoryInput = z.infer<typeof createLegacyCategorySchema>;
export type PatchLegacyCategoryInput = z.infer<typeof patchLegacyCategorySchema>;
