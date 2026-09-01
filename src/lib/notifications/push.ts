import webpush from 'web-push';
import { sql } from '@/lib/db';
import type { Role } from '@/lib/auth/permissions';
import { logNotification } from './log';
import type { NotificationEventType } from './types';

let vapidConfigured = false;

function configureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() ?? null;
}

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

async function userIdsByRoles(roles: Role[]): Promise<string[]> {
  const rows = (await sql`
    SELECT id FROM users
    WHERE is_active = true AND role = ANY(${roles}::text[])
  `) as Array<{ id: string }>;
  return rows.map((r) => r.id);
}

async function photoCenterOwnerUserId(clientId: string): Promise<string | null> {
  const rows = await sql`
    SELECT id FROM users
    WHERE is_active = true AND role = 'photo_center' AND client_id = ${clientId}
    LIMIT 1
  `;
  return (rows[0] as { id: string } | undefined)?.id ?? null;
}

export async function resolvePushRecipientIds(
  eventType: NotificationEventType,
  order: { id: string; clientId: string },
): Promise<string[]> {
  switch (eventType) {
    case 'order_created':
      return userIdsByRoles(['admin', 'production', 'designer']);
    case 'ready_for_pickup':
      return userIdsByRoles(['admin', 'production', 'courier']);
    case 'problematic_layout': {
      const ids = await userIdsByRoles(['admin', 'production', 'designer']);
      const ownerId = await photoCenterOwnerUserId(order.clientId);
      if (ownerId && !ids.includes(ownerId)) ids.push(ownerId);
      return ids;
    }
    case 'sla_overdue':
      return userIdsByRoles(['admin', 'production']);
    default:
      return [];
  }
}

async function loadSubscriptions(userIds: string[]) {
  if (userIds.length === 0) return [];
  return (await sql`
    SELECT id, user_id, endpoint, p256dh, auth
    FROM push_subscriptions
    WHERE user_id = ANY(${userIds}::uuid[])
  `) as Array<{
    id: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>;
}

async function deleteSubscription(id: string): Promise<void> {
  await sql`DELETE FROM push_subscriptions WHERE id = ${id}`;
}

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
  meta: { eventType: NotificationEventType; orderId: string },
): Promise<boolean> {
  if (!configureVapid() || userIds.length === 0) return false;

  const subs = await loadSubscriptions(userIds);
  if (subs.length === 0) return false;

  let anySent = false;
  const body = JSON.stringify(payload);

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body,
      );
      anySent = true;
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'statusCode' in err ? Number(err.statusCode) : 0;
      if (status === 410 || status === 404) {
        await deleteSubscription(sub.id);
      }
      console.error('[push] send failed', sub.user_id, err);
    }
  }

  await logNotification({
    eventType: meta.eventType,
    orderId: meta.orderId,
    sentPush: anySent,
    payload: { title: payload.title, recipients: userIds.length, subscriptions: subs.length },
  });

  return anySent;
}

export async function upsertPushSubscription(
  userId: string,
  input: { endpoint: string; p256dh: string; auth: string },
): Promise<void> {
  await sql`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (${userId}, ${input.endpoint}, ${input.p256dh}, ${input.auth})
    ON CONFLICT (user_id, endpoint)
    DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
  `;
}

export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  await sql`
    DELETE FROM push_subscriptions
    WHERE user_id = ${userId} AND endpoint = ${endpoint}
  `;
}

/** True when the user has at least one row in push_subscriptions. */
export async function userHasPushSubscription(userId: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM push_subscriptions WHERE user_id = ${userId}::uuid LIMIT 1
  `;
  return rows.length > 0;
}

export async function loadOrderPushContext(orderId: string): Promise<{
  id: string;
  clientId: string;
  orderNumber: string;
  status: string;
} | null> {
  const rows = await sql`
    SELECT id, client_id, order_number, status
    FROM orders WHERE id = ${orderId} LIMIT 1
  `;
  const row = rows[0] as
    { id: string; client_id: string; order_number: string; status: string } | undefined;
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    orderNumber: row.order_number,
    status: row.status,
  };
}
