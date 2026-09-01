import { sql } from '@/lib/db';
import { FALLBACK_SLA_TARGET_HOURS } from './constants';

type DbSlaGoal = {
  id: string;
  from_status: string;
  to_status: string;
  target_hours: number;
  is_active: boolean;
  is_system_default: boolean;
};

export type SlaGoal = {
  id: string;
  fromStatus: string;
  toStatus: string;
  targetHours: number;
  isActive: boolean;
  isSystemDefault: boolean;
};

function serialize(row: DbSlaGoal): SlaGoal {
  return {
    id: row.id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    targetHours: row.target_hours,
    isActive: row.is_active,
    isSystemDefault: row.is_system_default,
  };
}

/** Active system default target hours for badge + cron (TZ §11.1). */
export async function getDefaultSlaTargetHours(): Promise<number> {
  const rows = (await sql`
    SELECT target_hours
    FROM sla_goals
    WHERE is_system_default = true AND is_active = true
    ORDER BY target_hours ASC
    LIMIT 1
  `) as Array<{ target_hours: number }>;
  const hours = rows[0]?.target_hours;
  return typeof hours === 'number' && hours > 0 ? hours : FALLBACK_SLA_TARGET_HOURS;
}

export async function listSlaGoals(): Promise<SlaGoal[]> {
  const rows = (await sql`
    SELECT id, from_status, to_status, target_hours, is_active, is_system_default
    FROM sla_goals
    ORDER BY is_system_default DESC, is_active DESC, from_status ASC, to_status ASC
  `) as DbSlaGoal[];
  return rows.map(serialize);
}

async function clearOtherSystemDefaults(exceptId?: string): Promise<void> {
  if (exceptId) {
    await sql`
      UPDATE sla_goals
      SET is_system_default = false
      WHERE is_system_default = true AND id != ${exceptId}::uuid
    `;
  } else {
    await sql`UPDATE sla_goals SET is_system_default = false WHERE is_system_default = true`;
  }
}

export async function createSlaGoal(input: {
  fromStatus: string;
  toStatus: string;
  targetHours: number;
  isActive?: boolean;
  isSystemDefault?: boolean;
}): Promise<SlaGoal> {
  const isActive = input.isActive ?? true;
  const isSystemDefault = input.isSystemDefault ?? false;

  if (isSystemDefault) {
    await clearOtherSystemDefaults();
  }

  const rows = (await sql`
    INSERT INTO sla_goals (from_status, to_status, target_hours, is_active, is_system_default)
    VALUES (
      ${input.fromStatus},
      ${input.toStatus},
      ${input.targetHours},
      ${isActive},
      ${isSystemDefault}
    )
    RETURNING id, from_status, to_status, target_hours, is_active, is_system_default
  `) as DbSlaGoal[];

  const row = rows[0];
  if (!row) throw new Error('validation');
  return serialize(row);
}

export async function patchSlaGoal(
  goalId: string,
  input: {
    fromStatus?: string;
    toStatus?: string;
    targetHours?: number;
    isActive?: boolean;
    isSystemDefault?: boolean;
  },
): Promise<SlaGoal> {
  const existingRows = (await sql`
    SELECT id, from_status, to_status, target_hours, is_active, is_system_default
    FROM sla_goals
    WHERE id = ${goalId}::uuid
    LIMIT 1
  `) as DbSlaGoal[];

  const existing = existingRows[0];
  if (!existing) throw new Error('sla_goal_not_found');

  const fromStatus = input.fromStatus ?? existing.from_status;
  const toStatus = input.toStatus ?? existing.to_status;
  const targetHours = input.targetHours ?? existing.target_hours;
  const isActive = input.isActive ?? existing.is_active;
  let isSystemDefault = input.isSystemDefault ?? existing.is_system_default;

  if (input.isSystemDefault === true) {
    await clearOtherSystemDefaults(goalId);
    isSystemDefault = true;
  }

  const rows = (await sql`
    UPDATE sla_goals
    SET
      from_status = ${fromStatus},
      to_status = ${toStatus},
      target_hours = ${targetHours},
      is_active = ${isActive},
      is_system_default = ${isSystemDefault}
    WHERE id = ${goalId}::uuid
    RETURNING id, from_status, to_status, target_hours, is_active, is_system_default
  `) as DbSlaGoal[];

  const row = rows[0];
  if (!row) throw new Error('sla_goal_not_found');
  return serialize(row);
}

export async function deleteSlaGoal(goalId: string): Promise<void> {
  const rows = (await sql`
    SELECT is_system_default FROM sla_goals WHERE id = ${goalId}::uuid LIMIT 1
  `) as Array<{ is_system_default: boolean }>;
  const row = rows[0];
  if (!row) throw new Error('sla_goal_not_found');
  if (row.is_system_default) throw new Error('cannot_delete_system_default');

  await sql`DELETE FROM sla_goals WHERE id = ${goalId}::uuid`;
}
