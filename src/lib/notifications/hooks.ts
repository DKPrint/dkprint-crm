import { after } from 'next/server';
import { notifySlaOverdue } from './dispatch';
import { sendOrderTelegramCard, syncOrderTelegramCard } from './telegram';
import { loadOrderPushContext, resolvePushRecipientIds, sendPushToUsers } from './push';
import type { NotificationEventType } from './types';

/**
 * Await Telegram so serverless keeps the request alive until
 * telegram_message_id is saved (prevents delayed duplicate cards).
 * Push is deferred via after().
 */
function afterPush(task: Promise<void>, label: string): void {
  after(async () => {
    try {
      await task;
    } catch (err) {
      console.error(`[notifications] ${label}`, err);
    }
  });
}

async function pushOnly(
  eventType: NotificationEventType,
  orderId: string,
  title: string,
): Promise<void> {
  const order = await loadOrderPushContext(orderId);
  if (!order) return;
  const userIds = await resolvePushRecipientIds(eventType, order);
  await sendPushToUsers(
    userIds,
    { title, body: order.orderNumber, url: `/orders/${orderId}` },
    { eventType, orderId },
  );
}

/** Create: await TG send; push deferred. */
export async function runOrderCreated(orderId: string): Promise<void> {
  await sendOrderTelegramCard(orderId);
  afterPush(pushOnly('order_created', orderId, 'Новый заказ'), `push_order_created:${orderId}`);
}

/** Status: await TG sync; push if ready_for_pickup. */
export async function runStatusChanged(orderId: string, toStatus: string): Promise<void> {
  await syncOrderTelegramCard(orderId);
  if (toStatus === 'ready_for_pickup') {
    afterPush(pushOnly('ready_for_pickup', orderId, 'Готов к выдаче'), `push_ready:${orderId}`);
  }
}

/** Comment: await TG sync; push if problematic. */
export async function runCommentAdded(
  orderId: string,
  isProblematicLayout: boolean,
): Promise<void> {
  await syncOrderTelegramCard(orderId, { problematicLayout: isProblematicLayout });
  if (isProblematicLayout) {
    afterPush(
      pushOnly('problematic_layout', orderId, 'Проблемный макет'),
      `push_problematic:${orderId}`,
    );
  }
}

/** Cleared problematic flag: await TG sync (badge removed from card). */
export async function runProblematicCleared(orderId: string): Promise<void> {
  await syncOrderTelegramCard(orderId);
}

/** SLA overdue cron: await full notify. */
export async function runSlaOverdue(orderId: string): Promise<void> {
  await notifySlaOverdue(orderId);
}
