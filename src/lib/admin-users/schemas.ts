import { z } from 'zod';

export const ADMIN_USER_ROLES = [
  'admin',
  'photo_center',
  'production',
  'designer',
  'courier',
] as const;

export const roleSchema = z.enum(ADMIN_USER_ROLES);

export const permissionOverridesInputSchema = z.object({
  canAccessReports: z.boolean().optional(),
  canEditPrice: z.boolean().optional(),
  canCancelOrder: z.boolean().optional(),
  canSoftDeleteOrder: z.boolean().optional(),
  canManageSla: z.boolean().optional(),
});

export const createUserSchema = z
  .object({
    email: z.string().trim().email().max(320),
    password: z.string().min(6).max(128),
    displayName: z.string().trim().min(1).max(200),
    role: roleSchema,
    clientName: z.string().trim().min(1).max(200).optional(),
    permissions: permissionOverridesInputSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'photo_center' && !data.clientName?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'clientName required for photo_center',
        path: ['clientName'],
      });
    }
    if (data.role !== 'photo_center' && data.clientName?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'clientName only for photo_center',
        path: ['clientName'],
      });
    }
  });

export const patchUserSchema = z
  .object({
    email: z.string().trim().email().max(320).optional(),
    password: z.string().min(6).max(128).optional(),
    displayName: z.string().trim().min(1).max(200).optional(),
    role: roleSchema.optional(),
    isActive: z.boolean().optional(),
    clientName: z.string().trim().min(1).max(200).optional(),
    permissions: permissionOverridesInputSchema.optional(),
  })
  .refine(
    (data) =>
      data.email !== undefined ||
      data.password !== undefined ||
      data.displayName !== undefined ||
      data.role !== undefined ||
      data.isActive !== undefined ||
      data.clientName !== undefined ||
      data.permissions !== undefined,
    { message: 'empty patch' },
  );

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type PatchUserInput = z.infer<typeof patchUserSchema>;
