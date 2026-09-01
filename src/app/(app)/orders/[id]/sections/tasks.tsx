'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { priorityLabel, statusLabel } from '@/lib/tasks/labels';

type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeName: string;
  dueAt: string | null;
};

type Props = {
  orderId: string;
  orderNumber: string;
};

export function TasksSection({ orderId, orderNumber }: Props) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const params = new URLSearchParams({ filter: 'all', orderId });
        const res = await fetch(`/api/tasks?${params.toString()}`, {
          credentials: 'same-origin',
          signal,
        });
        const data = (await res.json()) as { tasks?: TaskRow[]; message?: string };
        if (signal?.aborted) return;
        if (!res.ok) {
          setError(data.message || 'Не удалось загрузить задачи');
          setTasks([]);
          setLoading(false);
          return;
        }
        setError(null);
        setTasks(data.tasks ?? []);
        setLoading(false);
      } catch {
        if (signal?.aborted) return;
        setError('Не удалось загрузить задачи');
        setLoading(false);
      }
    },
    [orderId],
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

  return (
    <section className="card stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <h2>Задачи по заказу</h2>
        <Link
          href={`/tasks/new?orderId=${encodeURIComponent(orderId)}`}
          className="btn btn-secondary"
        >
          Создать задачу
        </Link>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        Показаны только ваши задачи и поставленные вами для {orderNumber}.
      </p>

      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted">Загрузка…</p> : null}
      {!loading && tasks.length === 0 ? <p className="muted">Задач по этому заказу нет</p> : null}

      {!loading && tasks.length > 0 ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Задача</th>
                <th>Статус</th>
                <th>Приоритет</th>
                <th>Исполнитель</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/tasks/${t.id}`} className="linkish">
                      {t.title}
                    </Link>
                  </td>
                  <td>{statusLabel(t.status)}</td>
                  <td>{priorityLabel(t.priority)}</td>
                  <td>{t.assigneeName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
