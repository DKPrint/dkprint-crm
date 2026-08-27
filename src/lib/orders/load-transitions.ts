import { sql } from '@/lib/db';
import type { Role } from '@/lib/auth/permissions';
import type { OrderStatus, TransitionDirection, TransitionEdge } from './status-transitions';

type TransitionRow = {
  from_status: string;
  to_status: string;
  direction: string;
  allowed_roles: string[];
};

/** Active edges from status_transitions (TZ §5 / §14.6). */
export async function loadActiveTransitions(): Promise<TransitionEdge[]> {
  const rows = (await sql`
    SELECT from_status, to_status, direction, allowed_roles
    FROM status_transitions
    WHERE is_active = true
  `) as TransitionRow[];

  return rows.map((r) => ({
    from: r.from_status as OrderStatus,
    to: r.to_status as OrderStatus,
    direction: r.direction as TransitionDirection,
    roles: r.allowed_roles as Role[],
  }));
}
