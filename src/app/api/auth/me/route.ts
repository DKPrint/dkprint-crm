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
      deny_access_reports: flags.deny_access_reports,
      deny_edit_price: flags.deny_edit_price,
      deny_cancel_order: flags.deny_cancel_order,
      deny_soft_delete_order: flags.deny_soft_delete_order,
      deny_manage_sla: flags.deny_manage_sla,
    },
  });
}
