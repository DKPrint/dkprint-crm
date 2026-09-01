'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AdminSubNav } from '@/components/admin-subnav';
import type { Role } from '@/lib/auth/permissions';

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  clientName: string | null;
  isActive: boolean;
};

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Админ',
  photo_center: 'Фотоцентр',
  production: 'Производство',
  designer: 'Дизайнер',
  courier: 'Курьер',
};

export function UsersList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';

  const [qDraft, setQDraft] = useState(q);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const loadUsers = useCallback(
    async (signal?: AbortSignal) => {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      try {
        const res = await fetch(`/api/admin/users?${params.toString()}`, {
          credentials: 'same-origin',
          signal,
        });
        const data = (await res.json()) as { users?: UserRow[]; message?: string };
        if (signal?.aborted) return;
        if (!res.ok) {
          setError(data.message || 'Ошибка загрузки');
          setUsers([]);
          setLoading(false);
          return;
        }
        setError(null);
        setUsers(data.users ?? []);
        setLoading(false);
      } catch {
        if (signal?.aborted) return;
        setError('Ошибка загрузки пользователей');
        setUsers([]);
        setLoading(false);
      }
    },
    [q],
  );

  useEffect(() => {
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void loadUsers(ac.signal);
    }, 0);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [loadUsers]);

  return (
    <div className="stack">
      <AdminSubNav current="/admin/users" />

      <div className="page-head">
        <div>
          <h1>Пользователи</h1>
          <p className="lede">Учётные записи, роли и флаги прав (§13)</p>
        </div>
        <Link href="/admin/users/new" className="btn btn-primary">
          Новый пользователь
        </Link>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="card stack">
        <label className="field">
          Поиск
          <input
            className="input"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="Email, имя, точка…"
          />
        </label>

        {loading ? <p className="muted">Загрузка…</p> : null}

        {!loading && users.length === 0 ? <p className="muted">Пользователи не найдены</p> : null}

        {!loading && users.length > 0 ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Email</th>
                  <th>Роль</th>
                  <th>Точка</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={u.isActive ? undefined : 'muted'}>
                    <td>
                      <Link href={`/admin/users/${u.id}`} className="linkish">
                        {u.displayName}
                      </Link>
                    </td>
                    <td>{u.email}</td>
                    <td>{ROLE_LABELS[u.role]}</td>
                    <td>{u.clientName ?? '—'}</td>
                    <td>{u.isActive ? 'Активен' : 'Отключён'}</td>
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
