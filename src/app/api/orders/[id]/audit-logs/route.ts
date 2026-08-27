import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { listAuditLogs } from '@/lib/orders/queries';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Authentication required');
    const user = sessionUser(authResult);
    const { id } = await ctx.params;
    const logs = await listAuditLogs(user, id);
    return jsonOk({
      logs: (logs as Array<Record<string, unknown>>).map((l) => ({
        id: l.id,
        orderId: l.order_id,
        orderItemId: l.order_item_id,
        action: l.action,
        fieldName: l.field_name,
        oldValue: l.old_value,
        newValue: l.new_value,
        reason: l.reason,
        userId: l.user_id,
        createdAt: l.created_at,
      })),
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
