import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { addProductBomLine, listProductBom } from '@/lib/catalog/bom';
import { createBomLineSchema } from '@/lib/catalog/schemas';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);
    const { id } = await ctx.params;
    const consumables = await listProductBom(user, id);
    return jsonOk({ consumables });
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
    const parsed = createBomLineSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }
    const line = await addProductBomLine(user, id, parsed.data);
    return jsonOk({ line }, 201);
  } catch (err) {
    return jsonFromError(err);
  }
}
