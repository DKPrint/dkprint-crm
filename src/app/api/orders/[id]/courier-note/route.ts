import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { courierNoteSchema } from '@/lib/orders/schemas';
import { updateCourierNote } from '@/lib/orders/update-order';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Authentication required');
    const user = sessionUser(authResult);
    const { id } = await ctx.params;
    const body = await request.json();
    const parsed = courierNoteSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }
    const reason =
      typeof (body as { reason?: unknown }).reason === 'string'
        ? (body as { reason: string }).reason
        : undefined;
    await updateCourierNote(user, id, parsed.data.courierNote, reason);
    return jsonOk({ id, courierNote: parsed.data.courierNote });
  } catch (err) {
    return jsonFromError(err);
  }
}
