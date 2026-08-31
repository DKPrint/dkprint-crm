import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { createProduct, listProducts } from '@/lib/catalog/products';
import { createProductSchema } from '@/lib/catalog/schemas';

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);
    const url = new URL(request.url);
    const categoryId = url.searchParams.get('categoryId') || undefined;
    const includeInactive = url.searchParams.get('includeInactive') === 'true';
    const products = await listProducts(user, { categoryId, includeInactive });
    return jsonOk({ products });
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
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }
    const product = await createProduct(user, parsed.data);
    return jsonOk({ product }, 201);
  } catch (err) {
    return jsonFromError(err);
  }
}
