import { sql } from '@/lib/db';
import { sendOrderTelegramCard, syncOrderTelegramCard } from './telegram';
import { loadOrderPushContext, resolvePushRecipientIds, sendPushToUsers } from './push';

const DEFAULT_SLA_HOURS = 72;

async function pushForEvent(
  eventType: Parameters<typeof resolvePushRecipientIds>[0],
  orderId: string,
  payload: { title: string; body: string; url: string },
): Promise<void> {
  const order = await loadOrderPushContext(orderId);
  if (!order) return;
  const userIds = await resolvePushRecipientIds(eventType, order);
  await sendPushToUsers(userIds, payload, { eventType, orderId });
}

/** New order: TG card + push admin/production/designer (§10.2). */
export async function notifyOrderCreated(orderId: string): Promise<void> {
  await sendOrderTelegramCard(orderId);
  const order = await loadOrderPushContext(orderId);
  if (!order) return;
  await pushForEvent('order_created', orderId, {
    title: 'Новый заказ',
    body: order.orderNumber,
    url: `/orders/${orderId}`,
  });
}

/** Status change: sync TG card; push if ready_for_pickup (§10.2). */
export async function notifyStatusChanged(orderId: string, toStatus: string): Promise<void> {
  await syncOrderTelegramCard(orderId);
  if (toStatus === 'ready_for_pickup') {
    const order = await loadOrderPushContext(orderId);
    if (!order) return;
    await pushForEvent('ready_for_pickup', orderId, {
      title: 'Готов к выдаче',
      body: order.orderNumber,
      url: `/orders/${orderId}`,
    });
  }
}

/** Comment added: sync TG; push if problematic layout (§10.2). */
export async function notifyCommentAdded(
  orderId: string,
  isProblematicLayout: boolean,
): Promise<void> {
  await syncOrderTelegramCard(orderId, { problematicLayout: isProblematicLayout });
  if (!isProblematicLayout) return;
  const order = await loadOrderPushContext(orderId);
  if (!order) return;
  await pushForEvent('problematic_layout', orderId, {
    title: 'Проблемный макет',
    body: order.orderNumber,
    url: `/orders/${orderId}`,
  });
}

/** SLA overdue cron: push + TG flag; dedup via sla_overdue_notified_at (§11.2). */
export async function notifySlaOverdue(orderId: string): Promise<void> {
  await syncOrderTelegramCard(orderId, { slaOverdue: true });
  const order = await loadOrderPushContext(orderId);
  if (!order) return;
  await pushForEvent('sla_overdue', orderId, {
    title: 'Просрочка SLA',
    body: order.orderNumber,
    url: `/orders/${orderId}`,
  });
  await sql`
    UPDATE orders SET sla_overdue_notified_at = now(), updated_at = now()
    WHERE id = ${orderId}
  `;
}

export async function findSlaOverdueOrderIds(): Promise<string[]> {
  const rows = (await sql`
    SELECT o.id
    FROM orders o
    WHERE o.deleted_at IS NULL
      AND o.status NOT IN ('cancelled', 'delivered')
      AND o.sla_stopped_at IS NULL
      AND o.sla_started_at + (${DEFAULT_SLA_HOURS} * interval '1 hour') < now()
      AND (
        o.sla_overdue_notified_at IS NULL
        OR o.sla_overdue_notified_at < now() - interval '24 hours'
      )
  `) as Array<{ id: string }>;
  return rows.map((r) => r.id);
}
