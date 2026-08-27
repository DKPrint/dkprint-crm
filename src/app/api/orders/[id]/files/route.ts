import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { listFilesForOrder } from '@/lib/files/queries';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);
    const { id } = await ctx.params;
    const url = new URL(request.url);
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
    const files = await listFilesForOrder(user, id, { includeDeleted });
    return jsonOk({ files });
  } catch (err) {
    return jsonFromError(err);
  }
}
