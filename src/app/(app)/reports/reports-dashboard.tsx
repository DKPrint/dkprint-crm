'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { formatMoney2 } from '@/lib/money';
import { statusBadgeClass, statusLabel } from '@/lib/orders/status-labels';

type Period = { from: string; to: string };

type Summary = {
  period: Period;
  orderCount: number;
  revenue: number;
  avgCheck: number;
  deliveredPct: number;
};

type FunnelRow = { status: string; label: string; count: number };
type ClientRow = { clientId: string; clientName: string; orderCount: number; revenue: number };
type CategoryRow = {
  categoryKey: string;
  categoryName: string;
  lineCount: number;
  revenue: number;
};
type SlaRow = {
  orderId: string;
  orderNumber: string;
  clientName: string;
  status: string;
  slaStartedAt: string;
  overdueHours: number;
};
type TasksData = {
  byStatus: Array<{ status: string; label: string; count: number }>;
  byPriority: Array<{ priority: string; label: string; count: number }>;
  openOverdueCount: number;
};
type TtnData = { total: number; checked: number; ratePct: number };

function apiError(data: { message?: string }, fallback: string): string {
  return data.message || fallback;
}

export function ReportsDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get('from') ?? '';
  const toParam = searchParams.get('to') ?? '';

  const [fromDraft, setFromDraft] = useState(fromParam);
  const [toDraft, setToDraft] = useState(toParam);

  const [period, setPeriod] = useState<Period | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [funnel, setFunnel] = useState<FunnelRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [slaRows, setSlaRows] = useState<SlaRow[]>([]);
  const [slaTargetHours, setSlaTargetHours] = useState<number | null>(null);
  const [tasks, setTasks] = useState<TasksData | null>(null);
  const [ttn, setTtn] = useState<TtnData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyPeriod = useCallback(() => {
    const params = new URLSearchParams();
    if (fromDraft) params.set('from', fromDraft);
    if (toDraft) params.set('to', toDraft);
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  }, [fromDraft, toDraft, pathname, router]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (fromParam) params.set('from', fromParam);
      if (toParam) params.set('to', toParam);
      const q = params.toString();
      const suffix = q ? `?${q}` : '';

      try {
        const endpoints = [
          '/api/reports/summary',
          '/api/reports/funnel',
          '/api/reports/by-client',
          '/api/reports/by-category',
          '/api/reports/sla-overdue',
          '/api/reports/tasks',
          '/api/reports/ttn-rate',
        ] as const;

        const responses = await Promise.all(
          endpoints.map((path) =>
            fetch(`${path}${suffix}`, { credentials: 'same-origin', signal }),
          ),
        );
        if (signal?.aborted) return;

        const bodies = await Promise.all(responses.map((r) => r.json()));
        if (signal?.aborted) return;

        for (let i = 0; i < responses.length; i++) {
          if (!responses[i]!.ok) {
            setError(apiError(bodies[i] as { message?: string }, 'Ошибка загрузки отчётов'));
            setLoading(false);
            return;
          }
        }

        const [sum, fun, byC, byCat, sla, tsk, ttnBody] = bodies as [
          Summary,
          { period: Period; rows: FunnelRow[] },
          { period: Period; rows: ClientRow[] },
          { period: Period; rows: CategoryRow[] },
          { period: Period; targetHours: number; rows: SlaRow[] },
          TasksData & { period: Period },
          TtnData & { period: Period },
        ];

        setPeriod(sum.period);
        setSummary(sum);
        setFunnel(fun.rows);
        setClients(byC.rows);
        setCategories(byCat.rows);
        setSlaRows(sla.rows);
        setSlaTargetHours(sla.targetHours);
        setTasks(tsk);
        setTtn(ttnBody);
        if (!fromParam && sum.period) {
          setFromDraft(sum.period.from);
          setToDraft(sum.period.to);
        }
        setLoading(false);
      } catch {
        if (signal?.aborted) return;
        setError('Ошибка загрузки отчётов');
        setLoading(false);
      }
    },
    [fromParam, toParam],
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

  const periodLabel = period ? `${period.from} — ${period.to}` : null;

  function exportQuery(format: 'csv' | 'xlsx'): string {
    const params = new URLSearchParams();
    params.set('format', format);
    if (fromParam) params.set('from', fromParam);
    if (toParam) params.set('to', toParam);
    return params.toString();
  }

  return (
    <div className="stack reports-print">
      <div className="page-head">
        <div>
          <h1>Отчёты</h1>
          <p className="lede">KPI по периоду (исключены отменённые и soft-delete) — §12.4</p>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a
            className="btn btn-secondary"
            href={`/api/reports/export?${exportQuery('csv')}`}
            download
          >
            CSV
          </a>
          <a
            className="btn btn-secondary"
            href={`/api/reports/export?${exportQuery('xlsx')}`}
            download
          >
            Excel
          </a>
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            Печать
          </button>
        </div>
      </div>

      <form
        className="card toolbar no-print"
        onSubmit={(e) => {
          e.preventDefault();
          applyPeriod();
        }}
      >
        <label className="field">
          С
          <input
            className="input"
            type="date"
            value={fromDraft}
            onChange={(e) => setFromDraft(e.target.value)}
          />
        </label>
        <label className="field">
          По
          <input
            className="input"
            type="date"
            value={toDraft}
            onChange={(e) => setToDraft(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary">
          Применить
        </button>
        {periodLabel ? (
          <span className="muted" style={{ fontSize: 13 }}>
            {periodLabel}
          </span>
        ) : null}
      </form>

      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted">Загрузка…</p> : null}

      {!loading && summary ? (
        <div className="kpis">
          <div className="kpi">
            <div className="label">Заказов</div>
            <div className="value">{summary.orderCount}</div>
          </div>
          <div className="kpi">
            <div className="label">Выручка</div>
            <div className="value mono">{formatMoney2(summary.revenue)}</div>
          </div>
          <div className="kpi">
            <div className="label">Средний чек</div>
            <div className="value mono">{formatMoney2(summary.avgCheck)}</div>
          </div>
          <div className="kpi">
            <div className="label">% Выдано</div>
            <div className="value">{summary.deliveredPct}%</div>
          </div>
        </div>
      ) : null}

      {!loading && funnel.length > 0 ? (
        <section className="card stack">
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Воронка</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            Включая колонку «Отменён» (вне KPI). Soft-delete не учитывается.
          </p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Статус</th>
                  <th>Кол-во</th>
                </tr>
              </thead>
              <tbody>
                {funnel.map((r) => (
                  <tr key={r.status} className={r.status === 'cancelled' ? 'muted' : undefined}>
                    <td>
                      <span className={statusBadgeClass(r.status)}>{r.label}</span>
                    </td>
                    <td>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!loading ? (
        <section className="card stack">
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>По клиентам</h2>
          {clients.length === 0 ? (
            <p className="muted">Нет данных</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Клиент</th>
                    <th>Заказов</th>
                    <th>Выручка</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((r) => (
                    <tr key={r.clientId}>
                      <td>
                        <Link href={`/clients/${r.clientId}`} className="linkish">
                          {r.clientName}
                        </Link>
                      </td>
                      <td>{r.orderCount}</td>
                      <td className="mono">{formatMoney2(r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {!loading ? (
        <section className="card stack">
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>По категориям</h2>
          {categories.length === 0 ? (
            <p className="muted">Нет данных</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Категория</th>
                    <th>Позиций</th>
                    <th>Выручка</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((r) => (
                    <tr key={r.categoryKey}>
                      <td>{r.categoryName}</td>
                      <td>{r.lineCount}</td>
                      <td className="mono">{formatMoney2(r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {!loading ? (
        <section className="card stack">
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>SLA просрочки</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            Цель: {slaTargetHours ?? '—'} ч (system default). Cancelled / delivered / deleted
            исключены.
          </p>
          {slaRows.length === 0 ? (
            <p className="muted">Просроченных нет</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Заказ</th>
                    <th>Клиент</th>
                    <th>Статус</th>
                    <th>Просрочка</th>
                  </tr>
                </thead>
                <tbody>
                  {slaRows.map((r) => (
                    <tr key={r.orderId}>
                      <td>
                        <Link href={`/orders/${r.orderId}`} className="linkish mono">
                          {r.orderNumber}
                        </Link>
                      </td>
                      <td>{r.clientName}</td>
                      <td>
                        <span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
                      </td>
                      <td>{r.overdueHours} ч</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {!loading && tasks ? (
        <section className="card stack">
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Задачи</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            Открытых с просроченным сроком: <strong>{tasks.openOverdueCount}</strong>
          </p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Статус</th>
                  <th>Кол-во</th>
                </tr>
              </thead>
              <tbody>
                {tasks.byStatus.map((r) => (
                  <tr key={r.status}>
                    <td>{r.label}</td>
                    <td>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Приоритет</th>
                  <th>Кол-во</th>
                </tr>
              </thead>
              <tbody>
                {tasks.byPriority.map((r) => (
                  <tr key={r.priority}>
                    <td>{r.label}</td>
                    <td>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!loading && ttn ? (
        <section className="card stack">
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>% ТТН</h2>
          <div className="kpis" style={{ marginBottom: 0 }}>
            <div className="kpi">
              <div className="label">Заказов (KPI)</div>
              <div className="value">{ttn.total}</div>
            </div>
            <div className="kpi">
              <div className="label">С ТТН</div>
              <div className="value">{ttn.checked}</div>
            </div>
            <div className="kpi">
              <div className="label">Доля</div>
              <div className="value">{ttn.ratePct}%</div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
