'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { SectionBack } from '@/components/section-back';
import type { Role } from '@/lib/auth/permissions';
import { formatMoney2 } from '@/lib/money';
import { statusBadgeClass, statusLabel } from '@/lib/orders/status-labels';

type Client = {
  id: string;
  name: string;
  userId: string | null;
  notes: string | null;
  isPhotoCenter: boolean;
  linkedUserEmail: string | null;
  linkedUserDisplayName: string | null;
  createdAt: string;
  deletedAt: string | null;
};

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  orderDate: string;
  totalAmount: number;
  deletedAt: string | null;
};

type Props = {
  clientId: string;
  role: Role;
  canEdit: boolean;
  canDelete: boolean;
};

export function ClientDetail({ clientId, role, canEdit, canDelete }: Props) {
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteComment, setDeleteComment] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}`, {
          credentials: 'same-origin',
          signal,
        });
        const data = (await res.json()) as {
          client?: Client;
          orders?: OrderRow[];
          message?: string;
        };
        if (signal?.aborted) return;
        if (!res.ok) {
          setError(data.message || (res.status === 404 ? 'Клиент не найден' : 'Ошибка загрузки'));
          setLoading(false);
          return;
        }
        setClient(data.client ?? null);
        setOrders(data.orders ?? []);
        if (data.client) {
          setEditName(data.client.name);
          setEditNotes(data.client.notes ?? '');
        }
        setLoading(false);
      } catch {
        if (signal?.aborted) return;
        setError('Ошибка загрузки');
        setLoading(false);
      }
    },
    [clientId],
  );

  useEffect(() => {
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void load(ac.signal);
    }, 0);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [load]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    setSaveBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          notes: editNotes.trim() || null,
        }),
      });
      const data = (await res.json()) as { client?: Client; message?: string };
      if (!res.ok) {
        setError(data.message || 'Не удалось сохранить');
        return;
      }
      setClient(data.client ?? client);
      setEditing(false);
    } catch {
      setError('Не удалось сохранить');
    } finally {
      setSaveBusy(false);
    }
  }

  async function onDelete() {
    if (!client || !deleteComment.trim()) {
      setError('Укажите комментарий');
      return;
    }
    setDeleteBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/soft-delete`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: deleteComment.trim() }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(data.message || 'Не удалось удалить клиента');
        return;
      }
      router.push('/clients');
      router.refresh();
    } catch {
      setError('Не удалось удалить клиента');
    } finally {
      setDeleteBusy(false);
    }
  }

  if (loading) return <p className="muted">Загрузка…</p>;
  if (!client) {
    return (
      <div className="stack">
        <SectionBack href="/clients" label="К списку клиентов" />
        <p className="form-error">{error || 'Клиент не найден'}</p>
      </div>
    );
  }

  const contacts = client.isPhotoCenter
    ? [client.linkedUserDisplayName, client.linkedUserEmail, client.notes]
        .filter(Boolean)
        .join(' · ')
    : client.notes;

  return (
    <div className="stack">
      <SectionBack href="/clients" label="К списку клиентов" />

      {error ? <p className="form-error">{error}</p> : null}

      <div className="card stack">
        <div className="page-head">
          <div>
            <h1>{client.name}</h1>
            <p className="lede">
              {client.isPhotoCenter ? 'Точка сети' : 'Внешний клиент'}
              {client.isPhotoCenter ? ' · user_id 1:1' : ' · user_id NULL'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {canEdit && !client.deletedAt ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditing((v) => !v)}
              >
                {editing ? 'Отмена' : 'Редактировать'}
              </button>
            ) : null}
            {canDelete && !client.isPhotoCenter && !client.deletedAt ? (
              <button type="button" className="btn btn-danger" onClick={() => setDeleteOpen(true)}>
                Удалить
              </button>
            ) : null}
          </div>
        </div>

        {client.deletedAt ? (
          <p className="muted">Клиент удалён (soft-delete). Заказы сохранены.</p>
        ) : null}

        {editing && canEdit && !client.deletedAt ? (
          <form className="stack" onSubmit={onSave}>
            <label className="field">
              Наименование
              <input
                className="input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                maxLength={200}
              />
            </label>
            <label className="field">
              Контакты / примечания
              <textarea
                className="input"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                maxLength={2000}
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={saveBusy}>
              {saveBusy ? 'Сохранение…' : 'Сохранить'}
            </button>
          </form>
        ) : (
          <dl className="stack" style={{ gap: 12 }}>
            <div>
              <dt className="muted" style={{ fontSize: 12, fontWeight: 600 }}>
                Контакты
              </dt>
              <dd style={{ marginTop: 4 }}>{contacts || '—'}</dd>
            </div>
            <div>
              <dt className="muted" style={{ fontSize: 12, fontWeight: 600 }}>
                Создан
              </dt>
              <dd style={{ marginTop: 4 }}>
                {new Date(client.createdAt).toLocaleDateString('ru-RU')}
              </dd>
            </div>
          </dl>
        )}
      </div>

      <div className="card stack">
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Заказы</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          Без soft-deleted по умолчанию (TZ §7).
        </p>

        {orders.length === 0 ? <p className="muted">Заказов нет</p> : null}

        {orders.length > 0 ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Дата</th>
                  <th>Статус</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className={o.deletedAt ? 'muted' : undefined}>
                    <td className="mono">
                      <Link href={`/orders/${o.id}`} className="linkish">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="mono">{o.orderDate}</td>
                    <td>
                      <span className={statusBadgeClass(o.status)}>{statusLabel(o.status)}</span>
                    </td>
                    <td className="mono">{formatMoney2(o.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <p className="muted" style={{ fontSize: 13 }}>
        Роль: {role}
      </p>

      {deleteOpen ? (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="modal stack">
            <h2>Удаление клиента</h2>
            <p className="muted">Внешний клиент скрывается из справочника; заказы остаются.</p>
            <label className="field">
              Комментарий
              <textarea
                className="input"
                value={deleteComment}
                onChange={(e) => setDeleteComment(e.target.value)}
                rows={3}
                required
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteOpen(false)}>
                Закрыть
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={deleteBusy}
                onClick={() => void onDelete()}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
