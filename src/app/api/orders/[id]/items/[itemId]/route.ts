import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { patchItemSchema } from '@/lib/orders/schemas';
import { deleteOrderItem, patchOrderItem } from '@/lib/orders/order-items';
import { toApiNumber } from '@/lib/money';

type Ctx = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Authentication required');
    const user = sessionUser(authResult);
    const { id, itemId } = await ctx.params;
    const body = await request.json();
    const parsed = patchItemSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }
    const { item, totalAmount } = await patchOrderItem(user, id, itemId, parsed.data);
    return jsonOk({
      item: {
        id: item.id,
        positionNumber: item.position_number,
        categoryId: item.category_id,
        name: item.name,
        techParams: item.tech_params,
        quantity: Number(item.quantity),
        unitPrice: toApiNumber(item.unit_price),
        lineTotal: toApiNumber(item.line_total),
      },
      totalAmount: toApiNumber(totalAmount),
    });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Authentication required');
    const user = sessionUser(authResult);
    const { id, itemId } = await ctx.params;
    let reason: string | undefined;
    try {
      const body = await request.json();
      if (typeof body?.reason === 'string') reason = body.reason;
    } catch {
      // no body
    }
    const { totalAmount } = await deleteOrderItem(user, id, itemId, reason);
    return jsonOk({ totalAmount: toApiNumber(totalAmount) });
  } catch (err) {
    return jsonFromError(err);
  }
}
