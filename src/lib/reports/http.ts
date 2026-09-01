import { requireAuth } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { assertReportsAccess } from '@/lib/reports/access';
import { parseReportPeriod } from '@/lib/reports/period';

/** Shared auth + period parse for GET /api/reports/* (TZ §12.4). */
export async function withReportsAuth(request: Request) {
  const authResult = await requireAuth();
  if (!authResult) {
    return { error: jsonError(401, 'unauthorized', 'Требуется вход') as Response };
  }
  assertReportsAccess(authResult.user.role, authResult.flags);
  const period = parseReportPeriod(new URL(request.url).searchParams);
  return { period };
}

export { jsonFromError, jsonOk };
