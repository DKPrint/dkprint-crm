export type NotificationEventType =
  | 'order_created'
  | 'status_changed'
  | 'comment_added'
  | 'problematic_layout'
  | 'sla_overdue'
  | 'ready_for_pickup';

export type OrderTelegramCard = {
  id: string;
  orderNumber: string;
  clientName: string;
  status: string;
  totalAmount: string;
  telegramMessageId: number | null;
  lastComment: string | null;
};

export type TelegramCardFlags = {
  problematicLayout?: boolean;
  slaOverdue?: boolean;
};
