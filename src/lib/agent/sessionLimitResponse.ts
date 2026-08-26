/** Session-limit JSON from 413 or JSON-first-bytes on a 200 (not SSE `data:`). */

export type SessionLimitHit = {
  estimatedTokens: number | null;
};

export function sessionLimitFromPreview(opts: {
  status: number;
  contentType?: string | null;
  preview: string;
}): SessionLimitHit | null {
  const text = opts.preview.trimStart();
  const jsonCt = (opts.contentType ?? '').toLowerCase().includes('application/json');

  if (opts.status === 413) {
    try {
      const parsed = JSON.parse(text) as {
        error?: unknown;
        estimatedTokens?: unknown;
      };
      if (parsed.error !== 'session_limit_reached') return null;
      return {
        estimatedTokens:
          typeof parsed.estimatedTokens === 'number' ? parsed.estimatedTokens : null,
      };
    } catch {
      return { estimatedTokens: null };
    }
  }

  if (!jsonCt && !text.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(text) as {
      error?: unknown;
      estimatedTokens?: unknown;
    };
    if (parsed.error !== 'session_limit_reached') return null;
    return {
      estimatedTokens:
        typeof parsed.estimatedTokens === 'number' ? parsed.estimatedTokens : null,
    };
  } catch {
    return null;
  }
}

function prependChunk(
  first: ReadableStreamReadResult<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      if (first.value) controller.enqueue(first.value);
      if (first.done) {
        controller.close();
        return;
      }
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) controller.enqueue(value);
        }
        controller.close();
      } catch {
        controller.close();
      }
    },
    cancel() {
      return reader.cancel();
    },
  });
}

export async function guardSessionLimitResponse(response: Response): Promise<{
  limit: SessionLimitHit | null;
  response: Response;
}> {
  if (response.status === 413) {
    const text = await response.text();
    const limit = sessionLimitFromPreview({
      status: 413,
      contentType: response.headers.get('content-type'),
      preview: text,
    });
    return {
      limit,
      response: new Response(text, {
        status: 413,
        headers: response.headers,
      }),
    };
  }

  if (!response.body) return { limit: null, response };

  const reader = response.body.getReader();
  const first = await reader.read();
  const preview = new TextDecoder().decode(first.value ?? new Uint8Array());
  const limit = sessionLimitFromPreview({
    status: response.status,
    contentType: response.headers.get('content-type'),
    preview,
  });
  if (limit) {
    await reader.cancel().catch(() => undefined);
    return {
      limit,
      response: new Response(
        JSON.stringify({
          error: 'session_limit_reached',
          estimatedTokens: limit.estimatedTokens,
        }),
        {
          status: 413,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }

  return {
    limit: null,
    response: new Response(prependChunk(first, reader), {
      status: response.status,
      headers: response.headers,
    }),
  };
}
