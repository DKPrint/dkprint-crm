'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatMoney2 } from '@/lib/money';
import { computeSlaBadge } from '@/lib/orders/sla-badge';
import { statusBadgeClass, statusLabel } from '@/lib/orders/status-labels';
import { WORKSHOP_POLL_MS } from '@/lib/workshop/constants';
import type { WorkshopOrder } from '@/lib/workshop/queue';

type Props = {
  initialOrders: WorkshopOrder[];
};

function apiErrorMessage(data: { error?: string; message?: string }, fallback: string): string {
  return data.message || data.error || fallback;
}

export function WorkshopBoard({ initialOrders }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(() => new Date());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/workshop/queue', { credentials: 'same-origin' });
      const data = (await res.json()) as {
        orders?: WorkshopOrder[];
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(apiErrorMessage(data, 'Не удалось обновить очередь'));
        return;
      }
      setOrders(data.orders ?? []);
      setLastRefresh(new Date());
      setError(null);
    } catch {
      setError('Не удалось обновить очередь');
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, WORKSHOP_POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function changeStatus(orderId: string, direction: 'prev' | 'next') {
    setError(null);
    setPendingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status/${direction}`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(apiErrorMessage(data, 'Не удалось изменить статус'));
        return;
      }
      await refresh();
    } catch {
      setError('Не удалось изменить статус');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="workshop">
      <div className="workshop-head">
        <div>
          <h1>Очередь цеха</h1>
          <p className="muted">
            Обновлено{' '}
            {lastRefresh.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            {' · '}
            авто каждые {WORKSHOP_POLL_MS / 1000} с
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void refresh()}>
          Обновить
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>№</th>
              <th>Клиент</th>
              <th>Статус</th>
              <th>Сумма</th>
              <th>SLA</th>
              <th>Переход</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  Заказов в очереди нет
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <WorkshopRow
                  key={order.id}
                  order={order}
                  pending={pendingId === order.id}
                  onPrev={() => void changeStatus(order.id, 'prev')}
                  onNext={() => void changeStatus(order.id, 'next')}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type RowProps = {
  order: WorkshopOrder;
  pending: boolean;
  onPrev: () => void;
  onNext: () => void;
};

function WorkshopRow({ order, pending, onPrev, onNext }: RowProps) {
  const sla = computeSlaBadge({
    slaStartedAt: order.slaStartedAt,
    slaStoppedAt: order.slaStoppedAt,
    status: order.status,
  });
  const prevLabel = order.statusPrev ? statusLabel(order.statusPrev) : null;
  const nextLabel = order.statusNext ? statusLabel(order.statusNext) : null;

  return (
    <tr>
      <td className="mono">
        <Link href={`/orders/${order.id}`} className="linkish">
          {order.orderNumber}
        </Link>
        {order.isUrgent ? (
          <span className="workshop-urgent" title="Срочно">
            Срочно
          </span>
        ) : null}
      </td>
      <td>{order.clientName ?? '—'}</td>
      <td>
        <span className={statusBadgeClass(order.status)}>{statusLabel(order.status)}</span>
      </td>
      <td className="mono">{formatMoney2(order.totalAmount)}</td>
      <td>
        <span className={sla.badgeClass}>{sla.label}</span>
      </td>
      <td>
        <div className="workshop-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={pending || !order.statusPrev}
            aria-label={prevLabel ? `Откатить в: ${prevLabel}` : 'Предыдущий статус недоступен'}
            onClick={onPrev}
          >
            {prevLabel ? `← ${prevLabel}` : '←'}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={pending || !order.statusNext}
            aria-label={nextLabel ? `Перейти в: ${nextLabel}` : 'Следующий статус недоступен'}
            onClick={onNext}
          >
            {nextLabel ? `${nextLabel} →` : '→'}
          </button>
        </div>
      </td>
    </tr>
  );
}
