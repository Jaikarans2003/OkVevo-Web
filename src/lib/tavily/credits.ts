/** Tavily credit count + PAYG USD. usage.credits === 0 is not free. */

export const DEFAULT_TAVILY_USD_PER_CREDIT = 0.008;

export function tavilyUsdPerCredit(processEnv: NodeJS.ProcessEnv = process.env): number {
  const n = Number(processEnv.TAVILY_USD_PER_CREDIT);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TAVILY_USD_PER_CREDIT;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function isAdvanced(depth: unknown): boolean {
  return String(depth ?? '').trim().toLowerCase() === 'advanced';
}

export function urlList(body: unknown): string[] {
  const rec = asRecord(body);
  if (!rec) return [];
  const urls = rec.urls;
  if (typeof urls === 'string' && urls.trim()) return [urls.trim()];
  if (!Array.isArray(urls)) return [];
  return urls
    .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    .map((u) => u.trim());
}

function perFive(depth: unknown): number {
  return isAdvanced(depth) ? 2 : 1;
}

export function estimateTavilyCredits(
  action: 'search' | 'extract',
  body: unknown
): number {
  if (action === 'search') {
    return isAdvanced(asRecord(body)?.search_depth) ? 2 : 1;
  }
  const n = urlList(body).length;
  if (n <= 0) return 0;
  return perFive(asRecord(body)?.extract_depth) * Math.ceil(n / 5);
}

export function successfulExtractUrls(response: unknown): number {
  const rec = asRecord(response);
  const results = rec?.results;
  if (!Array.isArray(results)) return 0;
  return results.filter((row) => {
    const r = asRecord(row);
    return Boolean(r) && !r?.error;
  }).length;
}

/** Prefer usage.credits when > 0; otherwise the documented formula. */
export function billedTavilyCredits(
  action: 'search' | 'extract',
  body: unknown,
  response: unknown
): number {
  const usage = asRecord(asRecord(response)?.usage);
  const reported = Number(usage?.credits);
  if (Number.isFinite(reported) && reported > 0) return Math.ceil(reported);
  if (action === 'search') return estimateTavilyCredits('search', body);
  const n = successfulExtractUrls(response);
  if (n <= 0) return 0;
  return perFive(asRecord(body)?.extract_depth) * Math.ceil(n / 5);
}
