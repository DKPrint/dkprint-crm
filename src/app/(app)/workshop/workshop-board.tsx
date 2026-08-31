'use client';

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { formatMoney2 } from '@/lib/money';
import { shortTech } from '@/lib/orders/format-tech';
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
  const [expandedIds, setExpandedIds] = useState<Record<string, true>>({});

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
      const next = data.orders ?? [];
      setOrders(next);
      setLastRefresh(new Date());
      setError(null);
      setExpandedIds((prev) => {
        const alive = new Set(next.map((o) => o.id));
        const kept: Record<string, true> = {};
        for (const id of Object.keys(prev)) {
          if (alive.has(id)) kept[id] = true;
        }
        return kept;
      });
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

  function toggleExpanded(orderId: string) {
    setExpandedIds((prev) => {
      if (prev[orderId]) {
        const next = { ...prev };
        delete next[orderId];
        return next;
      }
      return { ...prev, [orderId]: true };
    });
  }

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
                  expanded={expandedIds[order.id] === true}
                  onToggle={() => toggleExpanded(order.id)}
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
  expanded: boolean;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
};

function WorkshopRow({ order, pending, expanded, onToggle, onPrev, onNext }: RowProps) {
  const sla = computeSlaBadge({
    slaStartedAt: order.slaStartedAt,
    slaStoppedAt: order.slaStoppedAt,
    status: order.status,
  });
  const prevLabel = order.statusPrev ? statusLabel(order.statusPrev) : null;
  const nextLabel = order.statusNext ? statusLabel(order.statusNext) : null;

  return (
    <Fragment>
      <tr className={`workshop-row${expanded ? ' workshop-row-open' : ''}`} onClick={onToggle}>
        <td className="mono">
          <span className="workshop-num-cell">
            <button
              type="button"
              className="workshop-chevron"
              aria-expanded={expanded}
              aria-label={expanded ? 'Свернуть состав' : 'Развернуть состав'}
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
            >
              {expanded ? '▼' : '▶'}
            </button>
            <Link
              href={`/orders/${order.id}`}
              className="linkish"
              onClick={(e) => e.stopPropagation()}
            >
              {order.orderNumber}
            </Link>
            {order.isUrgent ? (
              <span className="workshop-urgent" title="Срочно">
                Срочно
              </span>
            ) : null}
          </span>
        </td>
        <td>{order.clientName ?? '—'}</td>
        <td>
          <span className={statusBadgeClass(order.status)}>{statusLabel(order.status)}</span>
        </td>
        <td className="mono">{formatMoney2(order.totalAmount)}</td>
        <td>
          <span className={sla.badgeClass}>{sla.label}</span>
        </td>
        <td onClick={(e) => e.stopPropagation()}>
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
      {expanded ? (
        <tr className="workshop-detail">
          <td colSpan={6}>
            {order.items.length === 0 ? (
              <p className="muted workshop-detail-empty">Позиций нет</p>
            ) : (
              <ul className="workshop-detail-list">
                {order.items.map((it) => {
                  const name = it.name.trim() ? it.name : '—';
                  return (
                    <li key={it.positionNumber}>
                      {it.positionNumber}. {name}, {it.quantity} шт, {shortTech(it.techParams)},
                      макет: {it.hasLayout ? 'есть' : 'нет'}
                    </li>
                  );
                })}
              </ul>
            )}
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}
