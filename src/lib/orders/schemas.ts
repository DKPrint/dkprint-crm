import { z } from 'zod';

const moneyInput = z.union([z.string(), z.number()]).refine((v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0;
}, 'unit_price_negative');

export const orderItemInputSchema = z
  .object({
    isManual: z.boolean().optional().default(false),
    catalogProductId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(200).optional(),
    techParams: z.string().nullable().optional(),
    quantity: z.number().int().positive(),
    unitPrice: moneyInput.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isManual) {
      if (!data.name) {
        ctx.addIssue({ code: 'custom', message: 'name required for manual line', path: ['name'] });
      }
      if (data.unitPrice === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'unitPrice required for manual line',
          path: ['unitPrice'],
        });
      }
      if (data.catalogProductId) {
        ctx.addIssue({
          code: 'custom',
          message: 'catalogProductId not allowed for manual line',
          path: ['catalogProductId'],
        });
      }
      return;
    }
    if (!data.catalogProductId) {
      ctx.addIssue({
        code: 'custom',
        message: 'catalogProductId required for catalog line',
        path: ['catalogProductId'],
      });
    }
  });

export const createOrderSchema = z.object({
  clientId: z.string().uuid().optional(),
  courierNote: z.string().nullable().optional(),
  items: z.array(orderItemInputSchema).min(1),
});

export const patchOrderSchema = z.object({
  courierNote: z.string().nullable().optional(),
  reason: z.string().min(1).optional(),
});

export const jumpStatusSchema = z.object({
  toStatus: z.enum([
    'new',
    'accepted',
    'at_designer',
    'in_production',
    'ready_for_pickup',
    'with_courier',
    'delivered',
    'cancelled',
  ]),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(1),
});

export const softDeleteSchema = z.object({
  password: z.string().min(1),
  comment: z.string().min(1),
});

export const ttnSchema = z.object({
  ttnChecked: z.boolean(),
});

export const urgentSchema = z.object({
  isUrgent: z.boolean(),
});

export const courierNoteSchema = z.object({
  courierNote: z.string().nullable(),
});

export const patchItemSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200).optional(),
  techParams: z.string().nullable().optional(),
  quantity: z.number().int().positive().optional(),
  reason: z.string().min(1).optional(),
});

export const addItemSchema = orderItemInputSchema.extend({
  reason: z.string().min(1).optional(),
});

export const patchPriceSchema = z.object({
  unitPrice: z.union([z.string(), z.number()]).refine((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0;
  }, 'unit_price_negative'),
  reason: z.string().min(1).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type PatchOrderInput = z.infer<typeof patchOrderSchema>;
