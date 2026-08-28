'use client';

import { useEffect, useState } from 'react';

type LogRow = {
  id: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  userDisplayName: string | null;
  createdAt: string;
};

type Props = { orderId: string; refreshKey: number };

const ACTION_LABELS: Record<string, string> = {
  add_item: 'Добавлена позиция',
  patch_item: 'Изменена позиция',
  patch_price: 'Изменена цена',
  delete_item: 'Удалена позиция',
  update_order: 'Изменён заказ',
};

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU');
  } catch {
    return iso;
  }
}

function tryParseJson(raw: string | null): unknown {
  if (raw == null || raw === '') return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function formatItemFields(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof o.name === 'string' && o.name.trim()) parts.push(`«${o.name.trim()}»`);
  if (typeof o.quantity === 'number') parts.push(`кол-во ${o.quantity}`);
  else if (typeof o.quantity === 'string' && o.quantity.trim()) parts.push(`кол-во ${o.quantity}`);
  if (typeof o.unitPrice === 'string' || typeof o.unitPrice === 'number') {
    parts.push(`цена ${o.unitPrice}`);
  }
  if (typeof o.lineTotal === 'string' || typeof o.lineTotal === 'number') {
    parts.push(`сумма ${o.lineTotal}`);
  }
  if (typeof o.techParams === 'string' && o.techParams.trim()) {
    parts.push(`тех: ${o.techParams.trim()}`);
  } else if (o.techParams === null) {
    parts.push('тех: —');
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

function formatAuditValue(action: string, raw: string | null, side: 'old' | 'new'): string {
  if (raw == null || raw === '') return '—';

  if (action === 'patch_price') {
    return side === 'old' ? `цена ${raw}` : `цена ${raw}`;
  }

  if (action === 'add_item' || action === 'patch_item') {
    const parsed = tryParseJson(raw);
    const human = formatItemFields(parsed);
    if (human) return human;
  }

  if (action === 'delete_item') {
    return `позиция ${raw}`;
  }

  if (action === 'update_order') {
    return raw;
  }

  const parsed = tryParseJson(raw);
  const human = formatItemFields(parsed);
  if (human) return human;

  return raw;
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function AuditLogs({ orderId, refreshKey }: Props) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/orders/${orderId}/audit-logs`, {
          credentials: 'same-origin',
          signal: ac.signal,
        });
        const data = (await res.json()) as {
          logs?: LogRow[];
          message?: string;
        };
        if (ac.signal.aborted) return;
        if (!res.ok) {
          setError(data.message || 'Ошибка загрузки аудита');
          setLogs([]);
        } else {
          setError(null);
          setLogs(data.logs ?? []);
        }
      } catch {
        if (!ac.signal.aborted) setError('Ошибка загрузки аудита');
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [orderId, refreshKey]);

  return (
    <section className="card">
      <h2>Аудит</h2>
      {loading ? <p className="muted">Загрузка…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {!loading && !error && logs.length === 0 ? <p className="muted">Пока нет записей</p> : null}
      {logs.length > 0 ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Действие</th>
                <th>Было</th>
                <th>Стало</th>
                <th>Кто</th>
                <th>Причина</th>
                <th>Время</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{actionLabel(l.action)}</td>
                  <td style={{ fontSize: 13 }}>{formatAuditValue(l.action, l.oldValue, 'old')}</td>
                  <td style={{ fontSize: 13 }}>{formatAuditValue(l.action, l.newValue, 'new')}</td>
                  <td>{l.userDisplayName || '—'}</td>
                  <td>{l.reason || '—'}</td>
                  <td className="mono">{formatTs(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
