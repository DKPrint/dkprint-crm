import { authorizeCronRequest } from '@/lib/cron/auth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { findSlaOverdueOrderIds } from '@/lib/notifications/dispatch';
import { runSlaOverdue } from '@/lib/notifications/hooks';

async function runSlaOverdueJob() {
  const orderIds = await findSlaOverdueOrderIds();
  console.log('[sla] cron candidates', { count: orderIds.length });
  for (const orderId of orderIds) {
    try {
      await runSlaOverdue(orderId);
    } catch (err) {
      console.error('[sla] cron order fail', { orderId, err });
    }
  }
  console.log('[sla] cron done', { processed: orderIds.length });
  return { processed: orderIds.length, orderIds };
}

export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) {
    console.log('[sla] cron unauthorized');
    return jsonError(401, 'unauthorized', 'Требуется CRON_SECRET');
  }
  try {
    const result = await runSlaOverdueJob();
    return jsonOk(result);
  } catch (err) {
    console.error('[sla] cron fail', err);
    return jsonFromError(err);
  }
}

export async function POST(request: Request) {
  if (!authorizeCronRequest(request)) {
    console.log('[sla] cron unauthorized');
    return jsonError(401, 'unauthorized', 'Требуется CRON_SECRET');
  }
  try {
    const result = await runSlaOverdueJob();
    return jsonOk(result);
  } catch (err) {
    console.error('[sla] cron fail', err);
    return jsonFromError(err);
  }
}
