import { requireNavAccess } from '@/lib/auth/require-nav-access';

export default async function NewOrderPage() {
  await requireNavAccess('/orders/new');
  return <h1>Новый заказ</h1>;
}
