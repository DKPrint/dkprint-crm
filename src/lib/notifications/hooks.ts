import {
  notifyCommentAdded,
  notifyOrderCreated,
  notifySlaOverdue,
  notifyStatusChanged,
} from './dispatch';

function run(task: Promise<void>, label: string): void {
  void task.catch((err) => {
    console.error(`[notifications] ${label}`, err);
  });
}

/** Fire-and-forget after order created (§10.2). */
export function scheduleOrderCreated(orderId: string): void {
  run(notifyOrderCreated(orderId), `order_created:${orderId}`);
}

/** Fire-and-forget after status change (§10.2–10.3). */
export function scheduleStatusChanged(orderId: string, toStatus: string): void {
  run(notifyStatusChanged(orderId, toStatus), `status_changed:${orderId}`);
}

/** Fire-and-forget after comment (§10.1 / §10.3). */
export function scheduleCommentAdded(orderId: string, isProblematicLayout: boolean): void {
  run(notifyCommentAdded(orderId, isProblematicLayout), `comment_added:${orderId}`);
}

/** Fire-and-forget SLA overdue (§11.2). */
export function scheduleSlaOverdue(orderId: string): void {
  run(notifySlaOverdue(orderId), `sla_overdue:${orderId}`);
}
