export const runtime = 'edge';

const AGENT_URL = process.env.AGENT_URL ?? 'http://localhost:3001';

export async function POST(req: Request) {
  try {
    const response = await fetch(`${AGENT_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: req.body,
      // @ts-ignore — required for streaming request bodies in edge
      duplex: 'half',
    });

    if (!response.ok) {
      const error = await response.text();
      return Response.json(
        { error: error || 'Agent service error' },
        { status: response.status }
      );
    }

    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') ?? 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to reach agent service';
    return Response.json(
      {
        error: `${message}. Is the agent running at ${AGENT_URL}? Start it with: cd services/agent && npm run dev`,
      },
      { status: 503 }
    );
  }
}

export async function GET() {
  const response = await fetch(`${AGENT_URL}/health`);
  const data = await response.json();
  return Response.json(data, { status: response.status });
}
