import { requireAuth, sessionUser } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError } from '@/lib/api/http';
import { exportCatalogXlsx } from '@/lib/catalog/import-export';

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    const user = sessionUser(authResult);

    const buffer = await exportCatalogXlsx(user);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="catalog-export.xlsx"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
