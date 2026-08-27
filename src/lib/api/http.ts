import { NextResponse } from 'next/server';

/** Success JSON response. */
export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** Error JSON matching `{ error, message }` (TZ §15). */
export function jsonError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: code, message }, { status });
}

/** Map domain Error.message codes to HTTP responses. */
export function jsonFromError(err: unknown): NextResponse {
  const code = err instanceof Error ? err.message : 'internal_error';
  switch (code) {
    case 'unauthorized':
      return jsonError(401, code, 'Authentication required');
    case 'invalid_password':
      return jsonError(403, code, 'Invalid password');
    case 'forbidden':
      return jsonError(403, code, 'Forbidden');
    case 'order_not_found':
    case 'item_not_found':
      return jsonError(404, code, 'Not found');
    case 'conflict':
    case 'status_conflict':
      return jsonError(409, code, 'Conflict');
    case 'validation':
    case 'invalid_transition':
    case 'cannot_delete_last_item':
    case 'photo_center_cannot_change_status':
    case 'reason_required':
    case 'invalid_status':
      return jsonError(400, code, err instanceof Error ? (err.cause as string) || code : code);
    default:
      if (code.startsWith('invalid_') || code.includes('required')) {
        return jsonError(400, 'validation', code);
      }
      console.error(err);
      return jsonError(500, 'internal_error', 'Internal server error');
  }
}
