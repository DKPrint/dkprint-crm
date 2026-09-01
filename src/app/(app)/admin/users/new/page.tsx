import { requireNavAccess } from '@/lib/auth/require-nav-access';
import { UserForm } from '../user-form';

export default async function AdminNewUserPage() {
  await requireNavAccess('/admin/users');
  return <UserForm mode="create" />;
}
