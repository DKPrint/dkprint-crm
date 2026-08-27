'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Role } from '@/lib/auth/permissions';
import { formatMoney2, lineTotal } from '@/lib/money';

type Category = { id: string; name: string };
type Client = { id: string; name: string };

type Line = {
  key: string;
  categoryId: string;
  quantity: string;
  unitPrice: string;
  techParams: string;
};

type Props = {
  role: Role;
  categories: Category[];
  clients: Client[];
  fixedClientId: string | null;
};

function emptyLine(categories: Category[]): Line {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    categoryId: categories[0]?.id ?? '',
    quantity: '1',
    unitPrice: '0',
    techParams: '',
  };
}

function linePreview(qty: string, price: string): string {
  const q = Number(qty);
  if (!Number.isInteger(q) || q <= 0) return '—';
  try {
    return formatMoney2(lineTotal(q, price || 0));
  } catch {
    return '—';
  }
}

export function CreateOrderForm({ role, categories, clients, fixedClientId }: Props) {
  const router = useRouter();
  const needsClientSelect = role === 'admin' || role === 'production';

  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [courierNote, setCourierNote] = useState('');
  const [items, setItems] = useState<Line[]>(() => [emptyLine(categories)]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function updateItem(key: string, patch: Partial<Line>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyLine(categories)]);
  }

  function removeItem(key: string) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it.key !== key)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (categories.length === 0) {
      setError('Нет активных категорий');
      return;
    }
    if (needsClientSelect && !clientId) {
      setError('Выберите клиента');
      return;
    }
    if (role === 'photo_center' && !fixedClientId) {
      setError('У пользователя не привязан клиент');
      return;
    }

    const payloadItems = items.map((it) => {
      const quantity = Number.parseInt(it.quantity, 10);
      const unitPrice = Number(it.unitPrice);
      return {
        categoryId: it.categoryId,
        quantity,
        unitPrice,
        techParams: it.techParams.trim() ? it.techParams.trim() : null,
      };
    });

    for (const it of payloadItems) {
      if (!it.categoryId || !Number.isInteger(it.quantity) || it.quantity <= 0) {
        setError('Проверьте количество и категорию в позициях');
        return;
      }
      if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0) {
        setError('Цена должна быть числом ≥ 0');
        return;
      }
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
                disabled={items.length <= 1}
                onClick={() => removeItem(it.key)}
              >
                Удалить
              </button>
            </div>
            <label className="field">
              Категория
              <select
                className="input"
                value={it.categoryId}
                onChange={(e) => updateItem(it.key, { categoryId: e.target.value })}
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <label className="field">
                Кол-во
                <input
                  className="input"
                  type="number"
                  min={1}
                  step={1}
                  value={it.quantity}
                  onChange={(e) => updateItem(it.key, { quantity: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                Цена
                <input
                  className="input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={it.unitPrice}
                  onChange={(e) => updateItem(it.key, { unitPrice: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                Сумма
                <input
                  className="input mono"
                  readOnly
                  value={linePreview(it.quantity, it.unitPrice)}
                  tabIndex={-1}
                />
              </label>
            </div>
            <label className="field">
              Тех. параметры
              <textarea
                className="input"
                value={it.techParams}
                onChange={(e) => updateItem(it.key, { techParams: e.target.value })}
                rows={2}
              />
            </label>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" onClick={addItem}>
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
