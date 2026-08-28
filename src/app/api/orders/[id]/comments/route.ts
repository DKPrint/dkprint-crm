import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { createComment, listCommentsForOrder } from '@/lib/comments/queries';
import { createCommentSchema } from '@/lib/comments/schemas';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);
    const { id } = await ctx.params;
    const url = new URL(request.url);
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
    const comments = await listCommentsForOrder(user, id, { includeDeleted });
    return jsonOk({ comments });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);
    const { id } = await ctx.params;
    const body = await request.json();
    const parsed = createCommentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', 'Укажите текст комментария');
    }
    const comment = await createComment(user, id, {
      body: parsed.data.body,
      isProblematicLayout: parsed.data.isProblematicLayout,
    });
    const { scheduleCommentAdded } = await import('@/lib/notifications/hooks');
    scheduleCommentAdded(id, parsed.data.isProblematicLayout);
    return jsonOk({ comment }, 201);
  } catch (err) {
    return jsonFromError(err);
  }
}
