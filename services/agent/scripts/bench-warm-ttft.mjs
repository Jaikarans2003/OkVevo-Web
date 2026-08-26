/**
 * Warm-turn TTFT bench against live AgentCore.
 * Measures client-visible first text/tool chunk; also prints wall times.
 *
 * Usage: node --env-file=../../.env scripts/bench-warm-ttft.mjs
 */
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from '@aws-sdk/client-bedrock-agentcore';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(
  readFileSync(join(__dirname, '../agentcore.config.json'), 'utf8')
);

const region = config.region || process.env.AWS_REGION || 'us-east-1';
const arn = config.agentRuntimeArn;
const userId = `bench-warm-${Date.now()}`;
const runtimeSessionId = `okvevo-user-${userId}`.padEnd(33, '0').slice(0, 64);
const chatSessionId = randomUUID();

const client = new BedrockAgentCoreClient({ region });

const VISIBLE =
  /"(type)":\s*"(text-delta|text-start|reasoning-delta|tool-input-start|tool-call)"|"type":"(text-delta|text-start|reasoning-delta|tool-input-start|tool-call)"/;

async function warmup() {
  const t0 = Date.now();
  const out = await client.send(
    new InvokeAgentRuntimeCommand({
      agentRuntimeArn: arn,
      runtimeSessionId,
      runtimeUserId: userId,
      contentType: 'application/json',
      accept: 'application/json',
      payload: Buffer.from(
        JSON.stringify({
          input: { action: 'warmup', sessionId: chatSessionId, userId },
        })
      ),
    })
  );
  // drain
  if (out.response) {
    const chunks = [];
    for await (const c of out.response) chunks.push(c);
  }
  return Date.now() - t0;
}

async function oneTurn(n, prompt) {
  const payload = Buffer.from(
    JSON.stringify({
      input: {
        prompt,
        sessionId: chatSessionId,
        userId,
        stream: true,
        pipelineMode: 'ask',
      },
    })
  );
  const t0 = Date.now();
  let firstByte = null;
  let firstVisible = null;
  let bytes = 0;
  const out = await client.send(
    new InvokeAgentRuntimeCommand({
      agentRuntimeArn: arn,
      runtimeSessionId,
      runtimeUserId: userId,
      contentType: 'application/json',
      accept: 'text/event-stream',
      payload,
    })
  );
  const stream = out.response;
  if (!stream) throw new Error('no response stream');
  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of stream) {
    const now = Date.now();
    if (firstByte == null) firstByte = now - t0;
    const text =
      typeof chunk === 'string'
        ? chunk
        : chunk instanceof Uint8Array
          ? decoder.decode(chunk, { stream: true })
          : Buffer.isBuffer(chunk)
            ? chunk.toString('utf8')
            : decoder.decode(chunk);
    bytes += text.length;
    buf += text;
    if (firstVisible == null && VISIBLE.test(buf)) {
      firstVisible = now - t0;
    }
    // Don't wait forever for full completion — first visible is enough for TTFT
    if (firstVisible != null && now - t0 > firstVisible + 1500) break;
  }
  return {
    n,
    first_byte_ms: firstByte,
    first_visible_ms: firstVisible,
    wall_ms: Date.now() - t0,
    bytes,
  };
}

const prompts = [
  'Reply with exactly one word: ping',
  'Reply with exactly one word: pong',
  'What is 2+2? One number only.',
  'Say hello in one short sentence.',
  'Name one color. One word only.',
];

console.log(
  JSON.stringify({
    phase: 'start',
    runtimeSessionId,
    chatSessionId,
    arn,
    region,
  })
);

const warmMs = await warmup();
console.log(JSON.stringify({ phase: 'warmup_done', warm_ms: warmMs }));

// Discard first chat turn as microVM/session settle; then 5 warm turns
const settle = await oneTurn(0, 'Reply with exactly one word: ready');
console.log(JSON.stringify({ phase: 'settle', ...settle }));

const rows = [];
for (let i = 0; i < 5; i++) {
  const row = await oneTurn(i + 1, prompts[i]);
  rows.push(row);
  console.log(JSON.stringify({ phase: 'warm_turn', ...row }));
  // brief gap so logs don't collide
  await new Promise((r) => setTimeout(r, 500));
}

const avg = (key) =>
  Math.round(rows.reduce((s, r) => s + (r[key] ?? 0), 0) / rows.length);

console.log(
  JSON.stringify({
    phase: 'summary',
    chatSessionId,
    turns: rows,
    avg_first_byte_ms: avg('first_byte_ms'),
    avg_first_visible_ms: avg('first_visible_ms'),
    avg_wall_ms: avg('wall_ms'),
  })
);
