/**
 * One ops alert path. Outputs: an `opsAlerts` Firestore record (banner/badge
 * source for the admin dashboard) plus one structured log line (severity,
 * condition, id) that a log-based alert policy can match. HIGH dedupes to one
 * send per (condition, id) per UTC day. Text must not contain secrets.
 */

export type AlertSeverity = 'HIGH' | 'INFO';

export type AlertRecord = {
  day: string;
  severity: AlertSeverity;
  condition: string;
  id: string;
  text: string;
  resolved: boolean;
};

/** Map-friendly store so selfchecks stay in-memory; prod uses firestoreAlertStore. */
export type AlertStore = {
  has(key: string): Promise<boolean> | boolean;
  set(key: string, record: AlertRecord): Promise<void> | void;
};

export type AlertDeps = {
  nowMs: number;
  store: AlertStore;
  log?: (line: string) => void;
};

export function alertDocId(condition: string, id: string, day: string): string {
  const safe = id.replace(/[^A-Za-z0-9._-]+/g, '_');
  return `falDrift-${condition}-${safe}-${day}`;
}

export function utcDay(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/** Structured log line a Cloud Monitoring log-based alert can match. */
export function alertLogLine(record: AlertRecord): string {
  return JSON.stringify({
    opsAlert: true,
    severity: record.severity,
    condition: record.condition,
    id: record.id,
    day: record.day,
    text: record.text,
  });
}

/** Alert text must never carry a credential, whatever the destination. */
function assertNoSecret(text: string): void {
  if (/bot\d+:[A-Za-z0-9_-]{20,}/.test(text) || /(?:KEY|TOKEN|SECRET)=\S+/.test(text)) {
    throw new Error('alert text must not contain a secret');
  }
}

export async function sendOpsAlert(
  opts: { severity: AlertSeverity; condition: string; id: string; text: string },
  deps: AlertDeps
): Promise<'sent' | 'deduped'> {
  const day = utcDay(deps.nowMs);
  const key = alertDocId(opts.condition, opts.id, day);
  if (opts.severity === 'HIGH' && (await deps.store.has(key))) return 'deduped';
  assertNoSecret(opts.text);
  const record: AlertRecord = {
    day,
    severity: opts.severity,
    condition: opts.condition,
    id: opts.id,
    text: opts.text,
    resolved: false,
  };
  (deps.log ?? console.error)(alertLogLine(record));
  await deps.store.set(key, record);
  return 'sent';
}
