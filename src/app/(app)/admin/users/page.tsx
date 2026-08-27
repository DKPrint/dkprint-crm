import { requireNavAccess } from '@/lib/auth/require-nav-access';

export default async function AdminUsersPage() {
  await requireNavAccess('/admin/users');
  return <h1>Пользователи</h1>;
}
