import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { createClient, listClients } from '@/lib/clients/queries';
import { createClientSchema } from '@/lib/clients/schemas';

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') ?? undefined;
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    const clients = await listClients(user, { q, includeDeleted });
    return jsonOk({ clients });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);

    const body = await request.json();
    const parsed = createClientSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }

    const client = await createClient(user, parsed.data);
    return jsonOk({ client }, 201);
  } catch (err) {
    return jsonFromError(err);
  }
}
