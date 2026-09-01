import { redirect } from 'next/navigation';
import { requireNavAccess } from '@/lib/auth/require-nav-access';

/** Legacy flat categories — UI deprecated; catalog is SoT (§13.1). */
export default async function AdminCategoriesPage() {
  await requireNavAccess('/admin/categories');
  redirect('/admin/catalog');
}
