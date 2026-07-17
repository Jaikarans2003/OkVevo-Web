import crypto from 'crypto';

export type CallbackTokenPayload = {
  sessionId: string;
  taskId: string;
  exp: number; // unix seconds
};

export type VerifyCallbackResult =
  | { ok: true; sessionId: string; taskId: string }
  | { ok: false; reason: string };

function getSecret(): string {
  const secret = process.env.HEYGEN_CALLBACK_SECRET;
  if (!secret) {
    throw new Error('HEYGEN_CALLBACK_SECRET is required');
  }
  return secret;
}

/** `base64url(JSON payload) + '.' + hmacHex` over the base64url payload. */
export function signCallbackToken(payload: CallbackTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(body).digest('hex');
  return `${body}.${sig}`;
}

export function verifyCallbackToken(
  token: string | null | undefined
): VerifyCallbackResult {
  if (!token) return { ok: false, reason: 'missing token' };
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return { ok: false, reason: 'malformed token' };

  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('hex');
  const sigBuf = Buffer.from(sig, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { ok: false, reason: 'bad signature' };
  }

  let payload: CallbackTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'bad payload' };
  }
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, sessionId: payload.sessionId, taskId: payload.taskId };
}

export function selfcheck(): void {
  const prev = process.env.HEYGEN_CALLBACK_SECRET;
  process.env.HEYGEN_CALLBACK_SECRET = 'test_secret';
  try {
    const now = Math.floor(Date.now() / 1000);
    const token = signCallbackToken({ sessionId: 's1', taskId: 't1', exp: now + 60 });
    const good = verifyCallbackToken(token);
    if (!good.ok || good.sessionId !== 's1' || good.taskId !== 't1') {
      throw new Error('sign->verify roundtrip failed');
    }
    const last = token.slice(-1);
    const tampered = token.slice(0, -1) + (last === '0' ? '1' : '0');
    if (verifyCallbackToken(tampered).ok) throw new Error('tampered token accepted');
    const expired = signCallbackToken({ sessionId: 's1', taskId: 't1', exp: now - 10 });
    if (verifyCallbackToken(expired).ok) throw new Error('expired token accepted');
    console.log('callbackToken selfcheck ok');
  } finally {
    if (prev === undefined) delete process.env.HEYGEN_CALLBACK_SECRET;
    else process.env.HEYGEN_CALLBACK_SECRET = prev;
  }
}
