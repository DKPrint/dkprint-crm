/**
 * POST /api/admin/catalog/import — multipart xlsx + replacePrices (TZ §13.1).
 * Column layout: see OPS.md «Catalog import/export xlsx» or import-columns.ts.
 */
import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { importCatalogXlsx } from '@/lib/catalog/import-export';
import { CATALOG_IMPORT_MAX_BYTES, CATALOG_IMPORT_MIME_TYPES } from '@/lib/catalog/import-columns';

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);

    const form = await request.formData();
    const file = form.get('file');
    const replaceRaw = form.get('replacePrices');
    const replacePrices = replaceRaw === 'true' || replaceRaw === '1' || replaceRaw === 'on';

    if (!(file instanceof File)) {
      return jsonError(400, 'validation', 'Укажите файл xlsx');
    }

    if (file.size === 0 || file.size > CATALOG_IMPORT_MAX_BYTES) {
      return jsonError(400, 'file_too_large', 'Файл пустой или больше 10 МБ');
    }

    const mime = file.type || 'application/octet-stream';
    if (!CATALOG_IMPORT_MIME_TYPES.has(mime)) {
      return jsonError(400, 'invalid_mime', 'Недопустимый тип файла (ожидается xlsx)');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importCatalogXlsx(user, buffer, {
      filename: file.name || null,
      replacePrices,
    });

    return jsonOk({ import: result });
  } catch (err) {
    return jsonFromError(err);
  }
}
