import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { listCatalogReadCategories } from '@/lib/catalog/read';

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);

    const { searchParams } = new URL(request.url);
    const parentRaw = searchParams.get('parentId');
    const parentId = parentRaw === '' || parentRaw === 'null' ? null : parentRaw;

    const categories = await listCatalogReadCategories(user, { parentId });
    return jsonOk({ categories });
  } catch (err) {
    return jsonFromError(err);
  }
}
