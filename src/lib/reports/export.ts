import ExcelJS from 'exceljs';
import { formatMoney2 } from '@/lib/money';
import type { ReportPeriod } from './period';
import {
  reportByCategory,
  reportByClient,
  reportFunnel,
  reportSlaOverdue,
  reportSummary,
  reportTasks,
  reportTtnRate,
} from './queries';

export type ExportFormat = 'csv' | 'xlsx';

export async function loadReportBundle(period: ReportPeriod) {
  const [summary, funnel, byClient, byCategory, sla, tasks, ttn] = await Promise.all([
    reportSummary(period),
    reportFunnel(period),
    reportByClient(period),
    reportByCategory(period),
    reportSlaOverdue(period),
    reportTasks(period),
    reportTtnRate(period),
  ]);
  return { summary, funnel, byClient, byCategory, sla, tasks, ttn };
}

export type ReportBundle = Awaited<ReturnType<typeof loadReportBundle>>;

export function parseExportFormat(value: string | null): ExportFormat {
  if (value === 'csv' || value === 'xlsx') return value;
  throw new Error('validation');
}

export function exportFilename(period: ReportPeriod, format: ExportFormat): string {
  const ext = format === 'csv' ? 'csv' : 'xlsx';
  return `reports-${period.from}-${period.to}.${ext}`;
}

export function csvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvRow(cells: (string | number)[]): string {
  return cells.map(csvCell).join(',');
}

function csvSection(title: string, header: string[], rows: (string | number)[][]): string[] {
  const lines = [title, csvRow(header), ...rows.map((r) => csvRow(r))];
  return lines;
}

/** Multi-section UTF-8 CSV (TZ §12.4 export). */
export function buildReportsCsv(bundle: ReportBundle): string {
  const { summary, funnel, byClient, byCategory, sla, tasks, ttn } = bundle;
  const period = summary.period;
  const lines: string[] = [
    'DKPrint CRM — отчёт',
    csvRow(['Период', `${period.from} — ${period.to}`]),
    '',
    ...csvSection(
      'KPI',
      ['Показатель', 'Значение'],
      [
        ['Заказов', summary.orderCount],
        ['Выручка', formatMoney2(summary.revenue)],
        ['Средний чек', formatMoney2(summary.avgCheck)],
        ['% Выдано', `${summary.deliveredPct}%`],
        ['ТТН: заказов', ttn.total],
        ['ТТН: с отметкой', ttn.checked],
        ['ТТН: доля', `${ttn.ratePct}%`],
      ],
    ),
    '',
    ...csvSection(
      'Воронка',
      ['Статус', 'Кол-во'],
      funnel.rows.map((r) => [r.label, r.count]),
    ),
    '',
    ...csvSection(
      'По клиентам',
      ['Клиент', 'Заказов', 'Выручка'],
      byClient.rows.map((r) => [r.clientName, r.orderCount, formatMoney2(r.revenue)]),
    ),
    '',
    ...csvSection(
      'По категориям',
      ['Категория', 'Позиций', 'Выручка'],
      byCategory.rows.map((r) => [r.categoryName, r.lineCount, formatMoney2(r.revenue)]),
    ),
    '',
    ...csvSection(
      'SLA просрочки',
      ['Заказ', 'Клиент', 'Статус', 'Просрочка (ч)', 'Цель SLA (ч)'],
      sla.rows.map((r) => [r.orderNumber, r.clientName, r.status, r.overdueHours, sla.targetHours]),
    ),
    '',
    ...csvSection(
      'Задачи — статус',
      ['Статус', 'Кол-во'],
      tasks.byStatus.map((r) => [r.label, r.count]),
    ),
    '',
    ...csvSection(
      'Задачи — приоритет',
      ['Приоритет', 'Кол-во'],
      tasks.byPriority.map((r) => [r.label, r.count]),
    ),
    csvRow(['Открытых с просроченным сроком', tasks.openOverdueCount]),
  ];
  return `\uFEFF${lines.join('\n')}`;
}

export async function buildReportsXlsx(bundle: ReportBundle): Promise<Buffer> {
  const { summary, funnel, byClient, byCategory, sla, tasks, ttn } = bundle;
  const workbook = new ExcelJS.Workbook();

  const kpi = workbook.addWorksheet('KPI');
  kpi.addRow(['Период', `${summary.period.from} — ${summary.period.to}`]);
  kpi.addRow([]);
  kpi.addRow(['Показатель', 'Значение']);
  kpi.addRow(['Заказов', summary.orderCount]);
  kpi.addRow(['Выручка', formatMoney2(summary.revenue)]);
  kpi.addRow(['Средний чек', formatMoney2(summary.avgCheck)]);
  kpi.addRow(['% Выдано', `${summary.deliveredPct}%`]);
  kpi.addRow(['ТТН: заказов', ttn.total]);
  kpi.addRow(['ТТН: с отметкой', ttn.checked]);
  kpi.addRow(['ТТН: доля', `${ttn.ratePct}%`]);

  const funnelSheet = workbook.addWorksheet('Воронка');
  funnelSheet.addRow(['Статус', 'Кол-во']);
  for (const r of funnel.rows) funnelSheet.addRow([r.label, r.count]);

  const clientsSheet = workbook.addWorksheet('Клиенты');
  clientsSheet.addRow(['Клиент', 'Заказов', 'Выручка']);
  for (const r of byClient.rows) {
    clientsSheet.addRow([r.clientName, r.orderCount, formatMoney2(r.revenue)]);
  }

  const categoriesSheet = workbook.addWorksheet('Категории');
  categoriesSheet.addRow(['Категория', 'Позиций', 'Выручка']);
  for (const r of byCategory.rows) {
    categoriesSheet.addRow([r.categoryName, r.lineCount, formatMoney2(r.revenue)]);
  }

  const slaSheet = workbook.addWorksheet('SLA');
  slaSheet.addRow(['Цель SLA (ч)', sla.targetHours]);
  slaSheet.addRow(['Заказ', 'Клиент', 'Статус', 'Просрочка (ч)']);
  for (const r of sla.rows) {
    slaSheet.addRow([r.orderNumber, r.clientName, r.status, r.overdueHours]);
  }

  const tasksSheet = workbook.addWorksheet('Задачи');
  tasksSheet.addRow(['Статус', 'Кол-во']);
  for (const r of tasks.byStatus) tasksSheet.addRow([r.label, r.count]);
  tasksSheet.addRow([]);
  tasksSheet.addRow(['Приоритет', 'Кол-во']);
  for (const r of tasks.byPriority) tasksSheet.addRow([r.label, r.count]);
  tasksSheet.addRow([]);
  tasksSheet.addRow(['Открытых с просроченным сроком', tasks.openOverdueCount]);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
