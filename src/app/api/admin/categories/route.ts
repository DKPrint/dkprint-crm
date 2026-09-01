import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { createLegacyCategory, listLegacyCategories } from '@/lib/legacy-categories/queries';
import { createLegacyCategorySchema } from '@/lib/legacy-categories/schemas';

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);

    const categories = await listLegacyCategories(user);
    return jsonOk({ categories });
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
    const parsed = createLegacyCategorySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }

    const category = await createLegacyCategory(user, parsed.data);
    return jsonOk({ category }, 201);
  } catch (err) {
    return jsonFromError(err);
  }
}
