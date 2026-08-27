import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { patchPriceSchema } from '@/lib/orders/schemas';
import { patchItemPrice } from '@/lib/orders/order-items';
import { toApiNumber } from '@/lib/money';

type Ctx = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Authentication required');
    const { flags } = authResult;
    const user = sessionUser(authResult);
    const { id, itemId } = await ctx.params;
    const body = await request.json();
    const parsed = patchPriceSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }
    const { item, totalAmount } = await patchItemPrice(
      user,
      id,
      itemId,
      parsed.data.unitPrice,
      parsed.data.reason,
      flags,
    );
    return jsonOk({
      item: {
        id: item.id,
        positionNumber: item.position_number,
        categoryId: item.category_id,
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
