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
  if (!signature) {
    return { ok: false, status: 400, error: 'missing signature' };
  }
  // The v3 webhook scheme includes Heygen-Timestamp for replay protection, but
  // the legacy hyperframes delivery sends only a `Signature` header with no
  // timestamp. Apply the skew check only when a timestamp is actually present.
  if (timestamp !== undefined) {
    if (!Number.isFinite(Number(timestamp))) {
      return { ok: false, status: 400, error: 'bad timestamp' };
    }
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS) {
      return { ok: false, status: 400, error: 'stale timestamp' };
    }
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
  const readId = (o: unknown): string | null =>
    o && typeof o === 'object' && typeof (o as { render_id?: unknown }).render_id === 'string'
      ? (o as { render_id: string }).render_id
      : null;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const id = readId(parsed) ?? readId(parsed.render) ?? readId(parsed.data);
    if (id) return id;
  } catch {
    // fall through to regex
  }
  // Prefer the value attached to a render_id key so a stray UUID elsewhere
  // in the output (e.g. a _meta trace id) can't be grabbed by mistake.
  const keyed = trimmed.match(/"render_id"\s*:\s*"([^"]+)"/);
  if (keyed) return keyed[1];
  const match = trimmed.match(
    /\b(hfr_[A-Za-z0-9_-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i
  );
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
  // Legacy hyperframes delivery: `Signature` header, no timestamp — must verify.
  const legacy = verifyHeygenSignature(body, sig, undefined, secret);
  if (!legacy.ok) throw new Error(`expected legacy ok, got ${legacy.error}`);
  const legacyBad = verifyHeygenSignature(body, '00'.repeat(32), undefined, secret);
  if (legacyBad.ok || legacyBad.status !== 401) throw new Error('expected legacy bad signature 401');
  if (parseCloudRenderId('{"render_id":"hfr_abc123"}') !== 'hfr_abc123') {
    throw new Error('parseCloudRenderId failed');
  }
  const nestedShape =
    '{"render":{"render_id":"211d77dd-6ee8-4acd-b3c8-b1bca7df487f","status":"queued"},"_meta":{}}';
  if (parseCloudRenderId(nestedShape) !== '211d77dd-6ee8-4acd-b3c8-b1bca7df487f') {
    throw new Error('parseCloudRenderId nested/UUID shape failed');
  }
  console.log('heygenWebhook selfcheck ok');
}
