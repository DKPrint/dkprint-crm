import Link from 'next/link';
import { requireNavAccess } from '@/lib/auth/require-nav-access';
import { sql } from '@/lib/db';
import { TaskForm } from '../task-form';

type Props = { searchParams: Promise<{ orderId?: string }> };

export default async function NewTaskPage({ searchParams }: Props) {
  const session = await requireNavAccess('/tasks/new');
  const { orderId } = await searchParams;

  let orderNumber: string | null = null;
  if (orderId) {
    const rows = (await sql`
      SELECT order_number FROM orders WHERE id = ${orderId}::uuid LIMIT 1
    `) as { order_number: string }[];
    orderNumber = rows[0]?.order_number ?? null;
  }

  return (
    <div className="stack">
      <Link href="/tasks" className="linkish">
        ← К списку
      </Link>
      <div className="page-head">
        <div>
          <h1>Новая задача</h1>
          <p className="lede">order_id необязателен (§12.3)</p>
        </div>
      </div>
      <TaskForm
        currentUserId={session.user.id}
        orderId={orderId ?? null}
        orderNumber={orderNumber}
      />
    </div>
  );
}
