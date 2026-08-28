import { jsonError, jsonOk } from '@/lib/api/http';
import { findSlaOverdueOrderIds } from '@/lib/notifications/dispatch';
import { scheduleSlaOverdue } from '@/lib/notifications/hooks';

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

async function runSlaOverdueJob() {
  const orderIds = await findSlaOverdueOrderIds();
  for (const orderId of orderIds) {
    scheduleSlaOverdue(orderId);
  }
  return { processed: orderIds.length, orderIds };
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return jsonError(401, 'unauthorized', 'Требуется CRON_SECRET');
  }
  const result = await runSlaOverdueJob();
  return jsonOk(result);
}

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return jsonError(401, 'unauthorized', 'Требуется CRON_SECRET');
  }
  const result = await runSlaOverdueJob();
  return jsonOk(result);
}
