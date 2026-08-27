import { requireNavAccess } from '@/lib/auth/require-nav-access';

export default async function WorkshopPage() {
  await requireNavAccess('/workshop');
  return <h1>Очередь</h1>;
}
