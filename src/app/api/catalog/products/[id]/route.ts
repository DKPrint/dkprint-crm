import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { getCatalogReadProduct } from '@/lib/catalog/read';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);
    const { id } = await ctx.params;

    const product = await getCatalogReadProduct(user, id);
    return jsonOk({ product });
  } catch (err) {
    return jsonFromError(err);
  }
}
