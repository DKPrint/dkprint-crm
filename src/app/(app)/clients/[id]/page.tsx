import { requireNavAccess } from '@/lib/auth/require-nav-access';
import { canCreateClient } from '@/lib/clients/access';
import { ClientDetail } from './client-detail';

type Props = { params: Promise<{ id: string }> };

export default async function ClientDetailPage({ params }: Props) {
  const session = await requireNavAccess('/clients');
  const { id } = await params;

  return (
    <ClientDetail
      clientId={id}
      role={session.user.role}
      canEdit={canCreateClient(session.user.role)}
    />
  );
}
