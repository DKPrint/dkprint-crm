import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { addItemSchema } from '@/lib/orders/schemas';
import { addOrderItem } from '@/lib/orders/order-items';
import { toApiNumber } from '@/lib/money';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Authentication required');
    const user = sessionUser(authResult);
    const { id } = await ctx.params;
    const body = await request.json();
    const parsed = addItemSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }
    const { item, totalAmount } = await addOrderItem(user, id, parsed.data);
    return jsonOk(
      {
        item: {
          id: item.id,
          positionNumber: item.position_number,
          categoryId: item.category_id,
          catalogProductId: item.catalog_product_id,
          isManual: item.is_manual === true,
          name: item.name,
          techParams: item.tech_params,
          quantity: Number(item.quantity),
          unitPrice: toApiNumber(item.unit_price),
          lineTotal: toApiNumber(item.line_total),
        },
        totalAmount: toApiNumber(totalAmount),
      },
      201,
    );
  } catch (err) {
    return jsonFromError(err);
  }
}
