import { z } from 'zod';

export const orderItemInputSchema = z.object({
  categoryId: z.string().uuid(),
  techParams: z.string().nullable().optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.union([z.string(), z.number()]).refine((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0;
  }, 'unit_price_negative'),
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

export const courierNoteSchema = z.object({
  courierNote: z.string().nullable(),
});

export const patchItemSchema = z.object({
  categoryId: z.string().uuid().optional(),
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
