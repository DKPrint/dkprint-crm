'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatMoney2 } from '@/lib/money';
import { computeSlaBadge } from '@/lib/orders/sla-badge';
import { statusBadgeClass, statusLabel } from '@/lib/orders/status-labels';
import { WORKSHOP_POLL_MS, WORKSHOP_STATUSES } from '@/lib/workshop/constants';
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

  const byStatus = (status: string) => orders.filter((o) => o.status === status);

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

      <div className="workshop-board">
        {WORKSHOP_STATUSES.map((status) => (
          <section key={status} className="workshop-column" aria-label={statusLabel(status)}>
            <header className="workshop-column-head">
              <h2>{statusLabel(status)}</h2>
              <span className="workshop-count">{byStatus(status).length}</span>
            </header>
            <div className="workshop-cards">
              {byStatus(status).length === 0 ? (
                <p className="muted workshop-empty">Нет заказов</p>
              ) : (
                byStatus(status).map((order) => (
                  <WorkshopCard
                    key={order.id}
                    order={order}
                    pending={pendingId === order.id}
                    onPrev={() => void changeStatus(order.id, 'prev')}
                    onNext={() => void changeStatus(order.id, 'next')}
                  />
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

type CardProps = {
  order: WorkshopOrder;
  pending: boolean;
  onPrev: () => void;
  onNext: () => void;
};

function WorkshopCard({ order, pending, onPrev, onNext }: CardProps) {
  const sla = computeSlaBadge({
    slaStartedAt: order.slaStartedAt,
    slaStoppedAt: order.slaStoppedAt,
    status: order.status,
  });
  const prevLabel = order.statusPrev ? statusLabel(order.statusPrev) : null;
  const nextLabel = order.statusNext ? statusLabel(order.statusNext) : null;

  return (
    <article className="workshop-card card">
      <div className="workshop-card-head">
        <Link href={`/orders/${order.id}`} className="workshop-order-link mono">
          {order.orderNumber}
        </Link>
        <span className={statusBadgeClass(order.status)}>{statusLabel(order.status)}</span>
      </div>
      <p className="workshop-client">{order.clientName ?? '—'}</p>
      <div className="workshop-meta">
        <span className="mono">{formatMoney2(order.totalAmount)}</span>
        <span className={sla.badgeClass}>{sla.label}</span>
      </div>
      <div className="workshop-actions">
        <button
          type="button"
          className="btn btn-secondary btn-lg workshop-btn"
          disabled={pending || !order.statusPrev}
          aria-label={prevLabel ? `Откатить в: ${prevLabel}` : 'Предыдущий статус недоступен'}
          onClick={onPrev}
        >
          {prevLabel ? `← ${prevLabel}` : '←'}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-lg workshop-btn"
          disabled={pending || !order.statusNext}
          aria-label={nextLabel ? `Перейти в: ${nextLabel}` : 'Следующий статус недоступен'}
          onClick={onNext}
        >
          {nextLabel ? `${nextLabel} →` : '→'}
        </button>
      </div>
    </article>
  );
}
