import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { listWorkshopQueue } from '@/lib/workshop/queue';

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);
    const orders = await listWorkshopQueue(user);
    return jsonOk({ orders });
  } catch (err) {
    return jsonFromError(err);
  }
}
