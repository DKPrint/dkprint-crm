import { requireNavAccess } from '@/lib/auth/require-nav-access';

export default async function AdminCategoriesPage() {
  await requireNavAccess('/admin/categories');
  return <h1>Категории</h1>;
}
