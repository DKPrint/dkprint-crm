import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { listCatalogReadProducts } from '@/lib/catalog/read';

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    if (!categoryId) {
      return jsonError(400, 'validation', 'categoryId required');
    }
    const q = searchParams.get('q') ?? undefined;

    const products = await listCatalogReadProducts(user, { categoryId, q });
    return jsonOk({ products });
  } catch (err) {
    return jsonFromError(err);
  }
}
