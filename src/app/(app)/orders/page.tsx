import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/requireAuth';
import { OrdersList } from './orders-list';

export default async function OrdersPage() {
  const session = await requireAuth();
  if (!session) redirect('/login');

  return (
    <Suspense fallback={<p className="muted">Загрузка…</p>}>
      <OrdersList role={session.user.role} />
    </Suspense>
  );
}
