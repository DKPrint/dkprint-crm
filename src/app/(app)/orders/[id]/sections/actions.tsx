'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { can, type PermissionFlags, type Role } from '@/lib/auth/permissions';
import { apiErrorMessage, type OrderDetail } from '../order-card';

type Props = {
  order: OrderDetail;
  role: Role;
  flags: PermissionFlags;
  onError: (msg: string | null) => void;
  onSuccess: () => Promise<void>;
};

export function OrderActions({ order, role, flags, onError, onSuccess }: Props) {
  const router = useRouter();
  const showCancel =
    role !== 'designer' &&
    can(role, 'cancel_order', flags) &&
    !order.deletedAt &&
    order.status !== 'cancelled' &&
    order.status !== 'delivered';
  const showSoftDelete =
    role !== 'designer' && can(role, 'soft_delete_order', flags) && !order.deletedAt;
  const softDeleteHint =
    role === 'photo_center' && !can(role, 'soft_delete_order', flags) && !order.deletedAt;

  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [password, setPassword] = useState('');
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState(false);

  async function doCancel() {
    onError(null);
    if (!cancelReason.trim()) {
      onError('Укажите причину отмены');
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/cancel`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        onError(apiErrorMessage(data, 'Не удалось отменить заказ'));
        return;
      }
      setCancelOpen(false);
      await onSuccess();
    } catch {
      onError('Не удалось отменить заказ');
    } finally {
      setPending(false);
    }
  }

  async function doSoftDelete() {
    onError(null);
    if (!password || !comment.trim()) {
      onError('Укажите пароль и комментарий');
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/soft-delete`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, comment: comment.trim() }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        onError(apiErrorMessage(data, 'Не удалось удалить заказ'));
        return;
      }
      setDeleteOpen(false);
      router.push('/orders');
      router.refresh();
    } catch {
      onError('Не удалось удалить заказ');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card">
      <h2>Действия</h2>
      <div className="toolbar" style={{ marginBottom: 0 }}>
        {showCancel ? (
          <button
            type="button"
            className="btn btn-danger"
            disabled={pending}
            onClick={() => setCancelOpen(true)}
          >
            Отменить
          </button>
        ) : null}
        {showSoftDelete ? (
          <button
            type="button"
            className="btn btn-danger"
            disabled={pending}
            onClick={() => setDeleteOpen(true)}
          >
            Удалить
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost" disabled title="скоро">
          Создать задачу — скоро
        </button>
      </div>
      {softDeleteHint ? (
        <p className="muted" style={{ marginTop: 12 }}>
          Удаление недоступно. Свяжитесь с производством или администратором.
        </p>
      ) : null}

      {cancelOpen ? (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="modal stack">
            <h2>Отмена заказа</h2>
            <label className="field">
              Причина
              <textarea
                className="input"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setCancelOpen(false)}>
                Закрыть
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={pending}
                onClick={() => void doCancel()}
              >
                Отменить заказ
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteOpen ? (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="modal stack">
            <h2>Удаление заказа</h2>
            <label className="field">
              Пароль
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label className="field">
              Комментарий
              <textarea
                className="input"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteOpen(false)}>
                Закрыть
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={pending}
                onClick={() => void doSoftDelete()}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
