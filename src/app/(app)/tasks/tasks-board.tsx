'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { priorityLabel, statusLabel, taskFilterLabel } from '@/lib/tasks/labels';
import type { TaskFilter } from '@/lib/tasks/schemas';

type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeName: string;
  creatorName: string;
  orderNumber: string | null;
  dueAt: string | null;
  updatedAt: string;
};

const FILTERS: TaskFilter[] = ['all', 'my', 'created'];

export function TasksBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = (
    searchParams.get('filter') === 'my' || searchParams.get('filter') === 'created'
      ? searchParams.get('filter')
      : 'all'
  ) as TaskFilter;

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setFilter = useCallback(
    (next: TaskFilter) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'all') params.delete('filter');
      else params.set('filter', next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const loadTasks = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const params = new URLSearchParams();
        if (filter !== 'all') params.set('filter', filter);
        const res = await fetch(`/api/tasks?${params.toString()}`, {
          credentials: 'same-origin',
          signal,
        });
        const data = (await res.json()) as { tasks?: TaskRow[]; message?: string };
        if (signal?.aborted) return;
        if (!res.ok) {
          setError(data.message || 'Ошибка загрузки задач');
          setTasks([]);
          setLoading(false);
          return;
        }
        setError(null);
        setTasks(data.tasks ?? []);
        setLoading(false);
      } catch {
        if (signal?.aborted) return;
        setError('Ошибка загрузки задач');
        setTasks([]);
        setLoading(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void loadTasks(ac.signal);
    }, 0);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [loadTasks]);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Задачи</h1>
          <p className="lede">Мои и поставленные мной — не общий список компании (§12.3)</p>
        </div>
        <Link href="/tasks/new" className="btn btn-primary">
          Новая задача
        </Link>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="toolbar">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={() => setFilter(f)}
          >
            {taskFilterLabel(f)}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? <p className="muted">Загрузка…</p> : null}
        {!loading && tasks.length === 0 ? <p className="muted">Задач нет</p> : null}
        {!loading && tasks.length > 0 ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Задача</th>
                  <th>Статус</th>
                  <th>Приоритет</th>
                  <th>Исполнитель</th>
                  <th>Заказ</th>
                  <th>Срок</th>
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
                    <td className="mono">{t.orderNumber ?? '—'}</td>
                    <td className="mono">
                      {t.dueAt ? new Date(t.dueAt).toLocaleDateString('ru-RU') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
