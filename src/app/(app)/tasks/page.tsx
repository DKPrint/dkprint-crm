import { Suspense } from 'react';
import { requireNavAccess } from '@/lib/auth/require-nav-access';
import { TasksBoard } from './tasks-board';

export default async function TasksPage() {
  await requireNavAccess('/tasks');

  return (
    <Suspense fallback={<p className="muted">Загрузка…</p>}>
      <TasksBoard />
    </Suspense>
  );
}
