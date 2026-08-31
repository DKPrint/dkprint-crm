import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getOrderById } from '@/lib/orders/queries';
import { OrderCard } from './order-card';

type Props = { params: Promise<{ id: string }> };

export default async function OrderCardPage({ params }: Props) {
  const session = await requireAuth();
  if (!session) redirect('/login');

  const { id } = await params;
  const includeDeleted = session.user.role === 'admin';

  let order;
  try {
    order = await getOrderById(
      {
        id: session.user.id,
        role: session.user.role,
        clientId: session.user.clientId,
      },
      id,
      { includeDeleted },
    );
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'order_not_found' || err.message === 'forbidden')
    ) {
      notFound();
    }
    throw err;
  }

  return <OrderCard initialOrder={order} role={session.user.role} flags={session.flags} />;
}
