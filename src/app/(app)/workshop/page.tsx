import { requireNavAccess } from '@/lib/auth/require-nav-access';
import { getDefaultSlaTargetHours } from '@/lib/sla/goals';
import { listWorkshopQueue } from '@/lib/workshop/queue';
import { WorkshopBoard } from './workshop-board';

export default async function WorkshopPage() {
  const session = await requireNavAccess('/workshop');
  const [orders, slaTargetHours] = await Promise.all([
    listWorkshopQueue({
      id: session.user.id,
      role: session.user.role,
      clientId: session.user.clientId,
    }),
    getDefaultSlaTargetHours(),
  ]);

  return <WorkshopBoard initialOrders={orders} slaTargetHours={slaTargetHours} />;
}
