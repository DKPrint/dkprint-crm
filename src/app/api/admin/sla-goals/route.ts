import { requireAuth } from '@/lib/auth/requireAuth';
import { jsonError, jsonFromError, jsonOk } from '@/lib/api/http';
import { assertSlaManageAccess } from '@/lib/sla/access';
import { createSlaGoal, listSlaGoals } from '@/lib/sla/goals';
import { createSlaGoalSchema } from '@/lib/sla/schemas';

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    assertSlaManageAccess(authResult.user.role, authResult.flags);

    const goals = await listSlaGoals();
    return jsonOk({ goals });
  } catch (err) {
    return jsonFromError(err);
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth();
    if (!authResult) return jsonError(401, 'unauthorized', 'Требуется вход');
    assertSlaManageAccess(authResult.user.role, authResult.flags);

    const body = await request.json();
    const parsed = createSlaGoalSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'validation', parsed.error.message);
    }

    const goal = await createSlaGoal({
      fromStatus: parsed.data.fromStatus,
      toStatus: parsed.data.toStatus,
      targetHours: parsed.data.targetHours,
      isActive: parsed.data.isActive,
      isSystemDefault: parsed.data.isSystemDefault,
    });
    return jsonOk({ goal }, 201);
  } catch (err) {
    return jsonFromError(err);
  }
}
