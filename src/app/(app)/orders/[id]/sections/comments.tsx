'use client';

import { useEffect, useState } from 'react';
import type { Role } from '@/lib/auth/permissions';
import { canWriteComment } from '@/lib/comments/permissions';
import { apiErrorMessage } from '../order-card';

export type OrderComment = {
  id: string;
  orderId: string;
  userId: string;
  authorName: string;
  body: string;
  isProblematicLayout: boolean;
  createdAt: string;
};

type Props = {
  orderId: string;
  role: Role;
  onError: (msg: string | null) => void;
};

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU');
  } catch {
    return iso;
  }
}

export function CommentsSection({ orderId, role, onError }: Props) {
  const canWrite = canWriteComment({ id: '', role, clientId: null });
  const [comments, setComments] = useState<OrderComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [isProblematicLayout, setIsProblematicLayout] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/orders/${orderId}/comments`, {
          credentials: 'same-origin',
          signal: ac.signal,
        });
        const data = (await res.json()) as {
          comments?: OrderComment[];
          error?: string;
          message?: string;
        };
        if (ac.signal.aborted) return;
        if (!res.ok) {
          setLoadError(apiErrorMessage(data, 'Ошибка загрузки комментариев'));
          setComments([]);
        } else {
          setLoadError(null);
          setComments(data.comments ?? []);
        }
      } catch {
        if (!ac.signal.aborted) setLoadError('Ошибка загрузки комментариев');
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [orderId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) {
      onError('Укажите текст комментария');
      return;
    }

    onError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/comments`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text, isProblematicLayout }),
      });
      const data = (await res.json()) as {
        comment?: OrderComment;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        onError(apiErrorMessage(data, 'Не удалось сохранить комментарий'));
        return;
      }
      if (data.comment) {
        setComments((prev) => [...prev, data.comment!]);
      }
      setBody('');
      setIsProblematicLayout(false);
    } catch {
      onError('Не удалось сохранить комментарий');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card">
      <h2>Комментарии</h2>

      {loading ? <p className="muted">Загрузка…</p> : null}
      {loadError ? <p className="form-error">{loadError}</p> : null}

      {!loading && !loadError && comments.length === 0 ? (
        <p className="muted">Пока нет комментариев</p>
      ) : null}

      {comments.length > 0 ? (
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment-item">
              <div className="comment-head">
                <strong>{c.authorName}</strong>
                <span className="muted">{formatTs(c.createdAt)}</span>
              </div>
              <p className="comment-body">{c.body}</p>
              {c.isProblematicLayout ? (
                <span className="badge st-cancelled">Проблемный макет</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {canWrite ? (
        <form className="stack" style={{ marginTop: 16 }} onSubmit={(e) => void submit(e)}>
          <label className="field">
            Новый комментарий
            <textarea
              className="input"
              rows={3}
              value={body}
              disabled={pending}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Текст комментария"
            />
          </label>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={isProblematicLayout}
              disabled={pending}
              onChange={(e) => setIsProblematicLayout(e.target.checked)}
            />
            <span>Проблемный макет</span>
          </label>
          <div>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? 'Сохранение…' : 'Добавить'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
