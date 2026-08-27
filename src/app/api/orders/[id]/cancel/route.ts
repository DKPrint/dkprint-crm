import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { cancelOrderSchema } from '@/lib/orders/schemas';
import { applyStatusChange } from '@/lib/orders/apply-status';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Authentication required');
    const { flags } = authResult;
    const user = sessionUser(authResult);
    const { id } = await ctx.params;
    const body = await request.json();
    const parsed = cancelOrderSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }
    const result = await applyStatusChange({
      orderId: id,
      user,
      mode: 'cancel',
      reason: parsed.data.reason,
      flags,
    });
    return jsonOk(result);
  } catch (err) {
    return jsonFromError(err);
  }
}
