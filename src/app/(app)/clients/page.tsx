import { Suspense } from 'react';
import { requireNavAccess } from '@/lib/auth/require-nav-access';
import { canCreateClient } from '@/lib/clients/access';
import { ClientsList } from './clients-list';

export default async function ClientsPage() {
  const session = await requireNavAccess('/clients');

  return (
    <Suspense fallback={<p className="muted">Загрузка…</p>}>
      <ClientsList
        role={session.user.role}
        canCreate={canCreateClient(session.user.role)}
        isAdmin={session.user.role === 'admin'}
      />
    </Suspense>
  );
}
