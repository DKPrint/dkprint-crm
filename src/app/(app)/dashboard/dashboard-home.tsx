'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatMoney2 } from '@/lib/money';
import { statusBadgeClass, statusLabel } from '@/lib/orders/status-labels';
import type { DashboardPayload } from '@/lib/dashboard/queries';

const DELIVERY_STATUSES = new Set(['ready_for_pickup', 'with_courier', 'delivered']);

function apiError(data: { message?: string }, fallback: string): string {
  return data.message || fallback;
}

export function DashboardHome() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/dashboard', {
          credentials: 'same-origin',
          signal: ac.signal,
        });
        const body = (await res.json()) as DashboardPayload & { message?: string; error?: string };
        if (!res.ok) {
          setError(apiError(body, 'Не удалось загрузить главную'));
          setLoading(false);
          return;
        }
        setData(body);
        setLoading(false);
      } catch {
        if (ac.signal.aborted) return;
        setError('Не удалось загрузить главную');
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  const periodText = data ? `${data.period.from} — ${data.period.to}` : null;

  const statusRows = data?.statusCounts.filter((row) => {
    if (!data.deliveryEmphasis) return row.count > 0;
    return DELIVERY_STATUSES.has(row.status) ? true : row.count > 0;
  });

  return (
    <div className="stack dashboard-home">
      <div className="page-head">
        <div>
          <h1>Главная</h1>
          <p className="lede">
            {periodText
              ? `Сводка за ${data!.period.label} (${periodText})`
              : 'Операционная сводка по вашим заказам'}
          </p>
        </div>
        {data?.showReportsLink ? (
          <Link href="/reports" className="btn btn-secondary">
            Полные отчёты
          </Link>
        ) : null}
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted">Загрузка…</p> : null}

      {!loading && data?.kpi ? (
        <div className="kpis">
          <div className="kpi">
            <div className="label">Заказов (мес.)</div>
            <div className="value">{data.kpi.orderCount}</div>
          </div>
          <div className="kpi">
            <div className="label">Выручка</div>
            <div className="value mono">{formatMoney2(data.kpi.revenue)}</div>
          </div>
          <div className="kpi">
            <div className="label">Средний чек</div>
            <div className="value mono">{formatMoney2(data.kpi.avgCheck)}</div>
          </div>
          <div className="kpi">
            <div className="label">% Выдано</div>
            <div className="value">{data.kpi.deliveredPct}%</div>
          </div>
        </div>
      ) : null}

      {!loading && data ? (
        <div className="dashboard-grid">
          <section className="card stack">
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
              {data.deliveryEmphasis ? 'Статусы выдачи' : 'Заказы по статусам'}
            </h2>
            {data.urgentCount > 0 ? (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                Срочных активных: <strong>{data.urgentCount}</strong>
              </p>
            ) : null}
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Статус</th>
                    <th>Кол-во</th>
                  </tr>
                </thead>
                <tbody>
                  {(statusRows ?? []).map((row) => (
                    <tr
                      key={row.status}
                      className={
                        data.deliveryEmphasis && DELIVERY_STATUSES.has(row.status)
                          ? 'dashboard-delivery-row'
                          : undefined
                      }
                    >
                      <td>
                        <span className={statusBadgeClass(row.status)}>{row.label}</span>
                      </td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link href="/orders" className="linkish">
              Все заказы →
            </Link>
          </section>

          {data.workshopQueueCount !== undefined ? (
            <section className="card stack">
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Очередь цеха</h2>
              <p className="kpi" style={{ margin: 0 }}>
                <span className="value">{data.workshopQueueCount}</span>
              </p>
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                accepted → ready_for_pickup
              </p>
              <Link href="/workshop" className="linkish">
                Открыть очередь →
              </Link>
            </section>
          ) : null}

          {data.slaOverdue ? (
            <section className="card stack">
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>SLA просрочка</h2>
              <p className="kpi" style={{ margin: 0 }}>
                <span className="value">{data.slaOverdue.count}</span>
              </p>
              {data.slaOverdue.preview.length > 0 ? (
                <ul className="dashboard-preview-list">
                  {data.slaOverdue.preview.map((row) => (
                    <li key={row.orderId}>
                      <Link href={`/orders/${row.orderId}`} className="linkish">
                        {row.orderNumber}
                      </Link>
                      {' · '}
                      {row.clientName}
                      {' · '}
                      <span className="mono">{Math.round(row.overdueHours)} ч</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Нет просроченных</p>
              )}
            </section>
          ) : null}

          {data.tasks ? (
            <section className="card stack">
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Мои задачи</h2>
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                Открытых: <strong>{data.tasks.openCount}</strong>
                {data.tasks.overdueCount > 0 ? (
                  <>
                    {' '}
                    · просрочено: <strong>{data.tasks.overdueCount}</strong>
                  </>
                ) : null}
              </p>
              <Link href="/tasks" className="linkish">
                К задачам →
              </Link>
            </section>
          ) : null}

          <section className="card stack dashboard-recent">
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Недавние заказы</h2>
            {data.recentOrders.length === 0 ? (
              <p className="muted">Нет заказов</p>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>№</th>
                      <th>Клиент</th>
                      <th>Статус</th>
                      <th>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <Link href={`/orders/${order.id}`} className="linkish">
                            {order.orderNumber}
                            {order.isUrgent ? ' ⚡' : ''}
                          </Link>
                        </td>
                        <td>{order.clientName ?? '—'}</td>
                        <td>
                          <span className={statusBadgeClass(order.status)}>
                            {statusLabel(order.status)}
                          </span>
                        </td>
                        <td className="mono">{formatMoney2(order.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {data.quickLinks.length > 0 ? (
            <section className="card stack">
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Быстрые ссылки</h2>
              <div className="dashboard-quick-links">
                {data.quickLinks.map((link) => (
                  <Link key={link.href} href={link.href} className="btn btn-secondary">
                    {link.label}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
