/**
 * Client IP for rate limits on App Hosting / Cloud Run.
 *
 * X-Forwarded-For is a chain: each hop appends. Clients can put anything on
 * the left. Google Front End (Cloud Run) appends the TCP peer on the right,
 * so the rightmost entry is the only one the client cannot forge.
 *
 * App Hosting sits on Cloud Run with one GFE hop → use the rightmost value
 * (proxyHops = 0 left of rightmost). If a trusted CDN were inserted in front,
 * raise proxyHops by that hop count.
 *
 * @see https://cloud.google.com/load-balancing/docs/https#x-forwarded-for_header
 */
export function clientIpFromRequest(
  headers: { get(name: string): string | null },
  opts?: { proxyHops?: number }
): string {
  const proxyHops = opts?.proxyHops ?? 0
  const parts: string[] = []
  // Header.Values-equivalent: every X-Forwarded-For line, in order.
  const raw = headers.get('x-forwarded-for')
  if (raw) {
    for (const segment of raw.split(',')) {
      const ip = segment.trim()
      if (ip) parts.push(ip)
    }
  }
  if (parts.length > 0) {
    const idx = Math.max(0, parts.length - 1 - proxyHops)
    return parts[idx]
  }
  const real = headers.get('x-real-ip')?.trim()
  if (real) return real
  return 'unknown'
}
