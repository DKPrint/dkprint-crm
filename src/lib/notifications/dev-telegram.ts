import { escapeHtml } from './telegram';

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

function requireDevTelegramEnv(): { token: string; chatId: string } | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_DEV_CHAT_ID?.trim();
  if (!token || !chatId) return null;
  return { token, chatId };
}

/** HTML body for one-shot dev/ops alerts (separate chat from order live cards). */
export function formatDevTelegramAlert(title: string, lines: string[]): string {
  const body = lines.map((line) => escapeHtml(line)).join('\n');
  return `<b>${escapeHtml(title)}</b>\n${body}`;
}

/** One-shot dev/ops alert; does not edit messages. Returns false if env missing or send fails. */
export async function sendDevTelegramAlert(text: string): Promise<boolean> {
  const env = requireDevTelegramEnv();
  if (!env) return false;

  try {
    await telegramApi(env.token, 'sendMessage', {
      chat_id: env.chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
    return true;
  } catch (err) {
    console.error('[telegram-dev] sendDevTelegramAlert', err);
    return false;
  }
}
