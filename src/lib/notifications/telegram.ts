import { sql } from '@/lib/db';
import { formatMoney2 } from '@/lib/money';
import { shortTech } from '@/lib/orders/format-tech';
import { statusLabel } from '@/lib/orders/status-labels';
import { getDefaultSlaTargetHours } from '@/lib/sla/goals';
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
  ];
  if (order.isUrgent) {
    lines.push('☑️ Срочно');
  }
  for (const item of order.items) {
    const tech = shortTech(item.techParams);
    const itemName = item.name.trim() ? item.name : '—';
    lines.push(
      `${item.positionNumber}. ${escapeHtml(itemName)} × ${item.quantity} — ${escapeHtml(tech)}`,
    );
  }
  lines.push(`Комментарий: ${escapeHtml(comment)}`);
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

/** Telegram returns 400 when edit content is unchanged — not a real failure. */
export function isTelegramNotModifiedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /message is not modified/i.test(msg);
}

/** Core sync: edit existing message or send; fallback send on real edit failure. */
export async function syncTelegramCardCore(
  existingMessageId: number | null,
  text: string,
  handlers: TelegramHandlers,
): Promise<{ messageId: number; mode: 'send' | 'edit' }> {
  if (existingMessageId != null) {
    try {
      await handlers.edit(existingMessageId, text);
      return { messageId: existingMessageId, mode: 'edit' };
    } catch (err) {
      if (isTelegramNotModifiedError(err)) {
        return { messageId: existingMessageId, mode: 'edit' };
      }
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

type OrderTelegramRow = OrderTelegramCard & {
  slaStartedAt: string;
  slaStoppedAt: string | null;
  status: string;
};

export async function loadOrderTelegramCard(orderId: string): Promise<OrderTelegramRow | null> {
  const rows = await sql`
    SELECT
      o.id, o.order_number, o.status, o.total_amount, o.telegram_message_id,
      o.sla_started_at, o.sla_stopped_at, o.is_urgent,
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
        sla_started_at: string;
        sla_stopped_at: string | null;
        is_urgent: boolean;
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

  const itemRows = (await sql`
    SELECT position_number, name, quantity, tech_params
    FROM order_items
    WHERE order_id = ${orderId}
    ORDER BY position_number ASC
  `) as Array<{
    position_number: number;
    name: string;
    quantity: number;
    tech_params: string | null;
  }>;

  return {
    id: row.id,
    orderNumber: row.order_number,
    clientName: row.client_name ?? '—',
    status: row.status,
    totalAmount: row.total_amount,
    telegramMessageId: row.telegram_message_id != null ? Number(row.telegram_message_id) : null,
    lastComment,
    isUrgent: row.is_urgent === true,
    items: itemRows.map((i) => ({
      positionNumber: Number(i.position_number),
      name: i.name,
      quantity: Number(i.quantity),
      techParams: i.tech_params,
    })),
    slaStartedAt: row.sla_started_at,
    slaStoppedAt: row.sla_stopped_at,
  };
}

async function saveTelegramMessageId(orderId: string, messageId: number): Promise<boolean> {
  // Only set if empty — prevents late create-send from overwriting an id
  // set by a concurrent status sync (still may have sent a duplicate message).
  const rows = await sql`
    UPDATE orders
    SET telegram_message_id = ${messageId}, updated_at = now()
    WHERE id = ${orderId} AND telegram_message_id IS NULL
    RETURNING id
  `;
  if (rows.length > 0) return true;

  await sql`
    UPDATE orders
    SET telegram_message_id = ${messageId}, updated_at = now()
    WHERE id = ${orderId}
  `;
  return true;
}

export async function hasProblematicComment(orderId: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM comments
    WHERE order_id = ${orderId} AND is_problematic_layout = true
    LIMIT 1
  `;
  return rows.length > 0;
}

function isSlaOverdue(order: OrderTelegramRow, targetHours: number): boolean {
  if (order.slaStoppedAt) return false;
  if (order.status === 'cancelled' || order.status === 'delivered') return false;
  const started = new Date(order.slaStartedAt).getTime();
  if (!Number.isFinite(started)) return false;
  return Date.now() - started > targetHours * 60 * 60 * 1000;
}

async function resolveCardFlags(
  order: OrderTelegramRow,
  opts: TelegramCardFlags,
): Promise<TelegramCardFlags> {
  const targetHours = await getDefaultSlaTargetHours();
  return {
    // Always from DB so clearing comments clears the TG badge
    problematicLayout: await hasProblematicComment(order.id),
    slaOverdue: opts.slaOverdue === true || isSlaOverdue(order, targetHours),
  };
}

export async function sendOrderTelegramCard(orderId: string): Promise<boolean> {
  const env = requireTelegramEnv();
  if (!env) return false;

  const order = await loadOrderTelegramCard(orderId);
  if (!order) return false;

  // Late create hook after status already sent a card — do not send a second message
  if (order.telegramMessageId != null) {
    return syncOrderTelegramCard(orderId);
  }

  const flags = await resolveCardFlags(order, {});
  const text = buildOrderTelegramCard(order, flags);

  try {
    // Re-check before send (race with status sync)
    const again = await loadOrderTelegramCard(orderId);
    if (again?.telegramMessageId != null) {
      return syncOrderTelegramCard(orderId);
    }

    const handlers = createTelegramHandlers(env.token, env.chatId);
    const messageId = await handlers.send(text);

    // If another worker already saved an id, keep theirs (orphan TG message possible)
    const claimed = await sql`
      UPDATE orders
      SET telegram_message_id = ${messageId}, updated_at = now()
      WHERE id = ${orderId} AND telegram_message_id IS NULL
      RETURNING id
    `;
    if (claimed.length === 0) {
      console.warn('[telegram] sendOrderTelegramCard: id already set, skipping overwrite', orderId);
    }

    await logNotification({
      eventType: 'order_created',
      orderId,
      sentTelegram: true,
      payload: { mode: 'send', messageId, claimed: claimed.length > 0 },
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

  const flags = await resolveCardFlags(order, opts);
  const text = buildOrderTelegramCard(order, flags);

  try {
    const handlers = createTelegramHandlers(env.token, env.chatId);
    const result = await syncTelegramCardCore(order.telegramMessageId, text, handlers);
    if (result.messageId !== order.telegramMessageId) {
      await saveTelegramMessageId(orderId, result.messageId);
    }
    await logNotification({
      eventType: 'telegram_sync',
      orderId,
      sentTelegram: true,
      payload: { mode: result.mode, messageId: result.messageId, flags },
    });
    return true;
  } catch (err) {
    console.error('[telegram] syncOrderTelegramCard', orderId, err);
    await logNotification({
      eventType: 'telegram_sync',
      orderId,
      sentTelegram: false,
      payload: { error: String(err), flags: opts },
    });
    return false;
  }
}
