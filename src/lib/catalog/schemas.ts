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

/** BOM qty_per_unit — not money; must be > 0 (TZ §14.21). */
const qtyPerUnitInput = z.union([z.string(), z.number()]).refine((v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}, 'qty_per_unit_invalid');

export const createBomLineSchema = z
  .object({
    consumableId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(200).optional(),
    unit: z.string().trim().min(1).max(50).nullable().optional(),
    externalCode: z.string().trim().min(1).max(100).nullable().optional(),
    qtyPerUnit: qtyPerUnitInput,
  })
  .superRefine((data, ctx) => {
    if (!data.consumableId && !data.name) {
      ctx.addIssue({
        code: 'custom',
        message: 'consumableId or name required',
        path: ['name'],
      });
    }
  });

export const patchBomLineSchema = z.object({
  qtyPerUnit: qtyPerUnitInput,
});
