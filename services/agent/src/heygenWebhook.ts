import crypto from 'node:crypto';

const MAX_SKEW_SECONDS = 300;
const HEYGEN_API_BASE = process.env.HEYGEN_API_URL ?? 'https://api.heygen.com';

export type HeygenRenderDetail = {
  render_id: string;
  status: 'queued' | 'rendering' | 'completed' | 'failed';
  video_url?: string | null;
  failure_message?: string | null;
  callback_id?: string | null;
};

/** Verify HeyGen webhook HMAC per https://developers.heygen.com/docs/webhooks */
export function verifyHeygenSignature(
  rawBody: Buffer,
  signature: string | undefined,
  timestamp: string | undefined,
  secret: string
): { ok: true } | { ok: false; status: number; error: string } {
  if (!signature || !timestamp) {
    return { ok: false, status: 400, error: 'missing headers' };
  }
  if (!Number.isFinite(Number(timestamp))) {
    return { ok: false, status: 400, error: 'bad timestamp' };
  }
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS) {
    return { ok: false, status: 400, error: 'stale timestamp' };
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, status: 401, error: 'bad signature' };
  }
  return { ok: true };
}

export function videoUrlFromEventData(eventData: Record<string, unknown>): string | null {
  for (const key of ['video_url', 'url'] as const) {
    const value = eventData[key];
    if (typeof value === 'string' && value.startsWith('http')) return value;
  }
  return null;
}

export async function fetchHeygenRender(renderId: string): Promise<HeygenRenderDetail> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error('Missing HEYGEN_API_KEY');

  const response = await fetch(`${HEYGEN_API_BASE}/v3/hyperframes/renders/${renderId}`, {
    headers: { 'X-Api-Key': apiKey },
  });
  if (!response.ok) {
    throw new Error(`HeyGen render GET failed: ${response.status}`);
  }
  const body = (await response.json()) as { data?: HeygenRenderDetail };
  if (!body.data?.render_id || !body.data.status) {
    throw new Error('HeyGen render GET returned unexpected payload');
  }
  return body.data;
}

export function parseCloudRenderId(stdout: string): string {
  const trimmed = stdout.trim();
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const nested = parsed.data;
    const fromNested =
      nested && typeof nested === 'object' && typeof (nested as { render_id?: unknown }).render_id === 'string'
        ? (nested as { render_id: string }).render_id
        : null;
    const id =
      (typeof parsed.render_id === 'string' && parsed.render_id) ||
      fromNested ||
      null;
    if (id) return id;
  } catch {
    // fall through to regex
  }
  const match = trimmed.match(/\b(hfr_[A-Za-z0-9_-]+)\b/);
  if (match) return match[1];
  throw new Error(`Could not parse render_id from cloud render output: ${trimmed.slice(0, 200)}`);
}

export function isSfnExecutionArn(arn: string): boolean {
  return arn.startsWith('arn:aws:states:');
}

export function selfcheck(): void {
  const secret = 'whsec_test';
  const body = Buffer.from('{"event_type":"hyperframes_video.success"}');
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const good = verifyHeygenSignature(body, sig, ts, secret);
  if (!good.ok) throw new Error(`expected ok, got ${good.error}`);
  const bad = verifyHeygenSignature(body, '00'.repeat(32), ts, secret);
  if (bad.ok || bad.status !== 401) throw new Error('expected bad signature 401');
  const stale = verifyHeygenSignature(body, sig, String(Math.floor(Date.now() / 1000) - 999), secret);
  if (stale.ok || stale.status !== 400) throw new Error('expected stale 400');
  if (parseCloudRenderId('{"render_id":"hfr_abc123"}') !== 'hfr_abc123') {
    throw new Error('parseCloudRenderId failed');
  }
  console.log('heygenWebhook selfcheck ok');
}
