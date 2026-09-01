'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Role } from '@/lib/auth/permissions';

type ClientRow = {
  id: string;
  name: string;
  userId: string | null;
  notes: string | null;
  isPhotoCenter: boolean;
  linkedUserEmail: string | null;
};

type Props = {
  role: Role;
  canCreate: boolean;
};

export function ClientsList({ role, canCreate }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';

  const [qDraft, setQDraft] = useState(q);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [createBusy, setCreateBusy] = useState(false);

  const replaceQ = useCallback(
    (nextQ: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextQ.trim()) params.set('q', nextQ.trim());
      else params.delete('q');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (qDraft === q) return;
      replaceQ(qDraft);
    }, 300);
    return () => window.clearTimeout(t);
  }, [qDraft, q, replaceQ]);

  const loadClients = useCallback(
    async (signal?: AbortSignal) => {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      try {
        const res = await fetch(`/api/clients?${params.toString()}`, {
          credentials: 'same-origin',
          signal,
        });
        const data = (await res.json()) as {
          clients?: ClientRow[];
          message?: string;
        };
        if (signal?.aborted) return;
        if (!res.ok) {
          setError(data.message || (res.status === 403 ? 'Недостаточно прав' : 'Ошибка загрузки'));
          setClients([]);
          setLoading(false);
          return;
        }
        setError(null);
        setClients(data.clients ?? []);
        setLoading(false);
      } catch {
        if (signal?.aborted) return;
        setError('Ошибка загрузки клиентов');
        setClients([]);
        setLoading(false);
      }
    },
    [q],
  );

  useEffect(() => {
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void loadClients(ac.signal);
    }, 0);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [loadClients]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreateBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim(),
          notes: createNotes.trim() || null,
        }),
      });
      const data = (await res.json()) as { client?: ClientRow; message?: string };
      if (!res.ok) {
        setError(data.message || 'Не удалось создать клиента');
        return;
      }
      setShowCreate(false);
      setCreateName('');
      setCreateNotes('');
      if (data.client) {
        router.push(`/clients/${data.client.id}`);
      } else {
        void loadClients();
      }
    } catch {
      setError('Не удалось создать клиента');
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Клиенты</h1>
          <p className="lede">Справочник клиентов и точек сети</p>
        </div>
        {canCreate ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? 'Отмена' : 'Новый клиент'}
          </button>
        ) : null}
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {showCreate && canCreate ? (
        <form className="card stack" onSubmit={onCreate}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Внешний клиент</h2>
          <label className="field">
            Наименование
            <input
              className="input"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              required
              maxLength={200}
            />
          </label>
          <label className="field">
            Контакты / примечания
            <textarea
              className="input"
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={createBusy}>
            {createBusy ? 'Сохранение…' : 'Создать'}
          </button>
        </form>
      ) : null}

      <div className="card stack">
        <label className="field">
          Поиск
          <input
            className="input"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="Имя, контакты, email точки…"
          />
        </label>

        {loading ? <p className="muted">Загрузка…</p> : null}

        {!loading && clients.length === 0 ? <p className="muted">Клиенты не найдены</p> : null}

        {!loading && clients.length > 0 ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Наименование</th>
                  <th>Тип</th>
                  <th>Контакты</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/clients/${c.id}`} className="linkish">
                        {c.name}
                      </Link>
                    </td>
                    <td>{c.isPhotoCenter ? 'Точка сети' : 'Внешний'}</td>
                    <td className="muted">
                      {c.isPhotoCenter && c.linkedUserEmail ? c.linkedUserEmail : c.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <p className="muted" style={{ fontSize: 13 }}>
        Роль: {role}. Точки сети создаются при добавлении пользователя photo_center (§19.3).
      </p>
    </div>
  );
}
