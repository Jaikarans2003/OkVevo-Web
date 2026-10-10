/**
 * One ops alert path. HIGH dedupes to one send per (condition, id) per UTC day.
 * Telegram is primary. OPS_ALERT_WEBHOOK_URL is optional and failure-isolated.
 * Missing Telegram secrets skip cleanly. Text must not contain secrets.
 */

import { sendTelegram, telegramConfigured, type TelegramResult } from '@/lib/ops/telegram';

export type AlertSeverity = 'HIGH' | 'INFO';

export type AlertRecord = { day: string; severity: AlertSeverity; text: string };

export type AlertDeps = {
  nowMs: number;
  env: NodeJS.ProcessEnv;
  store: Map<string, AlertRecord>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

export function alertDocId(condition: string, id: string, day: string): string {
  const safe = id.replace(/[^A-Za-z0-9._-]+/g, '_');
  return `falDrift-${condition}-${safe}-${day}`;
}

export function utcDay(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export async function sendOpsAlert(
  opts: { severity: AlertSeverity; condition: string; id: string; text: string },
  deps: AlertDeps
): Promise<'sent' | 'deduped' | 'skipped'> {
  const day = utcDay(deps.nowMs);
  const key = alertDocId(opts.condition, opts.id, day);
  if (opts.severity === 'HIGH' && deps.store.has(key)) return 'deduped';
  if (opts.text.includes('TELEGRAM_BOT_TOKEN') || /bot\d+:/i.test(opts.text)) {
    throw new Error('alert text must not contain a secret');
  }
  const telegram: TelegramResult = await sendTelegram(
    opts.text,
    deps.env,
    deps.fetchImpl,
    deps.sleep
  );
  const hook = (deps.env.OPS_ALERT_WEBHOOK_URL ?? '').trim();
  if (hook && deps.fetchImpl) {
    try {
      await deps.fetchImpl(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: opts.text }),
      });
    } catch {
      /* webhook must not fail the job */
    }
  }
  if (opts.severity === 'HIGH') {
    deps.store.set(key, { day, severity: opts.severity, text: opts.text });
  }
  if (!telegramConfigured(deps.env) && !hook) return 'skipped';
  return telegram === 'skipped' && !hook ? 'skipped' : 'sent';
}
