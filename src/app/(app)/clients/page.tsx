import { requireNavAccess } from '@/lib/auth/require-nav-access';

export default async function ClientsPage() {
  await requireNavAccess('/clients');
  return <h1>Клиенты</h1>;
}
