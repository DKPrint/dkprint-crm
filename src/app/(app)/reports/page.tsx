import { requireNavAccess } from '@/lib/auth/require-nav-access';

export default async function ReportsPage() {
  await requireNavAccess('/reports');
  return <h1>Отчёты</h1>;
}
