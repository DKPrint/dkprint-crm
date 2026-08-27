'use client';

import { useState } from 'react';
import type { Role } from '@/lib/auth/permissions';
import { apiErrorMessage, type OrderDetail } from '../order-card';

type Props = {
  order: OrderDetail;
  role: Role;
  onError: (msg: string | null) => void;
  onSuccess: () => Promise<void>;
};

const NOTE_WRITERS = new Set<Role>(['admin', 'production', 'photo_center']);
const TTN_WRITERS = new Set<Role>(['admin', 'production']);

export function CourierSection({ order, role, onError, onSuccess }: Props) {
  const canEditNote =
    NOTE_WRITERS.has(role) &&
    !order.deletedAt &&
    order.status !== 'cancelled' &&
    (role !== 'photo_center' || order.status === 'new');
  const canEditTtn = TTN_WRITERS.has(role) && !order.deletedAt && order.status !== 'cancelled';
  const needsReason = role === 'photo_center';

  const [note, setNote] = useState(order.courierNote ?? '');
  const [syncedAt, setSyncedAt] = useState(order.updatedAt);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);

  if (order.updatedAt !== syncedAt) {
    setSyncedAt(order.updatedAt);
    setNote(order.courierNote ?? '');
  }

  async function saveNote() {
    onError(null);
    if (needsReason && !reason.trim()) {
      onError('Укажите причину');
      return;
    }
    setPending(true);
    try {
      const body: Record<string, unknown> = {
        courierNote: note.trim() ? note.trim() : null,
      };
      if (needsReason) body.reason = reason.trim();

      const res = await fetch(`/api/orders/${order.id}/courier-note`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        onError(apiErrorMessage(data, 'Не удалось сохранить заметку'));
        return;
      }
      await onSuccess();
    } catch {
      onError('Не удалось сохранить заметку');
    } finally {
      setPending(false);
    }
  }

  async function toggleTtn(checked: boolean) {
    onError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/ttn`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttnChecked: checked }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        onError(apiErrorMessage(data, 'Не удалось обновить ТТН'));
        return;
      }
      await onSuccess();
    } catch {
      onError('Не удалось обновить ТТН');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card">
      <h2>Для курьера</h2>
      {canEditNote ? (
        <div className="stack">
          <label className="field">
            Заметка
            <textarea
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </label>
          {needsReason ? (
            <label className="field">
              Причина
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
          ) : null}
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() => void saveNote()}
            >
              Сохранить
            </button>
          </div>
        </div>
      ) : (
        <p>{order.courierNote?.trim() ? order.courierNote : <span className="muted">—</span>}</p>
      )}

      <label
        className="field"
        style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <input
          type="checkbox"
          className="check-ttn"
          checked={order.ttnChecked}
          disabled={!canEditTtn || pending}
          onChange={(e) => void toggleTtn(e.target.checked)}
        />
        <span>ТТН оформлена</span>
      </label>
    </section>
  );
}
