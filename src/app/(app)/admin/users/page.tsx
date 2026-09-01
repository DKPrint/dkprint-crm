import { Suspense } from 'react';
import { requireNavAccess } from '@/lib/auth/require-nav-access';
import { UsersList } from './users-list';

export default async function AdminUsersPage() {
  await requireNavAccess('/admin/users');

  return (
    <Suspense fallback={<p className="muted">Загрузка…</p>}>
      <UsersList />
    </Suspense>
  );
}
