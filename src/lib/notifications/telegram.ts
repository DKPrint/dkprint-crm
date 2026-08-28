import { sql } from '@/lib/db';
import { formatMoney2 } from '@/lib/money';
import { statusLabel } from '@/lib/orders/status-labels';
import { logNotification } from './log';
import type { OrderTelegramCard, TelegramCardFlags } from './types';

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildOrderTelegramCard(
  order: OrderTelegramCard,
  flags: TelegramCardFlags = {},
): string {
  const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const comment = order.lastComment?.trim() ? order.lastComment : '—';
  const lines = [
    `[DKPrint] ${escapeHtml(order.orderNumber)}`,
    `Клиент: ${escapeHtml(order.clientName)} | Сумма: ${escapeHtml(formatMoney2(order.totalAmount))}`,
    `<b>Статус: ${escapeHtml(statusLabel(order.status))}</b>`,
    `Комментарий: ${escapeHtml(comment)}`,
  ];
  if (flags.problematicLayout) {
    lines.push('⚠️ Проблемный макет');
  }
  if (flags.slaOverdue) {
    lines.push('⚠️ Просрочка SLA');
  }
  lines.push(`Ссылка: ${appUrl}/orders/${order.id}`);
  return lines.join('\n');
}

type TelegramHandlers = {
  send: (text: string) => Promise<number>;
  edit: (messageId: number, text: string) => Promise<void>;
};

/** Core sync: edit existing message or send; fallback send on edit failure. */
export async function syncTelegramCardCore(
  existingMessageId: number | null,
  text: string,
  handlers: TelegramHandlers,
): Promise<{ messageId: number; mode: 'send' | 'edit' }> {
  if (existingMessageId != null) {
    try {
      await handlers.edit(existingMessageId, text);
      return { messageId: existingMessageId, mode: 'edit' };
    } catch {
      const id = await handlers.send(text);
      return { messageId: id, mode: 'send' };
    }
  }
  const id = await handlers.send(text);
  return { messageId: id, mode: 'send' };
}

function requireTelegramEnv(): { token: string; chatId: string } | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return null;
  return { token, chatId };
}

async function telegramApi<T>(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok?: boolean; description?: string; result?: T };
  if (!res.ok || data.ok !== true) {
    throw new Error(data.description ?? `telegram_${method}_failed`);
  }
  return data.result as T;
}

function createTelegramHandlers(token: string, chatId: string): TelegramHandlers {
  return {
    async send(text: string) {
      const result = await telegramApi<{ message_id: number }>(token, 'sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
      return result.message_id;
    },
    async edit(messageId: number, text: string) {
      await telegramApi(token, 'editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
    },
  };
}

export async function loadOrderTelegramCard(orderId: string): Promise<OrderTelegramCard | null> {
  const rows = await sql`
    SELECT
      o.id, o.order_number, o.status, o.total_amount, o.telegram_message_id,
      c.name AS client_name
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    WHERE o.id = ${orderId}
    LIMIT 1
  `;
  const row = rows[0] as
    | {
        id: string;
        order_number: string;
        status: string;
        total_amount: string;
        telegram_message_id: string | number | null;
        client_name: string | null;
      }
    | undefined;
  if (!row) return null;

  const commentRows = await sql`
    SELECT body FROM comments
    WHERE order_id = ${orderId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const lastComment = (commentRows[0] as { body: string } | undefined)?.body ?? null;

  return {
    id: row.id,
    orderNumber: row.order_number,
    clientName: row.client_name ?? '—',
    status: row.status,
    totalAmount: row.total_amount,
    telegramMessageId: row.telegram_message_id != null ? Number(row.telegram_message_id) : null,
    lastComment,
  };
}

async function saveTelegramMessageId(orderId: string, messageId: number): Promise<void> {
  await sql`
    UPDATE orders SET telegram_message_id = ${messageId}, updated_at = now()
    WHERE id = ${orderId}
  `;
}

async function hasProblematicComment(orderId: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM comments
    WHERE order_id = ${orderId} AND is_problematic_layout = true
    LIMIT 1
  `;
  return rows.length > 0;
}

async function resolveCardFlags(
  orderId: string,
  opts: TelegramCardFlags,
): Promise<TelegramCardFlags> {
  return {
    problematicLayout: opts.problematicLayout === true || (await hasProblematicComment(orderId)),
    slaOverdue: opts.slaOverdue === true,
  };
}

export async function sendOrderTelegramCard(orderId: string): Promise<boolean> {
  const env = requireTelegramEnv();
  if (!env) return false;

  const order = await loadOrderTelegramCard(orderId);
  if (!order) return false;

  const flags = await resolveCardFlags(orderId, {});
  const text = buildOrderTelegramCard(order, flags);

  try {
    const handlers = createTelegramHandlers(env.token, env.chatId);
    const messageId = await handlers.send(text);
    await saveTelegramMessageId(orderId, messageId);
    await logNotification({
      eventType: 'order_created',
      orderId,
      sentTelegram: true,
      payload: { mode: 'send', messageId },
    });
    return true;
  } catch (err) {
    console.error('[telegram] sendOrderTelegramCard', orderId, err);
    await logNotification({
      eventType: 'order_created',
      orderId,
      sentTelegram: false,
      payload: { error: String(err) },
    });
    return false;
  }
}

export async function syncOrderTelegramCard(
  orderId: string,
  opts: TelegramCardFlags = {},
): Promise<boolean> {
  const env = requireTelegramEnv();
  if (!env) return false;

  const order = await loadOrderTelegramCard(orderId);
  if (!order) return false;

  const flags = await resolveCardFlags(orderId, opts);
  const text = buildOrderTelegramCard(order, flags);

  try {
    const handlers = createTelegramHandlers(env.token, env.chatId);
    const result = await syncTelegramCardCore(order.telegramMessageId, text, handlers);
    if (result.mode === 'send' || result.messageId !== order.telegramMessageId) {
      await saveTelegramMessageId(orderId, result.messageId);
    }
    await logNotification({
      eventType: 'status_changed',
      orderId,
      sentTelegram: true,
      payload: { mode: result.mode, messageId: result.messageId, flags },
    });
    return true;
  } catch (err) {
    console.error('[telegram] syncOrderTelegramCard', orderId, err);
    await logNotification({
      eventType: 'status_changed',
      orderId,
      sentTelegram: false,
      payload: { error: String(err), flags: opts },
    });
    return false;
  }
}
