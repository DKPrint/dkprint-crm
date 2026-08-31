import { requireNavAccess } from '@/lib/auth/require-nav-access';
import { CatalogAdmin } from './catalog-admin';

export default async function AdminCatalogPage() {
  await requireNavAccess('/admin/catalog');
  return <CatalogAdmin />;
}
