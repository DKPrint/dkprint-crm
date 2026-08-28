import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import {
  clearProblematicLayout,
  createComment,
  listCommentsForOrder,
  orderHasProblematicLayout,
} from '@/lib/comments/queries';
import { createCommentSchema } from '@/lib/comments/schemas';
import { runCommentAdded, runProblematicCleared } from '@/lib/notifications/hooks';

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
    const hasProblematicLayout = await orderHasProblematicLayout(id);
    return jsonOk({ comments, hasProblematicLayout });
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
    // Await TG so serverless does not drop the edit
    await runCommentAdded(id, parsed.data.isProblematicLayout);
    return jsonOk({ comment }, 201);
  } catch (err) {
    return jsonFromError(err);
  }
}

/** Clear problematic-layout flags (production/admin). */
export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as {
      clearProblematicLayout?: boolean;
    };
    if (body.clearProblematicLayout !== true) {
      return jsonError(400, 'validation', 'Укажите clearProblematicLayout: true');
    }
    const result = await clearProblematicLayout(user, id);
    await runProblematicCleared(id);
    return jsonOk({ ...result, hasProblematicLayout: false });
  } catch (err) {
    return jsonFromError(err);
  }
}
