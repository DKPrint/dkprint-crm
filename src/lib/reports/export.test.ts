import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildReportsCsv, csvCell, csvRow, exportFilename, parseExportFormat } from './export';

describe('reports export §12.4', () => {
  const period = { from: '2026-09-01', to: '2026-09-30' };

  it('parseExportFormat accepts csv and xlsx', () => {
    assert.equal(parseExportFormat('csv'), 'csv');
    assert.equal(parseExportFormat('xlsx'), 'xlsx');
  });

  it('parseExportFormat rejects missing or invalid', () => {
    assert.throws(() => parseExportFormat(null), /validation/);
    assert.throws(() => parseExportFormat('pdf'), /validation/);
  });

  it('exportFilename includes period and extension', () => {
    assert.equal(exportFilename(period, 'csv'), 'reports-2026-09-01-2026-09-30.csv');
    assert.equal(exportFilename(period, 'xlsx'), 'reports-2026-09-01-2026-09-30.xlsx');
  });

  it('csvCell escapes commas and quotes', () => {
    assert.equal(csvCell('plain'), 'plain');
    assert.equal(csvCell('a,b'), '"a,b"');
    assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  });

  it('buildReportsCsv includes KPI and funnel sections', () => {
    const csv = buildReportsCsv({
      summary: {
        period,
        orderCount: 3,
        revenue: 100,
        avgCheck: 33.33,
        deliveredPct: 66.67,
      },
      funnel: {
        period,
        rows: [{ status: 'new', label: 'Новый', count: 2 }],
      },
      byClient: { period, rows: [] },
      byCategory: { period, rows: [] },
      sla: { period, targetHours: 72, rows: [] },
      tasks: {
        period,
        byStatus: [{ status: 'open', label: 'Открыта', count: 1 }],
        byPriority: [{ priority: 'normal', label: 'Обычный', count: 1 }],
        openOverdueCount: 0,
      },
      ttn: { period, total: 3, checked: 1, ratePct: 33.33 },
    });
    assert.ok(csv.startsWith('\uFEFF'));
    assert.match(csv, /DKPrint CRM/);
    assert.match(csv, /KPI/);
    assert.match(csv, /Воронка/);
    assert.match(csv, /Новый,2/);
    assert.equal(csvRow(['a', 'b']), csvCell('a') + ',' + csvCell('b'));
  });
});
