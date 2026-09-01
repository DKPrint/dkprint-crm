import { notFound } from 'next/navigation';
import { requireNavAccess } from '@/lib/auth/require-nav-access';
import { getUserById } from '@/lib/admin-users/queries';
import { sessionUser } from '@/lib/auth/requireAuth';
import { UserForm } from '../user-form';

type Props = { params: Promise<{ id: string }> };

export default async function AdminUserDetailPage({ params }: Props) {
  const session = await requireNavAccess('/admin/users');
  const { id } = await params;

  let user;
  try {
    user = await getUserById(sessionUser(session), id);
  } catch {
    notFound();
  }

  return (
    <UserForm
      mode="edit"
      userId={id}
      initial={{
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        clientName: user.clientName,
        isActive: user.isActive,
        permissions: user.permissions,
      }}
    />
  );
}
