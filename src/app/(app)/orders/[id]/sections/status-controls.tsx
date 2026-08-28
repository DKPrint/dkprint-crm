'use client';

import { useState } from 'react';
import type { Role } from '@/lib/auth/permissions';
import { ORDER_STATUSES, statusLabel } from '@/lib/orders/status-labels';
import { apiErrorMessage, type OrderDetail } from '../order-card';

type Props = {
  order: OrderDetail;
  role: Role;
  onError: (msg: string | null) => void;
  onSuccess: () => Promise<void>;
};

const JUMP_STATUSES = ORDER_STATUSES.filter((s) => s !== 'cancelled');

export function StatusControls({ order, role, onError, onSuccess }: Props) {
  const [pending, setPending] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [toStatus, setToStatus] = useState(JUMP_STATUSES[0] ?? 'new');

  if (role === 'photo_center') return null;

  const locked = Boolean(order.deletedAt) || order.status === 'cancelled';
  const prevLabel = order.statusPrev ? statusLabel(order.statusPrev) : null;
  const nextLabel = order.statusNext ? statusLabel(order.statusNext) : null;

  async function postStatus(path: string, body?: unknown) {
    onError(null);
    setPending(true);
    try {
      const res = await fetch(path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        onError(apiErrorMessage(data, 'Не удалось изменить статус'));
        return;
      }
      setJumpOpen(false);
      await onSuccess();
    } catch {
      onError('Не удалось изменить статус');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card">
      <h2>Статус</h2>
      <div className="toolbar status-toolbar" style={{ marginBottom: 0 }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending || locked || !order.statusPrev}
          onClick={() => void postStatus(`/api/orders/${order.id}/status/prev`)}
          aria-label={prevLabel ? `Откатить в: ${prevLabel}` : 'Предыдущий статус недоступен'}
        >
          {prevLabel ? `← ${prevLabel}` : '←'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending || locked || !order.statusNext}
          onClick={() => void postStatus(`/api/orders/${order.id}/status/next`)}
          aria-label={nextLabel ? `Перейти в: ${nextLabel}` : 'Следующий статус недоступен'}
        >
          {nextLabel ? `${nextLabel} →` : '→'}
        </button>
        {role === 'admin' ? (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending || Boolean(order.deletedAt)}
            onClick={() => setJumpOpen(true)}
          >
            Перейти в…
          </button>
        ) : null}
      </div>

      {jumpOpen ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="jump-title">
          <div className="modal">
            <h2 id="jump-title">Перейти в статус</h2>
            <label className="field">
              Статус
              <select
                className="input"
                value={toStatus}
                onChange={(e) => setToStatus(e.target.value)}
              >
                {JUMP_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setJumpOpen(false)}>
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending}
                onClick={() => void postStatus(`/api/orders/${order.id}/status/jump`, { toStatus })}
              >
                Перейти
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
