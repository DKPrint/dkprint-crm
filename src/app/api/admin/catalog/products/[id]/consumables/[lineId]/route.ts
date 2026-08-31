import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { deleteProductBomLine, patchProductBomLine } from '@/lib/catalog/bom';
import { patchBomLineSchema } from '@/lib/catalog/schemas';

type Ctx = { params: Promise<{ id: string; lineId: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);
    const { id, lineId } = await ctx.params;
    const body = await request.json();
    const parsed = patchBomLineSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }
    const line = await patchProductBomLine(user, id, lineId, parsed.data);
    return jsonOk({ line });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);
    const { id, lineId } = await ctx.params;
    await deleteProductBomLine(user, id, lineId);
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonFromError(err);
  }
}
