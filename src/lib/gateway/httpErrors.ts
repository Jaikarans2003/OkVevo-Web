import { NextResponse } from 'next/server';

/**
 * RFC 6750 challenge. Only on a missing, expired, or invalid bearer token.
 * The JSON `code` stays `invalid_api_key` — credential_pool treats a 401
 * whose reason is `invalid_token` as terminal (STATUS_DEAD).
 */
export const BEARER_INVALID_TOKEN = 'Bearer error="invalid_token"';

/**
 * Seconds until the caller should retry. Also the delta added to `reset_at`.
 * credential_pool._normalize_error_context reads `reset_at` (then `resets_at`,
 * then `retry_until`) through _parse_absolute_timestamp: epoch seconds, epoch
 * milliseconds above 1e12, or ISO-8601. A 429 without that field cools down
 * for EXHAUSTED_TTL_429_SECONDS (1 hour).
 */
export const GATEWAY_RETRY_AFTER_SECONDS = 30;

export function invalidTokenResponse(): NextResponse {
  return NextResponse.json(
    {
      error: {
        message: 'Missing, expired, or invalid token',
        type: 'invalid_request_error',
        code: 'invalid_api_key',
      },
    },
    { status: 401, headers: { 'WWW-Authenticate': BEARER_INVALID_TOKEN } }
  );
}

/** Balance cannot cover this request even if open holds were released. */
export function insufficientCreditsResponse(): NextResponse {
  return NextResponse.json(
    {
      error: {
        message: 'insufficient credits',
        type: 'insufficient_quota',
        code: 'insufficient_quota',
      },
    },
    { status: 402 }
  );
}

export function retryLaterResponse(
  code: 'in_flight_budget_exhausted' | 'plan_concurrency_limit',
  message: string,
  nowMs: number = Date.now()
): NextResponse {
  const retryAfter = GATEWAY_RETRY_AFTER_SECONDS;
  const resetAt = Math.floor(nowMs / 1000) + retryAfter;
  return NextResponse.json(
    {
      error: {
        message,
        type: 'rate_limit_error',
        code,
        reset_at: resetAt,
      },
    },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    }
  );
}

export function inFlightBudgetResponse(nowMs?: number): NextResponse {
  return retryLaterResponse(
    'in_flight_budget_exhausted',
    'Too many requests are in flight. Retry after the given reset time.',
    nowMs
  );
}

export function planConcurrencyResponse(nowMs?: number): NextResponse {
  return retryLaterResponse(
    'plan_concurrency_limit',
    'Too many requests are running for this plan. Retry after the given reset time.',
    nowMs
  );
}
