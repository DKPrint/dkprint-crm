import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { listStatusEvents } from '@/lib/orders/queries';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Authentication required');
    const user = sessionUser(authResult);
    const { id } = await ctx.params;
    const events = await listStatusEvents(user, id);
    return jsonOk({
      events: (events as Array<Record<string, unknown>>).map((e) => ({
        id: e.id,
        orderId: e.order_id,
        fromStatus: e.from_status,
        toStatus: e.to_status,
        changedByUserId: e.changed_by_user_id,
        reason: e.reason,
        isAdminJump: e.is_admin_jump === true,
        createdAt: e.created_at,
      })),
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
