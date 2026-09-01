import { requireNavAccess } from '@/lib/auth/require-nav-access';
import { SlaAdmin } from './sla-admin';

export default async function AdminSlaPage() {
  await requireNavAccess('/admin/sla');
  return <SlaAdmin />;
}
