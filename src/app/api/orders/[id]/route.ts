import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { patchOrderSchema } from '@/lib/orders/schemas';
import { getOrderById } from '@/lib/orders/queries';
import { updateOrder } from '@/lib/orders/update-order';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Authentication required');
    const user = sessionUser(authResult);
    const { id } = await ctx.params;
    const url = new URL(request.url);
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
    const order = await getOrderById(user, id, { includeDeleted });
    return jsonOk({ order });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Authentication required');
    const user = sessionUser(authResult);
    const { id } = await ctx.params;
    const body = await request.json();
    const parsed = patchOrderSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }
    await updateOrder(user, id, parsed.data);
    const order = await getOrderById(user, id);
    return jsonOk({ order });
  } catch (err) {
    return jsonFromError(err);
  }
}
