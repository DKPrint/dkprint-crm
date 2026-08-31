'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Role } from '@/lib/auth/permissions';
import {
  CatalogOrderLineFields,
  catalogLineToPayload,
  emptyCatalogLine,
  validateCatalogLine,
  type CatalogOrderLineState,
} from '@/components/catalog-order-line';

type Client = { id: string; name: string };

type Line = CatalogOrderLineState & { key: string };

type Props = {
  role: Role;
  clients: Client[];
  fixedClientId: string | null;
};

function newLine(): Line {
  return { key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ...emptyCatalogLine() };
}

export function CreateOrderForm({ role, clients, fixedClientId }: Props) {
  const router = useRouter();
  const needsClientSelect = role === 'admin' || role === 'production';

  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [courierNote, setCourierNote] = useState('');
  const [items, setItems] = useState<Line[]>(() => [newLine()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function updateItem(key: string, next: CatalogOrderLineState) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...next } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, newLine()]);
  }

  function removeItem(key: string) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it.key !== key)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (needsClientSelect && !clientId) {
      setError('Выберите клиента');
      return;
    }
    if (role === 'photo_center' && !fixedClientId) {
      setError('У пользователя не привязан клиент');
      return;
    }

    const payloadItems: Record<string, unknown>[] = [];
    for (const it of items) {
      const err = validateCatalogLine(it);
      if (err) {
        setError(err);
        return;
      }
      payloadItems.push(catalogLineToPayload(it));
    }

    const body: Record<string, unknown> = {
      items: payloadItems,
      courierNote: courierNote.trim() ? courierNote.trim() : null,
    };
    if (needsClientSelect) body.clientId = clientId;

    setPending(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        order?: { id: string };
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        if (res.status === 403) {
          setError(data.message || 'Недостаточно прав');
        } else if (res.status === 400) {
          setError(data.message || 'Ошибка валидации');
        } else {
          setError(data.message || 'Не удалось создать заказ');
        }
        return;
      }

      if (!data.order?.id) {
        setError('Пустой ответ сервера');
        return;
      }
      router.push(`/orders/${data.order.id}`);
      router.refresh();
    } catch {
      setError('Не удалось создать заказ');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit} style={{ maxWidth: 720 }}>
      {needsClientSelect ? (
        <label className="field">
          Клиент
          <select
            className="input"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
          >
            {clients.length === 0 ? <option value="">Нет клиентов</option> : null}
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="field">
        Для курьера
        <span className="muted">необязательно</span>
        <textarea
          className="input"
          value={courierNote}
          onChange={(e) => setCourierNote(e.target.value)}
          rows={2}
        />
      </label>

      <div className="stack">
        {items.map((it, idx) => (
          <div key={it.key} className="item-card stack">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <strong>Позиция {idx + 1}</strong>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={items.length <= 1 || pending}
                onClick={() => removeItem(it.key)}
              >
                Удалить
              </button>
            </div>
            <CatalogOrderLineFields
              value={it}
              disabled={pending}
              onChange={(next) => updateItem(it.key, next)}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" disabled={pending} onClick={addItem}>
          Добавить позицию
        </button>
        <button type="submit" className="btn btn-cta" disabled={pending}>
          {pending ? 'Создание…' : 'Создать заказ'}
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}
