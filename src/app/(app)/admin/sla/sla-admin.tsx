'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminSubNav } from '@/components/admin-subnav';
import { statusLabel } from '@/lib/orders/status-labels';

type SlaGoal = {
  id: string;
  fromStatus: string;
  toStatus: string;
  targetHours: number;
  isActive: boolean;
  isSystemDefault: boolean;
};

const STATUS_OPTIONS = [
  'new',
  'accepted',
  'at_designer',
  'in_production',
  'ready_for_pickup',
  'with_courier',
  'delivered',
] as const;

function apiError(data: { message?: string; error?: string }, fallback: string): string {
  return data.message || data.error || fallback;
}

export function SlaAdmin() {
  const [goals, setGoals] = useState<SlaGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [fromStatus, setFromStatus] = useState<string>('new');
  const [toStatus, setToStatus] = useState<string>('delivered');
  const [targetHours, setTargetHours] = useState('72');
  const [createBusy, setCreateBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sla-goals', { credentials: 'same-origin' });
      const data = (await res.json()) as { goals?: SlaGoal[]; message?: string; error?: string };
      if (!res.ok) {
        setError(apiError(data, 'Ошибка загрузки'));
        setGoals([]);
        return;
      }
      setError(null);
      setGoals(data.goals ?? []);
    } catch {
      setError('Ошибка загрузки SLA');
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const hours = Number.parseInt(targetHours, 10);
    if (!Number.isFinite(hours) || hours < 1) return;
    setCreateBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/sla-goals', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromStatus,
          toStatus,
          targetHours: hours,
          isActive: true,
          isSystemDefault: goals.length === 0,
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(apiError(data, 'Не удалось создать цель'));
        return;
      }
      setTargetHours('72');
      await load();
    } catch {
      setError('Не удалось создать цель');
    } finally {
      setCreateBusy(false);
    }
  }

  async function patchGoal(id: string, patch: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sla-goals/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(apiError(data, 'Не удалось сохранить'));
        return;
      }
      await load();
    } catch {
      setError('Не удалось сохранить');
    } finally {
      setBusyId(null);
    }
  }

  async function removeGoal(id: string, isSystemDefault: boolean) {
    if (isSystemDefault) {
      setError('Системную цель по умолчанию нельзя удалить');
      return;
    }
    if (!window.confirm('Удалить цель SLA?')) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sla-goals/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(apiError(data, 'Не удалось удалить'));
        return;
      }
      await load();
    } catch {
      setError('Не удалось удалить');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="stack">
      <AdminSubNav current="/admin/sla" />

      <div className="page-head">
        <div>
          <h1>SLA</h1>
          <p className="lede">
            Цели по парам статусов. Системная по умолчанию: new → delivered, 72ч (§11).
          </p>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <form className="card stack" onSubmit={onCreate}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Новая цель</h2>
        <div className="toolbar">
          <label className="field">
            От статуса
            <select
              className="input"
              value={fromStatus}
              onChange={(e) => setFromStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            До статуса
            <select
              className="input"
              value={toStatus}
              onChange={(e) => setToStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Часов
            <input
              className="input"
              type="number"
              min={1}
              max={9999}
              value={targetHours}
              onChange={(e) => setTargetHours(e.target.value)}
              required
            />
          </label>
        </div>
        <button type="submit" className="btn btn-primary" disabled={createBusy}>
          {createBusy ? 'Сохранение…' : 'Добавить'}
        </button>
      </form>

      <div className="card stack">
        {loading ? <p className="muted">Загрузка…</p> : null}
        {!loading && goals.length === 0 ? <p className="muted">Цели не заданы</p> : null}

        {!loading && goals.length > 0 ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Маршрут</th>
                  <th>Часов</th>
                  <th>Активна</th>
                  <th>По умолчанию</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {goals.map((g) => (
                  <tr key={g.id}>
                    <td>
                      {statusLabel(g.fromStatus)} → {statusLabel(g.toStatus)}
                    </td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={9999}
                        defaultValue={g.targetHours}
                        disabled={busyId === g.id}
                        onBlur={(e) => {
                          const next = Number.parseInt(e.target.value, 10);
                          if (Number.isFinite(next) && next !== g.targetHours && next > 0) {
                            void patchGoal(g.id, { targetHours: next });
                          }
                        }}
                        style={{ width: 88 }}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={g.isActive}
                        disabled={busyId === g.id}
                        onChange={(e) => void patchGoal(g.id, { isActive: e.target.checked })}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={g.isSystemDefault}
                        disabled={busyId === g.id || g.isSystemDefault}
                        onChange={(e) => {
                          if (e.target.checked) void patchGoal(g.id, { isSystemDefault: true });
                        }}
                      />
                    </td>
                    <td>
                      {!g.isSystemDefault ? (
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={busyId === g.id}
                          onClick={() => void removeGoal(g.id, g.isSystemDefault)}
                        >
                          Удалить
                        </button>
                      ) : (
                        <span className="muted">—</span>
                      )}
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
