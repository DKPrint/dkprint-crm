import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { deleteLegacyCategory, patchLegacyCategory } from '@/lib/legacy-categories/queries';
import { patchLegacyCategorySchema } from '@/lib/legacy-categories/schemas';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);

    const { id } = await context.params;
    const body = await request.json();
    const parsed = patchLegacyCategorySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }

    const category = await patchLegacyCategory(user, id, parsed.data);
    return jsonOk({ category });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);

    const { id } = await context.params;
    await deleteLegacyCategory(user, id);
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonFromError(err);
  }
}
