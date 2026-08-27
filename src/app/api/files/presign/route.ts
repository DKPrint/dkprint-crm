import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { presignUpload } from '@/lib/files/presign';
import { presignSchema } from '@/lib/files/schemas';

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);
    const body = await request.json();
    const parsed = presignSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const code = issue?.message === 'file_too_large' ? 'file_too_large' : 'validation';
      const message =
        issue?.message === 'invalid_mime'
          ? 'Недопустимый тип файла'
          : issue?.message === 'file_too_large'
            ? 'Файл больше 100 МБ'
            : parsed.error.message;
      return jsonError(400, code, message);
    }
    const result = await presignUpload(user, parsed.data);
    return jsonOk(result);
  } catch (err) {
    return jsonFromError(err);
  }
}
