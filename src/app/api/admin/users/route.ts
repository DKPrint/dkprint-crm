import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { createUser, listUsers } from '@/lib/admin-users/queries';
import { createUserSchema } from '@/lib/admin-users/schemas';

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') ?? undefined;

    const users = await listUsers(user, { q });
    return jsonOk({ users });
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
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }

    const created = await createUser(user, parsed.data);
    return jsonOk({ user: created }, 201);
  } catch (err) {
    return jsonFromError(err);
  }
}
