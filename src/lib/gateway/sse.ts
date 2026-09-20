export type OpenRouterUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
};

export type UsageScan = {
  id?: string;
  model?: string;
  usage?: OpenRouterUsage;
};

function absorbDataPayload(scan: UsageScan, payload: string): void {
  if (!payload || payload === '[DONE]') return;
  try {
    const obj = JSON.parse(payload) as {
      id?: unknown;
      model?: unknown;
      usage?: unknown;
    };
    if (typeof obj.id === 'string' && obj.id) scan.id = obj.id;
    if (typeof obj.model === 'string' && obj.model) scan.model = obj.model;
    if (obj.usage && typeof obj.usage === 'object') {
      scan.usage = obj.usage as OpenRouterUsage;
    }
  } catch {
    // keep-alive, truncated JSON, or mid-stream error line — ignore
  }
}

export function absorbSseLine(scan: UsageScan, line: string): void {
  const t = line.trim();
  if (!t || t.startsWith(':')) return;
  if (!t.startsWith('data:')) return;
  absorbDataPayload(scan, t.slice(5).trim());
}

export function feedSseBytes(
  scan: UsageScan,
  carry: { text: string },
  chunk: Uint8Array,
  decoder: TextDecoder
): void {
  carry.text += decoder.decode(chunk, { stream: true });
  const lines = carry.text.split('\n');
  carry.text = lines.pop() ?? '';
  for (const line of lines) absorbSseLine(scan, line);
}

export function finishSse(scan: UsageScan, carry: { text: string }): void {
  if (carry.text.trim()) absorbSseLine(scan, carry.text);
}

export function absorbJsonBody(scan: UsageScan, text: string): void {
  absorbDataPayload(scan, text);
}

export function tokenCounts(usage: OpenRouterUsage | undefined): {
  promptTokens: number;
  completionTokens: number;
} {
  const n = (v: unknown) => {
    const x = Number(v);
    return Number.isFinite(x) && x > 0 ? Math.floor(x) : 0;
  };
  return {
    promptTokens: n(usage?.prompt_tokens),
    completionTokens: n(usage?.completion_tokens),
  };
}
