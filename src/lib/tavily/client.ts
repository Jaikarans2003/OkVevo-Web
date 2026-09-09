export function tavilyServerKey(): string {
  return (process.env.TAVILY_API_KEY || '').trim();
}

export async function proxyTavily(
  action: 'search' | 'extract',
  body: Record<string, unknown>
): Promise<{ status: number; json: unknown; text: string }> {
  const key = tavilyServerKey();
  const payload: Record<string, unknown> = { ...body, include_usage: true };
  delete payload.api_key;
  const res = await fetch(`https://api.tavily.com/${action}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: text };
  }
  return { status: res.status, json, text };
}
