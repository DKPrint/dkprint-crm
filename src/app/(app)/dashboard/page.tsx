import { requireNavAccess } from '@/lib/auth/require-nav-access';
import { DashboardHome } from './dashboard-home';

export default async function DashboardPage() {
  await requireNavAccess('/dashboard');
  return <DashboardHome />;
}
