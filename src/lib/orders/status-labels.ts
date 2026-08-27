/** RU labels for order statuses (TZ §5.1). */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  accepted: 'Принят в работу',
  at_designer: 'У дизайнера',
  in_production: 'На производстве',
  ready_for_pickup: 'Готов к выдаче',
  with_courier: 'У курьера',
  delivered: 'Выдан',
  cancelled: 'Отменён',
};

export const ORDER_STATUSES = Object.keys(ORDER_STATUS_LABELS);

/** CSS classes for status badge (design-system `.badge` + `.st-*`). */
export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'new':
      return 'badge st-new';
    case 'accepted':
      return 'badge st-accepted';
    case 'at_designer':
      return 'badge st-designer';
    case 'in_production':
      return 'badge st-production';
    case 'ready_for_pickup':
      return 'badge st-ready';
    case 'with_courier':
      return 'badge st-courier';
    case 'delivered':
      return 'badge st-done';
    case 'cancelled':
      return 'badge st-cancelled';
    default:
      return 'badge st-new';
  }
}

export function statusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}
