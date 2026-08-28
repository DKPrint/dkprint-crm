/** Workshop queue statuses (TZ §12.2) — excludes `new`. */
export const WORKSHOP_STATUSES = [
  'accepted',
  'at_designer',
  'in_production',
  'ready_for_pickup',
] as const;

export type WorkshopStatus = (typeof WORKSHOP_STATUSES)[number];

/** Polling interval for workshop board (TZ §12.2: 30–60 s). */
export const WORKSHOP_POLL_MS = 45_000;
