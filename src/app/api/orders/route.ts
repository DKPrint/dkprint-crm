import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { createOrderSchema } from '@/lib/orders/schemas';
import { createOrder } from '@/lib/orders/create-order';
import { listOrders } from '@/lib/orders/queries';
import { toApiNumber } from '@/lib/money';

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Authentication required');
    const user = sessionUser(authResult);

    const url = new URL(request.url);
    const status = url.searchParams.getAll('status');
    const clientId = url.searchParams.get('clientId') ?? undefined;
    const q = url.searchParams.get('q') ?? undefined;
    const from = url.searchParams.get('from') ?? undefined;
    const to = url.searchParams.get('to') ?? undefined;
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';

    const orders = await listOrders(user, {
      status: status.length ? status : undefined,
      clientId,
      q,
      from,
      to,
      includeDeleted,
    });
    return jsonOk({ orders });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Authentication required');
    const user = sessionUser(authResult);

    const body = await request.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }

    const created = await createOrder(user, parsed.data);
    const { runOrderCreated } = await import('@/lib/notifications/hooks');
    await runOrderCreated(created.id);
    return jsonOk(
      {
        order: {
          id: created.id,
          orderNumber: created.orderNumber,
          orderDate: created.orderDate,
          dailySequence: created.dailySequence,
          clientId: created.clientId,
          status: created.status,
          source: created.source,
          courierNote: created.courierNote,
          totalAmount: toApiNumber(created.totalAmount),
          createdByUserId: created.createdByUserId,
          createdByRole: created.createdByRole,
          slaStartedAt: created.slaStartedAt,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
          ttnChecked: created.ttnChecked,
        },
        items: created.items.map((i) => ({
          id: i.id,
          positionNumber: i.positionNumber,
          categoryId: i.categoryId,
          techParams: i.techParams,
          quantity: i.quantity,
          unitPrice: toApiNumber(i.unitPrice),
          lineTotal: toApiNumber(i.lineTotal),
        })),
      },
      201,
    );
  } catch (err) {
    return jsonFromError(err);
  }
}
