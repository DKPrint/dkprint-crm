'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Role } from '@/lib/auth/permissions';
import { formatMoney2 } from '@/lib/money';
import { ORDERS_LIST_POLL_MS } from '@/lib/orders/constants';
import { ORDER_STATUSES, statusBadgeClass, statusLabel } from '@/lib/orders/status-labels';

type OrderRow = {
  id: string;
  orderNumber: string;
  clientName: string | null;
  status: string;
  orderDate: string;
  totalAmount: number;
  ttnChecked: boolean;
  isUrgent: boolean;
  deletedAt: string | null;
};

const CAN_CREATE = new Set<Role>(['admin', 'production', 'photo_center']);
const CAN_TTN = new Set<Role>(['admin', 'production']);

type Props = { role: Role };

export function OrdersList({ role }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get('q') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const includeDeleted = searchParams.get('includeDeleted') === 'true';
  const statuses = useMemo(() => searchParams.getAll('status'), [searchParams]);

  const [qDraft, setQDraft] = useState(q);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ttnBusy, setTtnBusy] = useState<string | null>(null);
  const [urgentBusy, setUrgentBusy] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const canCreate = CAN_CREATE.has(role);
  const canTtn = CAN_TTN.has(role);
  const canEditUrgent = role !== 'courier';
  const isAdmin = role === 'admin';

  const replaceParams = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if (qDraft === q) return;
      replaceParams((p) => {
        if (qDraft.trim()) p.set('q', qDraft.trim());
        else p.delete('q');
      });
    }, 300);
    return () => clearTimeout(t);
  }, [qDraft, q, replaceParams]);

  const loadOrders = useCallback(
    async (opts?: { silent?: boolean; signal?: AbortSignal }) => {
      const silent = opts?.silent === true;
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      for (const s of statuses) params.append('status', s);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (isAdmin && includeDeleted) params.set('includeDeleted', 'true');

      try {
        const res = await fetch(`/api/orders?${params.toString()}`, {
          credentials: 'same-origin',
          signal: opts?.signal,
        });
        const data = (await res.json()) as {
          orders?: OrderRow[];
          error?: string;
          message?: string;
        };
        if (opts?.signal?.aborted) return;
        if (!res.ok) {
          if (res.status === 401) {
            setError('Требуется вход');
          } else if (res.status === 403) {
            setError(data.message || 'Недостаточно прав');
          } else {
            setError(data.message || 'Ошибка загрузки заказов');
          }
          if (!silent) {
            setOrders([]);
            setLoading(false);
          }
          return;
        }
        setError(null);
        setOrders(data.orders ?? []);
        setLastRefresh(new Date());
        setLoading(false);
      } catch {
        if (opts?.signal?.aborted) return;
        setError('Ошибка загрузки заказов');
        if (!silent) {
          setOrders([]);
          setLoading(false);
        }
      }
    },
    [q, statuses, from, to, includeDeleted, isAdmin],
  );

  useEffect(() => {
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void loadOrders({ signal: ac.signal });
    }, 0);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [loadOrders]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadOrders({ silent: true });
    }, ORDERS_LIST_POLL_MS);

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        void loadOrders({ silent: true });
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadOrders]);

  function toggleStatus(status: string) {
    replaceParams((p) => {
      const current = p.getAll('status');
      p.delete('status');
      const next = current.includes(status)
        ? current.filter((s) => s !== status)
        : [...current, status];
      for (const s of next) p.append('status', s);
    });
  }

  async function onTtnChange(orderId: string, ttnChecked: boolean) {
    setTtnBusy(orderId);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/ttn`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttnChecked }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        if (res.status === 403) {
          setError(data.message || 'Недостаточно прав');
        } else {
          setError(data.message || 'Не удалось обновить ТТН');
        }
        return;
      }
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ttnChecked } : o)));
    } catch {
      setError('Не удалось обновить ТТН');
    } finally {
      setTtnBusy(null);
    }
  }

  async function onUrgentChange(orderId: string, isUrgent: boolean) {
    const prev = orders.find((o) => o.id === orderId)?.isUrgent;
    setUrgentBusy(orderId);
    setError(null);
    setOrders((list) => list.map((o) => (o.id === orderId ? { ...o, isUrgent } : o)));
    try {
      const res = await fetch(`/api/orders/${orderId}/urgent`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isUrgent }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setOrders((list) =>
          list.map((o) => (o.id === orderId ? { ...o, isUrgent: prev === true } : o)),
        );
        if (res.status === 403) {
          setError(data.message || 'Недостаточно прав');
        } else {
          setError(data.message || 'Не удалось обновить «Срочно»');
        }
        return;
      }
    } catch {
      setOrders((list) =>
        list.map((o) => (o.id === orderId ? { ...o, isUrgent: prev === true } : o)),
      );
      setError('Не удалось обновить «Срочно»');
    } finally {
      setUrgentBusy(null);
    }
  }

  const colCount = 6 + (canTtn ? 1 : 0);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Заказы</h1>
          <p className="lede">Список заказов с фильтрами по статусу и дате</p>
          {lastRefresh ? (
            <p className="muted" style={{ marginTop: 4 }}>
              Обновлено{' '}
              {lastRefresh.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              {' · '}
              авто каждые {ORDERS_LIST_POLL_MS / 1000} с
            </p>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void loadOrders({ silent: true })}
          >
            Обновить
          </button>
          {canCreate ? (
            <Link href="/orders/new" className="btn btn-cta">
              Новый заказ
            </Link>
          ) : null}
        </div>
      </div>

      <div className="toolbar">
        <input
          className="input grow"
          type="search"
          placeholder="Номер или клиент"
          value={qDraft}
          onChange={(e) => setQDraft(e.target.value)}
        />
        <input
          className="input"
          type="date"
          aria-label="С даты"
          value={from}
          onChange={(e) => {
            const value = e.target.value;
            replaceParams((p) => {
              if (value) p.set('from', value);
              else p.delete('from');
            });
          }}
        />
        <input
          className="input"
          type="date"
          aria-label="По дату"
          value={to}
          onChange={(e) => {
            const value = e.target.value;
            replaceParams((p) => {
              if (value) p.set('to', value);
              else p.delete('to');
            });
          }}
        />
        {isAdmin ? (
          <label className="muted" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => {
                const checked = e.target.checked;
                replaceParams((p) => {
                  if (checked) p.set('includeDeleted', 'true');
                  else p.delete('includeDeleted');
                });
              }}
            />
            Показать удалённые
          </label>
        ) : null}
      </div>

      <div className="toolbar" style={{ marginTop: -8 }}>
        {ORDER_STATUSES.map((s) => (
          <label
            key={s}
            className="muted"
            style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}
          >
            <input
              type="checkbox"
              checked={statuses.includes(s)}
              onChange={() => toggleStatus(s)}
            />
            {statusLabel(s)}
          </label>
        ))}
      </div>

      {error ? (
        <p className="form-error" style={{ marginBottom: 12 }}>
          {error}
        </p>
      ) : null}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Срочно</th>
              <th>№</th>
              <th>Клиент</th>
              <th>Статус</th>
              <th>Дата</th>
              <th>Сумма</th>
              {canTtn ? <th>ТТН</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colCount} className="muted">
                  Загрузка…
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="muted">
                  Заказов нет
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <input
                      className="check-urgent"
                      type="checkbox"
                      checked={o.isUrgent}
                      disabled={
                        !canEditUrgent ||
                        urgentBusy === o.id ||
                        o.deletedAt != null ||
                        o.status === 'cancelled'
                      }
                      aria-label={`Срочно ${o.orderNumber}`}
                      onChange={(e) => void onUrgentChange(o.id, e.target.checked)}
                    />
                  </td>
                  <td className="mono">
                    <Link href={`/orders/${o.id}`} className="linkish">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td>{o.clientName ?? '—'}</td>
                  <td>
                    <span className={statusBadgeClass(o.status)}>{statusLabel(o.status)}</span>
                    {o.deletedAt ? (
                      <span className="badge st-cancelled" style={{ marginLeft: 6 }}>
                        Удалён
                      </span>
                    ) : null}
                  </td>
                  <td className="mono">{o.orderDate}</td>
                  <td className="mono">{formatMoney2(o.totalAmount)}</td>
                  {canTtn ? (
                    <td>
                      <input
                        className="check-ttn"
                        type="checkbox"
                        checked={o.ttnChecked}
                        disabled={ttnBusy === o.id}
                        aria-label={`ТТН ${o.orderNumber}`}
                        onChange={(e) => void onTtnChange(o.id, e.target.checked)}
                      />
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
