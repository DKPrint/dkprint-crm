import { sql } from '@/lib/db';

export async function logNotification(params: {
  eventType: string;
  orderId?: string | null;
  payload?: unknown;
  sentPush?: boolean;
  sentTelegram?: boolean;
}): Promise<void> {
  try {
    await sql`
      INSERT INTO notification_log (event_type, order_id, payload, sent_push, sent_telegram)
      VALUES (
        ${params.eventType},
        ${params.orderId ?? null},
        ${params.payload != null ? JSON.stringify(params.payload) : null}::jsonb,
        ${params.sentPush === true},
        ${params.sentTelegram === true}
      )
    `;
  } catch (err) {
    console.error('[notification_log]', err);
  }
}
