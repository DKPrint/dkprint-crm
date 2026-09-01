'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { SectionBack } from '@/components/section-back';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/lib/tasks/schemas';
import { priorityLabel, statusLabel } from '@/lib/tasks/labels';

type Task = {
  id: string;
  title: string;
  description: string | null;
  orderId: string | null;
  orderNumber: string | null;
  assigneeUserId: string;
  assigneeName: string;
  creatorName: string;
  priority: string;
  status: string;
  dueAt: string | null;
};

type Assignee = { id: string; displayName: string; role: string };

type Props = { taskId: string };

export function TaskDetail({ taskId }: Props) {
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [taskRes, assigneeRes] = await Promise.all([
      fetch(`/api/tasks/${encodeURIComponent(taskId)}`, { credentials: 'same-origin' }),
      fetch('/api/tasks/assignees', { credentials: 'same-origin' }),
    ]);
    const taskData = (await taskRes.json()) as { task?: Task; message?: string };
    const assigneeData = (await assigneeRes.json()) as { users?: Assignee[] };
    if (!taskRes.ok) {
      setError(taskData.message || 'Задача не найдена');
      setLoading(false);
      return;
    }
    setTask(taskData.task ?? null);
    setAssignees(assigneeData.users ?? []);
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load().catch(() => setError('Ошибка загрузки'));
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!task) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: task.title,
          description: task.description,
          assigneeUserId: task.assigneeUserId,
          priority: task.priority,
          status: task.status,
          dueAt: task.dueAt,
        }),
      });
      const data = (await res.json()) as { task?: Task; message?: string };
      if (!res.ok) {
        setError(data.message || 'Не удалось сохранить');
        return;
      }
      setTask(data.task ?? task);
    } catch {
      setError('Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('Удалить задачу?')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(data.message || 'Не удалось удалить');
        return;
      }
      router.push('/tasks');
    } catch {
      setError('Не удалось удалить');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Загрузка…</p>;
  if (!task) {
    return (
      <div className="stack">
        <SectionBack href="/tasks" label="К списку задач" />
        <p className="form-error">{error || 'Задача не найдена'}</p>
      </div>
    );
  }

  const dueLocal = task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : '';

  return (
    <div className="stack">
      <SectionBack href="/tasks" label="К списку задач" />

      {error ? <p className="form-error">{error}</p> : null}

      <form className="card stack" onSubmit={save}>
        <div className="page-head">
          <h1>Задача</h1>
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy}
            onClick={() => void remove()}
          >
            Удалить
          </button>
        </div>

        <p className="muted">
          Поставил: {task.creatorName}
          {task.orderNumber ? (
            <>
              {' '}
              · Заказ{' '}
              {task.orderId ? (
                <Link href={`/orders/${task.orderId}`} className="linkish mono">
                  {task.orderNumber}
                </Link>
              ) : (
                task.orderNumber
              )}
            </>
          ) : null}
        </p>

        <label className="field">
          Заголовок
          <input
            className="input"
            value={task.title}
            onChange={(e) => setTask({ ...task, title: e.target.value })}
            required
          />
        </label>

        <label className="field">
          Описание
          <textarea
            className="input"
            value={task.description ?? ''}
            onChange={(e) => setTask({ ...task, description: e.target.value || null })}
            rows={4}
          />
        </label>

        <label className="field">
          Исполнитель
          <select
            className="input"
            value={task.assigneeUserId}
            onChange={(e) => setTask({ ...task, assigneeUserId: e.target.value })}
          >
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName} ({u.role})
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="field">
            Приоритет
            <select
              className="input"
              value={task.priority}
              onChange={(e) => setTask({ ...task, priority: e.target.value })}
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {priorityLabel(p)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Статус
            <select
              className="input"
              value={task.status}
              onChange={(e) => setTask({ ...task, status: e.target.value })}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          Срок
          <input
            className="input"
            type="datetime-local"
            value={dueLocal}
            onChange={(e) =>
              setTask({
                ...task,
                dueAt: e.target.value ? new Date(e.target.value).toISOString() : null,
              })
            }
          />
        </label>

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Сохранение…' : 'Сохранить'}
        </button>
      </form>
    </div>
  );
}
