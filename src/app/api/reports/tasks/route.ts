import { withReportsAuth, jsonFromError, jsonOk } from '@/lib/reports/http';
import { reportTasks } from '@/lib/reports/queries';

export async function GET(request: Request) {
  try {
    const auth = await withReportsAuth(request);
    if ('error' in auth) return auth.error;
    const data = await reportTasks(auth.period);
    return jsonOk(data);
  } catch (err) {
    return jsonFromError(err);
  }
}
