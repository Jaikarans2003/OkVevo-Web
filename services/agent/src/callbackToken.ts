import crypto from 'node:crypto';

// Mirror of src/lib/heygen/callbackToken.ts (no shared package across the
// Next app / agent boundary). Keep the secret and wire format in sync.

export type CallbackTokenPayload = {
  sessionId: string;
  taskId: string;
  exp: number; // unix seconds
};

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

export function selfcheck(): void {
  const prev = process.env.HEYGEN_CALLBACK_SECRET;
  process.env.HEYGEN_CALLBACK_SECRET = 'test_secret';
  try {
    const token = signCallbackToken({
      sessionId: 's1',
      taskId: 't1',
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    const [body, sig] = token.split('.');
    const expected = crypto
      .createHmac('sha256', 'test_secret')
      .update(body)
      .digest('hex');
    if (sig !== expected) throw new Error('agent signCallbackToken mismatch');
    console.log('agent callbackToken selfcheck ok');
  } finally {
    if (prev === undefined) delete process.env.HEYGEN_CALLBACK_SECRET;
    else process.env.HEYGEN_CALLBACK_SECRET = prev;
  }
}
