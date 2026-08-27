import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { confirmUpload } from '@/lib/files/confirm';
import { confirmSchema } from '@/lib/files/schemas';

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);
    const body = await request.json();
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }
    const result = await confirmUpload(user, parsed.data.fileId);
    return jsonOk(result);
  } catch (err) {
    return jsonFromError(err);
  }
}
