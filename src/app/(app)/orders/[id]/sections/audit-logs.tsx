'use client';

import { useEffect, useState } from 'react';

type LogRow = {
  id: string;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
};

type Props = { orderId: string; refreshKey: number };

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU');
  } catch {
    return iso;
  }
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
                <th>Поле</th>
                <th>Было</th>
                <th>Стало</th>
                <th>Причина</th>
                <th>Время</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{l.action}</td>
                  <td>{l.fieldName || '—'}</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {l.oldValue ?? '—'}
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {l.newValue ?? '—'}
                  </td>
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
