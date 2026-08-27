'use client';

import { useEffect, useState } from 'react';
import { statusLabel } from '@/lib/orders/status-labels';

type EventRow = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedByUserId: string;
  reason: string | null;
  isAdminJump: boolean;
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

export function StatusEvents({ orderId, refreshKey }: Props) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/orders/${orderId}/status-events`, {
          credentials: 'same-origin',
          signal: ac.signal,
        });
        const data = (await res.json()) as {
          events?: EventRow[];
          message?: string;
        };
        if (ac.signal.aborted) return;
        if (!res.ok) {
          setError(data.message || 'Ошибка загрузки истории статусов');
          setEvents([]);
        } else {
          setError(null);
          setEvents(data.events ?? []);
        }
      } catch {
        if (!ac.signal.aborted) setError('Ошибка загрузки истории статусов');
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [orderId, refreshKey]);

  return (
    <section className="card">
      <h2>История статусов</h2>
      {loading ? <p className="muted">Загрузка…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {!loading && !error && events.length === 0 ? <p className="muted">Пока нет событий</p> : null}
      {events.length > 0 ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Из</th>
                <th>В</th>
                <th>Кто</th>
                <th>Причина</th>
                <th>Jump</th>
                <th>Время</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{e.fromStatus ? statusLabel(e.fromStatus) : '—'}</td>
                  <td>{statusLabel(e.toStatus)}</td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {e.changedByUserId.slice(0, 8)}…
                  </td>
                  <td>{e.reason || '—'}</td>
                  <td>{e.isAdminJump ? 'да' : '—'}</td>
                  <td className="mono">{formatTs(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
