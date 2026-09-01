import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { deleteTask, getTaskById, patchTask } from '@/lib/tasks/queries';
import { patchTaskSchema } from '@/lib/tasks/schemas';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);

    const { id } = await context.params;
    const task = await getTaskById(user, id);
    return jsonOk({ task });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);

    const { id } = await context.params;
    const body = await request.json();
    const parsed = patchTaskSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }

    const task = await patchTask(user, id, parsed.data);
    return jsonOk({ task });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);

    const { id } = await context.params;
    await deleteTask(user, id);
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonFromError(err);
  }
}
