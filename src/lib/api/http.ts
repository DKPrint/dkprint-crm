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
      return jsonError(401, code, 'Требуется вход');
    case 'invalid_password':
      return jsonError(403, code, 'Неверный пароль');
    case 'forbidden':
      return jsonError(403, code, 'Недостаточно прав');
    case 'order_not_found':
    case 'item_not_found':
    case 'file_not_found':
    case 'category_not_found':
    case 'product_not_found':
    case 'consumable_not_found':
    case 'bom_line_not_found':
    case 'client_not_found':
    case 'task_not_found':
      return jsonError(404, code, 'Не найдено');
    case 'file_not_ready':
      return jsonError(400, code, 'Файл ещё не загружен');
    case 'file_too_large':
      return jsonError(400, code, 'Файл больше 100 МБ');
    case 'invalid_mime':
      return jsonError(400, code, 'Недопустимый тип файла (JPEG, PNG, WebP, GIF, TIFF, PDF, ZIP)');
    case 'invalid_filename':
      return jsonError(400, code, 'Недопустимое имя файла');
    case 'r2_not_configured':
      return jsonError(503, code, 'Хранилище файлов не настроено');
    case 'push_not_configured':
      return jsonError(503, code, 'Web Push не настроен');
    case 'conflict':
    case 'status_conflict':
      return jsonError(409, code, 'Конфликт данных');
    case 'cannot_delete_last_item':
      return jsonError(400, code, 'Нельзя удалить последнюю позицию');
    case 'reason_required':
      return jsonError(400, code, 'Укажите причину');
    case 'validation':
    case 'invalid_transition':
    case 'photo_center_cannot_change_status':
    case 'invalid_status':
      return jsonError(400, code, err instanceof Error ? (err.cause as string) || code : code);
    case 'category_has_children':
      return jsonError(400, code, 'Товар можно создать только в конечной категории');
    case 'empty_workbook':
      return jsonError(400, code, 'Файл пустой или без данных');
    case 'no_data_rows':
      return jsonError(400, code, 'Нет строк данных в файле');
    default:
      if (
        code.startsWith('invalid_') ||
        code.startsWith('missing_') ||
        code.includes('required') ||
        code.startsWith('missing_product_') ||
        code.startsWith('invalid_price_row_')
      ) {
        return jsonError(400, 'validation', code);
      }
      console.error(err);
      return jsonError(500, 'internal_error', 'Внутренняя ошибка сервера');
  }
}
