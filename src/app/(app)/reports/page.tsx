import { Suspense } from 'react';
import { requireNavAccess } from '@/lib/auth/require-nav-access';
import { ReportsDashboard } from './reports-dashboard';

export default async function ReportsPage() {
  await requireNavAccess('/reports');

  return (
    <Suspense fallback={<p className="muted">Загрузка…</p>}>
      <ReportsDashboard />
    </Suspense>
  );
}
