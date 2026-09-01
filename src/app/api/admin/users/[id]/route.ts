import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { getUserById, patchUser } from '@/lib/admin-users/queries';
import { patchUserSchema } from '@/lib/admin-users/schemas';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);

    const { id } = await context.params;
    const row = await getUserById(user, id);
    return jsonOk({ user: row });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);

    const { id } = await context.params;
    const body = await request.json();
    const parsed = patchUserSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }

    const updated = await patchUser(user, id, parsed.data);
    return jsonOk({ user: updated });
  } catch (err) {
    return jsonFromError(err);
  }
}
