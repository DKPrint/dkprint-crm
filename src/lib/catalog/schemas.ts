import { z } from 'zod';

const moneyInput = z.union([z.string(), z.number()]).refine((v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0;
}, 'unit_price_negative');

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(200),
  parentId: z.string().uuid().nullable().optional(),
  externalCode: z.string().trim().min(1).max(100).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const patchCategorySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  parentId: z.string().uuid().nullable().optional(),
  externalCode: z.string().trim().min(1).max(100).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const createProductSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  unitPrice: moneyInput,
  externalCode: z.string().trim().min(1).max(100).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const patchProductSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200).optional(),
  unitPrice: moneyInput.optional(),
  externalCode: z.string().trim().min(1).max(100).nullable().optional(),
  isActive: z.boolean().optional(),
});
