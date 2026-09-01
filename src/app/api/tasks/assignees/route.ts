import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { listAssigneeCandidates } from '@/lib/tasks/queries';

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);

    const users = await listAssigneeCandidates(user);
    return jsonOk({ users });
  } catch (err) {
    return jsonFromError(err);
  }
}
