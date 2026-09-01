import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { userHasPushSubscription } from '@/lib/notifications/push';

/** GET /api/push/status — whether session user has a saved push subscription. */
export async function GET() {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);
    const subscribed = await userHasPushSubscription(user.id);
    return jsonOk({ subscribed });
  } catch (err) {
    return jsonFromError(err);
  }
}
