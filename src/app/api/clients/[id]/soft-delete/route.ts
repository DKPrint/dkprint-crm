import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { softDeleteClientSchema } from '@/lib/clients/schemas';
import { softDeleteClient } from '@/lib/clients/soft-delete';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);

    const { id } = await context.params;
    const body = await request.json();
    const parsed = softDeleteClientSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }

    const result = await softDeleteClient({
      clientId: id,
      user,
      comment: parsed.data.comment,
    });
    return jsonOk(result);
  } catch (err) {
    return jsonFromError(err);
  }
}
