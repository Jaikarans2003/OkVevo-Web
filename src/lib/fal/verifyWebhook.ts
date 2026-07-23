import crypto from 'crypto';

const JWKS_URL = 'https://rest.fal.ai/.well-known/jwks.json';
const JWKS_CACHE_MS = 24 * 60 * 60 * 1000;
const MAX_SKEW_SECONDS = 300;

type JwkKey = { x?: string };

let jwksCache: JwkKey[] | null = null;
let jwksCacheTime = 0;

/** Message bytes Fal signs: requestId\\nuserId\\ntimestamp\\nsha256hex(body). */
export function buildFalWebhookMessage(
  requestId: string,
  userId: string,
  timestamp: string,
  body: Buffer
): Buffer {
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
  return Buffer.from(
    [requestId, userId, timestamp, bodyHash].join('\n'),
    'utf8'
  );
}

/** Verify ED25519 signature against JWKS public keys (Node crypto, no libsodium). */
export function verifyAgainstKeys(
  message: Buffer,
  signatureHex: string,
  keys: JwkKey[]
): boolean {
  let signature: Buffer;
  try {
    signature = Buffer.from(signatureHex, 'hex');
  } catch {
    return false;
  }
  if (signature.length === 0) return false;

  for (const key of keys) {
    if (typeof key.x !== 'string') continue;
    try {
      const keyObject = crypto.createPublicKey({
        key: { kty: 'OKP', crv: 'Ed25519', x: key.x },
        format: 'jwk',
      });
      if (crypto.verify(null, message, keyObject, signature)) return true;
    } catch {
      // try next key
    }
  }
  return false;
}

async function fetchJwks(): Promise<JwkKey[]> {
  const now = Date.now();
  if (jwksCache && now - jwksCacheTime < JWKS_CACHE_MS) return jwksCache;
  const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const data = (await res.json()) as { keys?: JwkKey[] };
  jwksCache = data.keys ?? [];
  jwksCacheTime = now;
  return jwksCache;
}

export async function verifyFalWebhook(
  headers: {
    requestId?: string | null;
    userId?: string | null;
    timestamp?: string | null;
    signature?: string | null;
  },
  body: Buffer
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { requestId, userId, timestamp, signature } = headers;
  if (!requestId || !userId || !timestamp || !signature) {
    return { ok: false, status: 400, error: 'missing fal webhook headers' };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, status: 400, error: 'bad timestamp' };
  }
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > MAX_SKEW_SECONDS) {
    return { ok: false, status: 400, error: 'stale timestamp' };
  }

  const message = buildFalWebhookMessage(requestId, userId, timestamp, body);

  let keys: JwkKey[];
  try {
    keys = await fetchJwks();
  } catch {
    return { ok: false, status: 502, error: 'jwks fetch failed' };
  }

  if (!verifyAgainstKeys(message, signature, keys)) {
    return { ok: false, status: 401, error: 'bad signature' };
  }
  return { ok: true };
}

export function selfcheck(): void {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string };
  const body = Buffer.from('{"status":"OK","payload":{}}');
  const requestId = 'req-1';
  const userId = 'user-1';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const message = buildFalWebhookMessage(requestId, userId, timestamp, body);

  const expectedHash = crypto.createHash('sha256').update(body).digest('hex');
  if (
    message.toString('utf8') !==
    `${requestId}\n${userId}\n${timestamp}\n${expectedHash}`
  ) {
    throw new Error('message construction mismatch');
  }

  const sigHex = crypto.sign(null, message, privateKey).toString('hex');
  if (!verifyAgainstKeys(message, sigHex, [{ x: jwk.x }])) {
    throw new Error('ed25519 roundtrip failed');
  }
  if (verifyAgainstKeys(message, '00'.repeat(64), [{ x: jwk.x }])) {
    throw new Error('bad signature accepted');
  }
  console.log('fal verifyWebhook selfcheck ok');
}
