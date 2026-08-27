import { requireNavAccess } from '@/lib/auth/require-nav-access';

export default async function AdminSlaPage() {
  await requireNavAccess('/admin/sla');
  return <h1>SLA</h1>;
}
