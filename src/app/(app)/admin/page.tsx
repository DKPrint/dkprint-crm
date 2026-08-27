import { redirect } from 'next/navigation';
import { requireNavAccess } from '@/lib/auth/require-nav-access';

export default async function AdminPage() {
  await requireNavAccess('/admin');
  redirect('/admin/users');
}
