import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { createTask, listTasks } from '@/lib/tasks/queries';
import { createTaskSchema, parseTaskFilter } from '@/lib/tasks/schemas';

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);

    const { searchParams } = new URL(request.url);
    const filter = parseTaskFilter(searchParams.get('filter'));
    const orderId = searchParams.get('orderId') ?? undefined;

    const tasks = await listTasks(user, { filter, orderId });
    return jsonOk({ tasks });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);

    const body = await request.json();
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }

    const task = await createTask(user, parsed.data);
    return jsonOk({ task }, 201);
  } catch (err) {
    return jsonFromError(err);
  }
}
