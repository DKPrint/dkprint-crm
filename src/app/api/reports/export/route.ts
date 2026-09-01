import { jsonFromError } from '@/lib/api/http';
import {
  buildReportsCsv,
  buildReportsXlsx,
  exportFilename,
  loadReportBundle,
  parseExportFormat,
} from '@/lib/reports/export';
import { withReportsAuth } from '@/lib/reports/http';

export async function GET(request: Request) {
  try {
    const auth = await withReportsAuth(request);
    if ('error' in auth) return auth.error;

    const format = parseExportFormat(new URL(request.url).searchParams.get('format'));
    const bundle = await loadReportBundle(auth.period);
    const filename = exportFilename(auth.period, format);

    if (format === 'csv') {
      return new Response(buildReportsCsv(bundle), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const buffer = await buildReportsXlsx(bundle);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
