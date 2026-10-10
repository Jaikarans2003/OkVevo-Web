/**
 * Telegram Bot API sendMessage. Token and chat id stay in env.
 * Never log them, and never log the request URL (it contains the token).
 */

const TELEGRAM_MAX = 4096;
const RETRY_AFTER_CAP_S = 30;

export type TelegramResult = 'sent' | 'skipped' | 'failed';

export function telegramConfigured(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN?.trim() && env.TELEGRAM_CHAT_ID?.trim());
}

export function truncateTelegram(text: string): string {
  if (text.length <= TELEGRAM_MAX) return text;
  const note = '\n…truncated';
  return text.slice(0, TELEGRAM_MAX - note.length) + note;
}

export async function sendTelegram(
  text: string,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))
): Promise<TelegramResult> {
  const token = env.TELEGRAM_BOT_TOKEN?.trim() ?? '';
  const chatId = env.TELEGRAM_CHAT_ID?.trim() ?? '';
  if (!token || !chatId) return 'skipped';
  const body = JSON.stringify({
    chat_id: chatId,
    text: truncateTelegram(text),
  });
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (res.status === 429 && attempt === 0) {
        const retry = await retryAfterSeconds(res);
        await sleep(Math.min(retry, RETRY_AFTER_CAP_S) * 1000);
        continue;
      }
      if (!res.ok) return 'failed';
      return 'sent';
    } catch {
      return 'failed';
    }
  }
  return 'failed';
}

async function retryAfterSeconds(res: Response): Promise<number> {
  try {
    const body = (await res.json()) as { parameters?: { retry_after?: unknown } };
    const n = Number(body.parameters?.retry_after);
    if (Number.isFinite(n) && n > 0) return n;
  } catch {
    /* header fallback */
  }
  const header = Number(res.headers.get('retry-after'));
  return Number.isFinite(header) && header > 0 ? header : 1;
}
