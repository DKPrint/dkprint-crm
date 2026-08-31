import { requireNavAccess } from '@/lib/auth/require-nav-access';
import { sql } from '@/lib/db';
import { CreateOrderForm } from './create-order-form';

type ClientRow = { id: string; name: string };

export default async function NewOrderPage() {
  const session = await requireNavAccess('/orders/new');
  const role = session.user.role;

  let clients: ClientRow[] = [];
  let fixedClientId: string | null = null;

  if (role === 'photo_center') {
    fixedClientId = session.user.clientId;
  } else if (role === 'production' || role === 'admin') {
    clients = (await sql`
      SELECT id, name FROM clients ORDER BY name
    `) as ClientRow[];
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Новый заказ</h1>
          <p className="lede">Каталог или ручная позиция; цена каталога — с сервера</p>
        </div>
      </div>
      <CreateOrderForm role={role} clients={clients} fixedClientId={fixedClientId} />
    </div>
  );
}
