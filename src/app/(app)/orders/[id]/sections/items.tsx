'use client';

import { useState } from 'react';
import { can, type PermissionFlags, type Role } from '@/lib/auth/permissions';
import { formatMoney2, lineTotal } from '@/lib/money';
import {
  CatalogOrderLineFields,
  catalogLineToPayload,
  emptyCatalogLine,
  validateCatalogLine,
  type CatalogOrderLineState,
} from '@/components/catalog-order-line';
import { apiErrorMessage, type OrderDetail, type OrderItem } from '../order-card';

type Props = {
  order: OrderDetail;
  role: Role;
  flags: PermissionFlags;
  onError: (msg: string | null) => void;
  onSuccess: () => Promise<void>;
};

function canEditItems(role: Role, order: OrderDetail): boolean {
  if (order.deletedAt || order.status === 'cancelled') return false;
  if (role === 'admin') return true;
  if (role === 'production') return order.source === 'production';
  if (role === 'photo_center') return order.status === 'new';
  return false;
}

function previewLine(qty: string, price: string): string {
  const q = Number.parseInt(qty, 10);
  if (!Number.isInteger(q) || q <= 0) return '—';
  try {
    return formatMoney2(lineTotal(q, price || 0));
  } catch {
    return '—';
  }
}

export function OrderItems({ order, role, flags, onError, onSuccess }: Props) {
  const editable = canEditItems(role, order);
  const canPrice = editable && can(role, 'edit_price', flags);
  const needsReason = role === 'photo_center';

  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: '',
    techParams: '',
    quantity: '1',
    unitPrice: '0',
  });
  const [adding, setAdding] = useState(false);
  const [addLine, setAddLine] = useState<CatalogOrderLineState>(() => emptyCatalogLine());

  function startEdit(item: OrderItem) {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      techParams: item.techParams ?? '',
      quantity: String(item.quantity),
      unitPrice: formatMoney2(item.unitPrice),
    });
  }

  async function api(path: string, init: RequestInit) {
    onError(null);
    setPending(true);
    try {
      const res = await fetch(path, { credentials: 'same-origin', ...init });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        onError(apiErrorMessage(data, 'Ошибка сохранения позиции'));
        return false;
      }
      await onSuccess();
      return true;
    } catch {
      onError('Ошибка сохранения позиции');
      return false;
    } finally {
      setPending(false);
    }
  }

  async function saveEdit(item: OrderItem) {
    const quantity = Number.parseInt(draft.quantity, 10);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      onError('Проверьте количество');
      return;
    }
    if (needsReason && !reason.trim()) {
      onError('Укажите причину');
      return;
    }

    const body: Record<string, unknown> = {
      techParams: draft.techParams.trim() ? draft.techParams.trim() : null,
      quantity,
    };
    if (item.isManual) {
      const name = draft.name.trim();
      if (!name) {
        onError('Укажите наименование');
        return;
      }
      body.name = name;
    }
    if (needsReason) body.reason = reason.trim();

    const ok = await api(`/api/orders/${order.id}/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!ok) return;

    if (canPrice) {
      const unitPrice = Number(draft.unitPrice);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        onError('Цена должна быть числом ≥ 0');
        return;
      }
      if (formatMoney2(unitPrice) !== formatMoney2(item.unitPrice)) {
        const priceBody: Record<string, unknown> = { unitPrice };
        if (needsReason) priceBody.reason = reason.trim();
        const priceOk = await api(`/api/orders/${order.id}/items/${item.id}/price`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(priceBody),
        });
        if (!priceOk) return;
      }
    }

    setEditingId(null);
  }

  async function removeItem(item: OrderItem) {
    if (order.items.length <= 1) {
      onError('Нельзя удалить последнюю позицию');
      return;
    }
    if (needsReason && !reason.trim()) {
      onError('Укажите причину');
      return;
    }
    const ok = await api(`/api/orders/${order.id}/items/${item.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(needsReason ? { reason: reason.trim() } : {}),
    });
    if (ok && editingId === item.id) setEditingId(null);
  }

  async function addItem() {
    const err = validateCatalogLine(addLine);
    if (err) {
      onError(err);
      return;
    }
    if (needsReason && !reason.trim()) {
      onError('Укажите причину');
      return;
    }
    const body: Record<string, unknown> = {
      ...catalogLineToPayload(addLine),
    };
    if (needsReason) body.reason = reason.trim();

    const ok = await api(`/api/orders/${order.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (ok) {
      setAdding(false);
      setAddLine(emptyCatalogLine());
    }
  }

  return (
    <section className="card">
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Позиции</h2>
        {editable ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={pending}
            onClick={() => setAdding(true)}
          >
            Добавить
          </button>
        ) : null}
      </div>

      {needsReason && editable ? (
        <label className="field" style={{ marginBottom: 12 }}>
          Причина изменения
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="обязательно для точки"
          />
        </label>
      ) : null}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Категория</th>
              <th>Наименование</th>
              <th>Тех. параметры</th>
              <th>Кол-во</th>
              <th>Цена</th>
              <th>Сумма</th>
              {editable ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => {
              const isEdit = editingId === item.id;
              return (
                <tr key={item.id}>
                  <td>{item.categoryName ?? '—'}</td>
                  <td>
                    {isEdit && item.isManual ? (
                      <input
                        className="input"
                        value={draft.name}
                        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                        required
                      />
                    ) : (
                      item.name || '—'
                    )}
                  </td>
                  <td>
                    {isEdit ? (
                      <input
                        className="input"
                        value={draft.techParams}
                        onChange={(e) => setDraft((d) => ({ ...d, techParams: e.target.value }))}
                      />
                    ) : (
                      item.techParams || '—'
                    )}
                  </td>
                  <td className="mono">
                    {isEdit ? (
                      <input
                        className="input"
                        type="number"
                        min={1}
                        step={1}
                        value={draft.quantity}
                        onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
                        style={{ width: 88 }}
                      />
                    ) : (
                      item.quantity
                    )}
                  </td>
                  <td className="mono">
                    {isEdit && canPrice ? (
                      <input
                        className="input"
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.unitPrice}
                        onChange={(e) => setDraft((d) => ({ ...d, unitPrice: e.target.value }))}
                        style={{ width: 100 }}
                      />
                    ) : (
                      formatMoney2(item.unitPrice)
                    )}
                  </td>
                  <td className="mono">
                    {isEdit
                      ? previewLine(
                          draft.quantity,
                          canPrice ? draft.unitPrice : formatMoney2(item.unitPrice),
                        )
                      : formatMoney2(item.lineTotal)}
                  </td>
                  {editable ? (
                    <td>
                      <div className="toolbar" style={{ margin: 0, gap: 4 }}>
                        {isEdit ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={pending}
                              onClick={() => void saveEdit(item)}
                            >
                              Сохранить
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              disabled={pending}
                              onClick={() => setEditingId(null)}
                            >
                              Отмена
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              disabled={pending}
                              onClick={() => startEdit(item)}
                            >
                              Изменить
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger"
                              disabled={pending || order.items.length <= 1}
                              onClick={() => void removeItem(item)}
                            >
                              Удалить
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {adding ? (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="modal stack">
            <h2>Новая позиция</h2>
            <CatalogOrderLineFields value={addLine} disabled={pending} onChange={setAddLine} />
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-cta"
                disabled={pending}
                onClick={() => void addItem()}
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
