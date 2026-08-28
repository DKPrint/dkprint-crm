import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { applyStatusChange } from '@/lib/orders/apply-status';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Authentication required');
    const user = sessionUser(authResult);
    const { id } = await ctx.params;
    const result = await applyStatusChange({ orderId: id, user, mode: 'prev' });
    const { scheduleStatusChanged } = await import('@/lib/notifications/hooks');
    scheduleStatusChanged(id, result.status);
    return jsonOk(result);
  } catch (err) {
    return jsonFromError(err);
  }
}
