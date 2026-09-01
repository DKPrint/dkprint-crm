export type SlaBadgeState = 'running' | 'stopped' | 'overdue';

export type SlaBadgeInput = {
  slaStartedAt: string;
  slaStoppedAt: string | null;
  status: string;
  targetHours?: number;
  now?: Date;
};

export type SlaBadge = {
  state: SlaBadgeState;
  /** Hours elapsed toward the goal (capped at stop time when stopped). */
  elapsedHours: number;
  /** Remaining hours until deadline; negative when overdue. Null when stopped. */
  remainingHours: number | null;
  label: string;
  badgeClass: string;
};

import { FALLBACK_SLA_TARGET_HOURS } from '@/lib/sla/constants';

/**
 * SLA badge for order card (TZ §11.1).
 * States: running | stopped | overdue vs targetHours (default from sla_goals).
 */
export function computeSlaBadge(input: SlaBadgeInput): SlaBadge {
  const targetHours = input.targetHours ?? FALLBACK_SLA_TARGET_HOURS;
  const now = input.now ?? new Date();
  const started = new Date(input.slaStartedAt).getTime();
  const stoppedAt = input.slaStoppedAt ? new Date(input.slaStoppedAt).getTime() : null;
  const endMs = stoppedAt ?? now.getTime();
  const elapsedHours = Math.max(0, (endMs - started) / (1000 * 60 * 60));

  if (stoppedAt != null || input.status === 'cancelled' || input.status === 'delivered') {
    return {
      state: 'stopped',
      elapsedHours: round1(elapsedHours),
      remainingHours: null,
      label: 'SLA: остановлен',
      badgeClass: 'badge st-sla-stopped',
    };
  }

  const remainingHours = targetHours - elapsedHours;
  if (remainingHours < 0) {
    return {
      state: 'overdue',
      elapsedHours: round1(elapsedHours),
      remainingHours: round1(remainingHours),
      label: `SLA: просрочен ${formatHours(Math.abs(remainingHours))}`,
      badgeClass: 'badge st-sla-overdue',
    };
  }

  return {
    state: 'running',
    elapsedHours: round1(elapsedHours),
    remainingHours: round1(remainingHours),
    label: `SLA: осталось ${formatHours(remainingHours)}`,
    badgeClass: 'badge st-sla-ok',
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatHours(h: number): string {
  const v = round1(h);
  if (v >= 24) {
    const days = Math.floor(v / 24);
    const hours = round1(v - days * 24);
    if (hours === 0) return `${days}д`;
    return `${days}д ${hours}ч`;
  }
  return `${v}ч`;
}
