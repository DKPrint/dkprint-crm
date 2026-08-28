import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { deletePushSubscription, upsertPushSubscription } from '@/lib/notifications/push';
import { pushSubscribeSchema, pushUnsubscribeSchema } from '@/lib/notifications/push-schemas';

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);
    const body = await request.json();
    const parsed = pushSubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }
    await upsertPushSubscription(user.id, {
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);
    const body = await request.json();
    const parsed = pushUnsubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }
    await deletePushSubscription(user.id, parsed.data.endpoint);
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonFromError(err);
  }
}
