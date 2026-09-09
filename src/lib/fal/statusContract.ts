/**
 * Status-poll contract with the Python fal_client SDK Nia ships (0.13.1).
 *
 * fal_client._parse_status accepts ONLY the statuses IN_QUEUE, IN_PROGRESS,
 * COMPLETED and reads data["logs"] unconditionally for IN_PROGRESS and
 * COMPLETED (missing key = KeyError; any other status string = ValueError —
 * both crash the tool's polling loop with a traceback).
 *
 * Everything outside that set must leave this gateway as a non-2xx HTTP
 * error instead: the SDK's _raise_for_status then raises a clean
 * FalClientHTTPError. Keep the HTTP status out of the SDK retry codes
 * (408/409/429, plus ingress-heuristic 502/503/504) so the poller fails fast
 * instead of retrying.
 *
 * Real Fal mirrors this shape: cancellation is never a pollable status — a
 * cancelled request surfaces as HTTP 499 (client_cancelled), per
 * https://fal.ai/docs/documentation/model-apis/request-errors
 */

/** Settled shortcut body: SDK requires the logs key on COMPLETED. */
export const SETTLED_STATUS_BODY = { status: 'COMPLETED', logs: [] as unknown[] };

/** Released (cancelled / credit-released) job: HTTP error, never a status JSON. */
export const RELEASED_STATUS = { http: 499, message: 'cancelled' } as const;

/** Upstream failure proxied with a 2xx would crash _parse_status — use 500. */
export const FAILED_STATUS_HTTP = 500;
