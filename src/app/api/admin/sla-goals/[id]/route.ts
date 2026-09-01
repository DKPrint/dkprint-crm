import { requireAuth } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { assertSlaManageAccess } from '@/lib/sla/access';
import { deleteSlaGoal, patchSlaGoal } from '@/lib/sla/goals';
import { patchSlaGoalSchema } from '@/lib/sla/schemas';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    assertSlaManageAccess(authResult.user.role, authResult.flags);

    const { id } = await context.params;
    const body = await request.json();
    const parsed = patchSlaGoalSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }

    const goal = await patchSlaGoal(id, {
      fromStatus: parsed.data.fromStatus,
      toStatus: parsed.data.toStatus,
      targetHours: parsed.data.targetHours,
      isActive: parsed.data.isActive,
      isSystemDefault: parsed.data.isSystemDefault,
    });
    return jsonOk({ goal });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    assertSlaManageAccess(authResult.user.role, authResult.flags);

    const { id } = await context.params;
    await deleteSlaGoal(id);
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonFromError(err);
  }
}
