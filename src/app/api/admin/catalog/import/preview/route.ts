/**
 * POST /api/admin/catalog/import/preview — parse xlsx without DB write (TZ §13.1).
 */
import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { assertCatalogAdmin } from '@/lib/catalog/access';
import { CATALOG_IMPORT_MAX_BYTES, CATALOG_IMPORT_MIME_TYPES } from '@/lib/catalog/import-columns';
import {
  buildCatalogImportPreview,
  parseCatalogImportBuffer,
  type CatalogImportSource,
} from '@/lib/catalog/parse-import-buffer';

function parseSource(raw: FormDataEntryValue | null): CatalogImportSource {
  if (raw === 'crm' || raw === 'fc_price' || raw === 'auto') return raw;
  return 'auto';
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);
    assertCatalogAdmin(user);

    const form = await request.formData();
    const file = form.get('file');
    const source = parseSource(form.get('source'));

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
    const parsed = await parseCatalogImportBuffer(buffer, source);
    const preview = buildCatalogImportPreview(parsed.format, parsed.rows, parsed.warnings);

    return jsonOk({ preview });
  } catch (err) {
    return jsonFromError(err);
  }
}
