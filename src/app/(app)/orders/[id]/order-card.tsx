'use client';

import { useCallback, useState } from 'react';
import { SectionBack } from '@/components/section-back';
import type { PermissionFlags, Role } from '@/lib/auth/permissions';
import { OrderHeader } from './sections/header';
import { StatusControls } from './sections/status-controls';
import { OrderItems } from './sections/items';
import { OrderFiles } from './sections/files';
import { CourierSection } from './sections/courier';
import { CommentsSection } from './sections/comments';
import { StatusEvents } from './sections/status-events';
import { AuditLogs } from './sections/audit-logs';
import { TasksSection } from './sections/tasks';
import { OrderActions } from './sections/actions';

export type OrderItem = {
  id: string;
  orderId: string;
  positionNumber: number;
  categoryId: string | null;
  catalogProductId: string | null;
  isManual: boolean;
  categoryName: string | null;
  name: string;
  techParams: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderFile = {
  id: string;
  orderId: string;
  orderItemId: string;
  block: 'client' | 'designer';
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadStatus: 'pending' | 'confirmed' | 'failed';
  uploadedByUserId: string;
  createdAt: string;
};

export type OrderDetail = {
  id: string;
  orderNumber: string;
  orderDate: string;
  clientId: string;
  clientName: string | null;
  status: string;
  source: string;
  courierNote: string | null;
  ttnChecked: boolean;
  totalAmount: number;
  slaStartedAt: string;
  slaStoppedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  statusPrev: string | null;
  statusNext: string | null;
  items: OrderItem[];
  files: OrderFile[];
};

export type Category = { id: string; name: string };

type Props = {
  initialOrder: OrderDetail;
  role: Role;
  flags: PermissionFlags;
  slaTargetHours: number;
};

export function apiErrorMessage(
  data: { error?: string; message?: string },
  fallback: string,
): string {
  return data.message || data.error || fallback;
}

export function OrderCard({ initialOrder, role, flags, slaTargetHours }: Props) {
  const [order, setOrder] = useState(initialOrder);
  const [eventsKey, setEventsKey] = useState(0);
  const [auditKey, setAuditKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refreshOrder = useCallback(async () => {
    const qs = role === 'admin' ? '?includeDeleted=true' : '';
    const res = await fetch(`/api/orders/${order.id}${qs}`, { credentials: 'same-origin' });
    const data = (await res.json()) as {
      order?: OrderDetail;
      error?: string;
      message?: string;
    };
    if (!res.ok) {
      throw new Error(apiErrorMessage(data, 'Не удалось обновить заказ'));
    }
    if (!data.order) throw new Error('Пустой ответ сервера');
    setOrder(data.order);
    return data.order;
  }, [order.id, role]);

  const afterStatusChange = useCallback(async () => {
    await refreshOrder();
    setEventsKey((k) => k + 1);
    setAuditKey((k) => k + 1);
  }, [refreshOrder]);

  const afterMutation = useCallback(async () => {
    await refreshOrder();
    setAuditKey((k) => k + 1);
  }, [refreshOrder]);

  return (
    <div className="stack">
      <SectionBack href="/orders" label="К заказам" />
      <OrderHeader order={order} slaTargetHours={slaTargetHours} />

      {error ? <p className="form-error">{error}</p> : null}

      <StatusControls order={order} role={role} onError={setError} onSuccess={afterStatusChange} />

      <OrderItems
        order={order}
        role={role}
        flags={flags}
        onError={setError}
        onSuccess={afterMutation}
      />

      {role !== 'courier' ? (
        <OrderFiles order={order} role={role} onError={setError} onSuccess={afterMutation} />
      ) : null}

      <CourierSection order={order} role={role} onError={setError} onSuccess={afterMutation} />

      <CommentsSection orderId={order.id} role={role} onError={setError} />

      <StatusEvents orderId={order.id} refreshKey={eventsKey} />

      {role === 'admin' || role === 'production' ? (
        <AuditLogs orderId={order.id} refreshKey={auditKey} />
      ) : null}

      {role !== 'courier' ? (
        <TasksSection orderId={order.id} orderNumber={order.orderNumber} />
      ) : null}

      <OrderActions
        order={order}
        role={role}
        flags={flags}
        onError={setError}
        onSuccess={afterStatusChange}
      />
    </div>
  );
}
