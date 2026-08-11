import dns from 'node:dns/promises';

export type DiagCheck = {
  id: string;
  ok: boolean;
  ms?: number;
  detail: Record<string, unknown>;
};

function redactKey(key: string | undefined): { present: boolean; length: number; prefix?: string } {
  if (!key) return { present: false, length: 0 };
  return { present: true, length: key.length, prefix: key.slice(0, 4) };
}

/** Walk undici/Node cause chain one level for errno-style codes. */
export function extractCauseCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as { code?: unknown; cause?: unknown };
  if (typeof e.code === 'string') return e.code;
  const cause = e.cause;
  if (cause && typeof cause === 'object') {
    const c = cause as { code?: unknown; cause?: unknown };
    if (typeof c.code === 'string') return c.code;
    if (c.cause && typeof c.cause === 'object') {
      const nested = c.cause as { code?: unknown };
      if (typeof nested.code === 'string') return nested.code;
    }
  }
  return undefined;
}

function errorDetail(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) return { message: String(err) };
  const cause = err.cause;
  return {
    message: err.message,
    name: err.name,
    code: extractCauseCode(err),
    cause:
      cause instanceof Error
        ? {
            message: cause.message,
            name: cause.name,
            code: (cause as NodeJS.ErrnoException).code,
          }
        : cause !== undefined
          ? { value: String(cause), code: extractCauseCode(cause) }
          : undefined,
  };
}

async function timedFetch(
  url: string,
  init: RequestInit & { timeoutMs: number }
): Promise<{ ok: boolean; status?: number; ms: number; detail: Record<string, unknown> }> {
  const { timeoutMs, ...rest } = init;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      ...rest,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const ms = Date.now() - start;
    // Any HTTP status counts as connectivity success.
    return { ok: true, status: res.status, ms, detail: { status: res.status } };
  } catch (err: unknown) {
    return { ok: false, ms: Date.now() - start, detail: errorDetail(err) };
  }
}

const PROXY_VARS = [
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
] as const;

export async function runGroqDiagnostics(): Promise<{ checks: DiagCheck[]; summary: string }> {
  const checks: DiagCheck[] = [];
  const key = process.env.GROQ_API_KEY;
  const keyMeta = redactKey(key);

  checks.push({
    id: 'groq_key',
    ok: keyMeta.present && keyMeta.length > 0,
    detail: keyMeta,
  });

  {
    const start = Date.now();
    try {
      const result = await dns.lookup('api.groq.com', { all: true });
      checks.push({
        id: 'dns_groq',
        ok: result.length > 0,
        ms: Date.now() - start,
        detail: {
          addresses: result.map((r) => ({ address: r.address, family: r.family })),
        },
      });
    } catch (err: unknown) {
      checks.push({
        id: 'dns_groq',
        ok: false,
        ms: Date.now() - start,
        detail: errorDetail(err),
      });
    }
  }

  {
    const headers: Record<string, string> = {};
    if (key) headers.Authorization = `Bearer ${key}`;
    const r = await timedFetch('https://api.groq.com/openai/v1/models', {
      headers,
      timeoutMs: 15_000,
    });
    checks.push({
      id: 'https_groq',
      ok: r.ok,
      ms: r.ms,
      detail: r.detail,
    });
  }

  {
    const r = await timedFetch('https://firebasestorage.googleapis.com', {
      timeoutMs: 10_000,
    });
    checks.push({
      id: 'https_firebase',
      ok: r.ok,
      ms: r.ms,
      detail: r.detail,
    });
  }

  {
    const present: Record<string, { set: boolean; length: number }> = {};
    for (const name of PROXY_VARS) {
      const v = process.env[name];
      present[name] = { set: v !== undefined && v !== '', length: v?.length ?? 0 };
    }
    const anySet = Object.values(present).some((p) => p.set);
    checks.push({
      id: 'proxy_env',
      ok: true, // informational
      detail: { anySet, vars: present },
    });
  }

  const failed = checks.filter((c) => !c.ok).map((c) => c.id);
  const summary =
    failed.length === 0
      ? 'all checks passed (or informational)'
      : `failed: ${failed.join(', ')}`;

  return { checks, summary };
}

