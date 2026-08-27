import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { getDownloadUrl } from '@/lib/files/download';

type Ctx = { params: Promise<{ fileId: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);
    const { fileId } = await ctx.params;
    const result = await getDownloadUrl(user, fileId);
    return jsonOk(result);
  } catch (err) {
    return jsonFromError(err);
  }
}
