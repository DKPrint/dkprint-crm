'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/lib/tasks/schemas';
import { priorityLabel, statusLabel } from '@/lib/tasks/labels';

type Assignee = { id: string; displayName: string; role: string };

type Props = {
  currentUserId: string;
  orderId?: string | null;
  orderNumber?: string | null;
  cancelHref?: string;
};

export function TaskForm({
  currentUserId,
  orderId = null,
  orderNumber = null,
  cancelHref = '/tasks',
}: Props) {
  const router = useRouter();
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeUserId, setAssigneeUserId] = useState(currentUserId);
  const [priority, setPriority] = useState<(typeof TASK_PRIORITIES)[number]>('normal');
  const [status, setStatus] = useState<(typeof TASK_STATUSES)[number]>('open');
  const [dueAt, setDueAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch('/api/tasks/assignees', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data: { users?: Assignee[] }) => setAssignees(data.users ?? []))
      .catch(() => setError('Не удалось загрузить исполнителей'));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !assigneeUserId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          orderId: orderId || null,
          assigneeUserId,
          priority,
          status,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        }),
      });
      const data = (await res.json()) as { task?: { id: string }; message?: string };
      if (!res.ok) {
        setError(data.message || 'Не удалось создать задачу');
        return;
      }
      if (data.task?.id) router.push(`/tasks/${data.task.id}`);
      else router.push('/tasks');
    } catch {
      setError('Не удалось создать задачу');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={onSubmit}>
      {orderId ? (
        <p className="muted">
          Заказ: <span className="mono">{orderNumber ?? orderId}</span>
        </p>
      ) : null}

      <label className="field">
        Заголовок
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </label>

      <label className="field">
        Описание
        <textarea
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
      </label>

      <label className="field">
        Исполнитель
        <select
          className="input"
          value={assigneeUserId}
          onChange={(e) => setAssigneeUserId(e.target.value)}
          required
        >
          {assignees.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName} ({u.role})
            </option>
          ))}
        </select>
      </label>

      <div className="form-grid-2">
        <label className="field">
          Приоритет
          <select
            className="input"
            value={priority}
            onChange={(e) => setPriority(e.target.value as (typeof TASK_PRIORITIES)[number])}
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
            value={status}
            onChange={(e) => setStatus(e.target.value as (typeof TASK_STATUSES)[number])}
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
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="toolbar" style={{ marginBottom: 0 }}>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Сохранение…' : 'Создать'}
        </button>
        <Link href={cancelHref} className="btn btn-ghost">
          Отмена
        </Link>
      </div>
    </form>
  );
}
