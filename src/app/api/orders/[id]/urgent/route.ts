import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { urgentSchema } from '@/lib/orders/schemas';
import { updateUrgent } from '@/lib/orders/update-order';
import { syncOrderTelegramCard } from '@/lib/notifications/telegram';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);
    const { id } = await ctx.params;
    const body = await request.json();
    const parsed = urgentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }
    const result = await updateUrgent(user, id, parsed.data.isUrgent);
    await syncOrderTelegramCard(id);
    return jsonOk(result);
  } catch (err) {
    return jsonFromError(err);
  }
}
