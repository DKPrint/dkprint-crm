import { requireAuth } from '@/lib/auth/requireAuth';
import { jsonError, jsonOk } from '@/lib/api/http';

/** GET /api/auth/me — current user + permission_overrides (TZ §15.1). */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult) {
    return jsonError(401, 'unauthorized', 'Authentication required');
  }

  const { user, flags } = authResult;
  return jsonOk({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      clientId: user.clientId,
    },
    permissions: {
      can_access_reports: flags.can_access_reports,
      can_edit_price: flags.can_edit_price,
      can_cancel_order: flags.can_cancel_order,
      can_soft_delete_order: flags.can_soft_delete_order,
      can_manage_sla: flags.can_manage_sla,
    },
  });
}
