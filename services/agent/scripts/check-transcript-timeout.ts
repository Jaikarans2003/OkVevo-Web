// Self-check: prune transcribe_video results; errorMessage handles plain/circular objects.
// Run: npm run check-transcript-timeout (from services/agent)
import assert from 'node:assert/strict';
import type { ModelMessage } from 'ai';
import { errorMessage } from '../src/errorMessage';
import { pruneToolResults } from '../src/messagePruning';

function toolExchange(
  toolName: string,
  output: Record<string, unknown>,
  callId: string
): ModelMessage[] {
  return [
    {
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: callId,
          toolName,
          input: {},
        },
      ],
    },
    {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: callId,
          toolName,
          output: { type: 'json', value: output },
        },
      ],
    },
  ];
}

// KEEP_EXCHANGES = 4 → first of 5 exchanges is pruned
const messages: ModelMessage[] = [
  ...toolExchange(
    'transcribe_video',
    {
      transcript_url: 'https://example.com/t.json',
      transcript_text: 'long plain text that should be stubbed',
      duration_seconds: 312,
      word_count: 1842,
    },
    'call-0'
  ),
  ...toolExchange('generate_manim_script', { concept_name: 'A' }, 'call-1'),
  ...toolExchange('generate_manim_script', { concept_name: 'B' }, 'call-2'),
  ...toolExchange('generate_manim_script', { concept_name: 'C' }, 'call-3'),
  ...toolExchange('generate_manim_script', { concept_name: 'D' }, 'call-4'),
];

const pruned = pruneToolResults(messages);
const firstTool = pruned[1];
assert.equal(firstTool.role, 'tool');
assert.ok(Array.isArray(firstTool.content));
const part = firstTool.content[0];
assert.equal(part.type, 'tool-result');
assert.deepEqual(part.output, {
  type: 'text',
  value:
    '[transcript: 1842 words, 312s → https://example.com/t.json]',
});

// Recent exchanges stay intact
const lastTool = pruned[pruned.length - 1];
assert.equal(lastTool.role, 'tool');
assert.ok(Array.isArray(lastTool.content));
const lastPart = lastTool.content[0];
assert.equal(lastPart.type, 'tool-result');
assert.deepEqual(lastPart.output, {
  type: 'json',
  value: { concept_name: 'D' },
});

// errorMessage: Error, string, plain object, circular
assert.equal(errorMessage(new Error('boom')), 'boom');
assert.equal(errorMessage('plain string'), 'plain string');
assert.equal(
  errorMessage({ code: 504, message: 'Provider returned error', metadata: {} }),
  'Provider returned error'
);
const circular: { self?: unknown } = {};
circular.self = circular;
assert.equal(errorMessage(circular), 'An error occurred.');

// Payload size delta (illustrative): words array gone from model-facing return / extract args
const beforeWords = Array.from({ length: 1800 }, (_, i) => ({
  word: `w${i}`,
  start: i * 0.1,
  end: i * 0.1 + 0.08,
}));
const beforeTranscribe = {
  transcript_url: 'u',
  transcript_text: 'hello world '.repeat(200),
  transcript_words: beforeWords,
  duration_seconds: 312,
  word_count: beforeWords.length,
};
const afterTranscribe = {
  transcript_url: 'u',
  transcript_text: beforeTranscribe.transcript_text,
  duration_seconds: 312,
  word_count: beforeWords.length,
};
const beforeExtractArgs = {
  transcript_text: beforeTranscribe.transcript_text,
  transcript_words: beforeWords,
  duration_seconds: 312,
};
const afterExtractArgs = { duration_seconds: 312 };

const beforeT = Buffer.byteLength(JSON.stringify(beforeTranscribe));
const afterT = Buffer.byteLength(JSON.stringify(afterTranscribe));
const beforeE = Buffer.byteLength(JSON.stringify(beforeExtractArgs));
const afterE = Buffer.byteLength(JSON.stringify(afterExtractArgs));

assert.ok(afterT < beforeT, 'slim transcribe return must be smaller');
assert.ok(afterE < 100, 'extract args should be duration only');
assert.ok(!('transcript_words' in afterTranscribe));
assert.ok(!('transcript_words' in afterExtractArgs));

console.log('check-transcript-timeout: ok');
console.log(
  `payload delta: transcribe_video result ${beforeT} → ${afterT} bytes (−${beforeT - afterT}); extract_concepts args ${beforeE} → ${afterE} bytes (−${beforeE - afterE})`
);
