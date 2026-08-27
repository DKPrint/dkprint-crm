import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/requireAuth';
import { sql } from '@/lib/db';
import { getOrderById } from '@/lib/orders/queries';
import { OrderCard } from './order-card';

type CategoryRow = { id: string; name: string };
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

  const categories = (await sql`
    SELECT id, name FROM categories
    WHERE is_active = true
    ORDER BY sort_order, name
  `) as CategoryRow[];

  return (
    <OrderCard
      initialOrder={order}
      role={session.user.role}
      flags={session.flags}
      categories={categories}
    />
  );
}
