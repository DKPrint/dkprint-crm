import type { Role } from '@/lib/auth/permissions';

/** Order statuses from TZ §5.1 / migrations seed. */
export type OrderStatus =
  | 'new'
  | 'accepted'
  | 'at_designer'
  | 'in_production'
  | 'ready_for_pickup'
  | 'with_courier'
  | 'delivered'
  | 'cancelled';

export type TransitionDirection = 'forward' | 'backward' | 'cancel';

export type TransitionEdge = {
  from: OrderStatus;
  to: OrderStatus;
  direction: TransitionDirection;
  roles: Role[];
};

/** In-memory graph mirroring migrations/seed.sql (TZ §19.2). Tests / fixtures only. */
export const SEED_TRANSITIONS: readonly TransitionEdge[] = [
  // Forward
  { from: 'new', to: 'accepted', direction: 'forward', roles: ['admin', 'production', 'designer'] },
  {
    from: 'accepted',
    to: 'at_designer',
    direction: 'forward',
    roles: ['admin', 'production', 'designer'],
  },
  {
    from: 'at_designer',
    to: 'in_production',
    direction: 'forward',
    roles: ['admin', 'production', 'designer'],
  },
  {
    from: 'in_production',
    to: 'ready_for_pickup',
    direction: 'forward',
    roles: ['admin', 'production', 'designer'],
  },
  {
    from: 'ready_for_pickup',
    to: 'with_courier',
    direction: 'forward',
    roles: ['admin', 'courier'],
  },
  {
    from: 'with_courier',
    to: 'delivered',
    direction: 'forward',
    roles: ['admin', 'courier'],
  },
  // Backward
  {
    from: 'accepted',
    to: 'new',
    direction: 'backward',
    roles: ['admin', 'production', 'designer'],
  },
  {
    from: 'at_designer',
    to: 'accepted',
    direction: 'backward',
    roles: ['admin', 'production', 'designer'],
  },
  {
    from: 'in_production',
    to: 'at_designer',
    direction: 'backward',
    roles: ['admin', 'production', 'designer'],
  },
  {
    from: 'ready_for_pickup',
    to: 'in_production',
    direction: 'backward',
    roles: ['admin', 'production', 'designer'],
  },
  {
    from: 'with_courier',
    to: 'ready_for_pickup',
    direction: 'backward',
    roles: ['admin', 'courier'],
  },
  {
    from: 'delivered',
    to: 'with_courier',
    direction: 'backward',
    roles: ['admin', 'courier'],
  },
  // Cancel (designer never — enforced in canTransition)
  { from: 'new', to: 'cancelled', direction: 'cancel', roles: ['admin', 'production'] },
  { from: 'accepted', to: 'cancelled', direction: 'cancel', roles: ['admin', 'production'] },
  { from: 'at_designer', to: 'cancelled', direction: 'cancel', roles: ['admin', 'production'] },
  { from: 'in_production', to: 'cancelled', direction: 'cancel', roles: ['admin', 'production'] },
  {
    from: 'ready_for_pickup',
    to: 'cancelled',
    direction: 'cancel',
    roles: ['admin', 'production'],
  },
  { from: 'with_courier', to: 'cancelled', direction: 'cancel', roles: ['admin', 'production'] },
];

export type CanTransitionArgs = {
  from: OrderStatus;
  to: OrderStatus;
  role: Role;
  /** Admin-only direct jump (not via neighbor edge). Cancel still denied via jump. */
  isAdminJump?: boolean;
};

/**
 * Whether an active cancel transition path exists from `from` → cancelled.
 * Role membership on the edge is not required — permission is via can('cancel_order').
 */
export function hasCancelEdge(edges: readonly TransitionEdge[], from: OrderStatus): boolean {
  return edges.some((e) => e.from === from && e.to === 'cancelled' && e.direction === 'cancel');
}

/**
 * Whether a status change is allowed given active transition edges.
 * Designer never cancel; non-admin cannot admin-jump; neighbor/cancel need matching edge.
 */
export function canTransition(
  { from, to, role, isAdminJump = false }: CanTransitionArgs,
  edges: readonly TransitionEdge[],
): boolean {
  if (from === to) return false;

  // Designer never cancel/soft-delete (TZ §3 / §19.2)
  if (to === 'cancelled' && role === 'designer') return false;

  if (isAdminJump) {
    if (role !== 'admin') return false;
    // Jump into cancelled must use /cancel with reason, not jump (TZ §5)
    if (to === 'cancelled') return false;
    return true;
  }

  const edge = edges.find((e) => e.from === from && e.to === to);
  if (!edge) return false;
  return edge.roles.includes(role);
}

/** @deprecated Prefer SEED_TRANSITIONS — kept for callers that listed seed edges. */
export function listTransitions(): readonly TransitionEdge[] {
  return SEED_TRANSITIONS;
}
