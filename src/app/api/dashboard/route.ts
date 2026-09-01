import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { dashboardPayload } from '@/lib/dashboard/queries';

/** GET /api/dashboard — home summary (requireAuth; KPI gated per role). */
export async function GET() {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');

    const user = sessionUser(authResult);
    const data = await dashboardPayload(user, authResult.flags);
    return jsonOk(data);
  } catch (err) {
    return jsonFromError(err);
  }
}
