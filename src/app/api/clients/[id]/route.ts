import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { getClientById, listClientOrders, patchClient } from '@/lib/clients/queries';
import { patchClientSchema } from '@/lib/clients/schemas';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    const client = await getClientById(user, id);
    const orders = await listClientOrders(user, id, { includeDeleted });
    return jsonOk({ client, orders });
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
    const parsed = patchClientSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }

    const client = await patchClient(user, id, parsed.data);
    return jsonOk({ client });
  } catch (err) {
    return jsonFromError(err);
  }
}
