import { requireNavAccess } from '@/lib/auth/require-nav-access';
import { listWorkshopQueue } from '@/lib/workshop/queue';
import { WorkshopBoard } from './workshop-board';

export default async function WorkshopPage() {
  const session = await requireNavAccess('/workshop');
  const orders = await listWorkshopQueue({
    id: session.user.id,
    role: session.user.role,
    clientId: session.user.clientId,
  });

  return <WorkshopBoard initialOrders={orders} />;
}
