import { z } from 'zod';

export const createClientSchema = z.object({
  name: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const patchClientSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const softDeleteClientSchema = z.object({
  comment: z.string().trim().min(1).max(2000),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type PatchClientInput = z.infer<typeof patchClientSchema>;
export type SoftDeleteClientInput = z.infer<typeof softDeleteClientSchema>;
