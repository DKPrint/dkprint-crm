import { jsonError, jsonOk } from '@/lib/api/http';
import { getVapidPublicKey } from '@/lib/notifications/push';

export async function GET() {
  const key = getVapidPublicKey();
  if (!key) {
    return jsonError(503, 'push_not_configured', 'Web Push не настроен');
  }
  return jsonOk({ publicKey: key });
}
