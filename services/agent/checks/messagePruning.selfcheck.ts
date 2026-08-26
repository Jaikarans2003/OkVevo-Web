/**
 * Message pruning: tool-meta prune.summary templates interpolate tool outputs;
 * arrays render as counts; missing fields render '?'; unlisted tools untouched.
 * Run: npx tsx checks/messagePruning.selfcheck.ts
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import type { ModelMessage } from 'ai';
import { pruneToolResults } from '../src/messagePruning';

function exchange(toolName: string, output: Record<string, unknown>): ModelMessage[] {
  return [
    {
      role: 'assistant',
      content: [
        { type: 'tool-call', toolCallId: `c-${toolName}`, toolName, input: {} },
      ],
    },
    {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: `c-${toolName}`,
          toolName,
          output: { type: 'json', value: output },
        },
      ],
    },
  ];
}

const messages: ModelMessage[] = [
  ...exchange('transcribe_video', { word_count: 5, duration_seconds: 10, transcript_url: 'u' }),
  ...exchange('search_files', { directory: 'd', matches: ['a', 'b', 'c'] }),
  ...exchange('run_command', { exit_code: 0 }),
  ...exchange('read_file', { path: 'p', bytes: 9 }),
  ...exchange('web_search', { big: 'payload' }),
];

const pruned = pruneToolResults(messages);

// Only the oldest exchange (transcribe_video) is pruned with KEEP_EXCHANGES=4.
const first = (pruned[1] as { content: Array<{ output: { value: string } }> }).content[0]!;
assert.equal(first.output.value, '[transcript: 5 words, 10s → u]');

// Unlisted tool (web_search) is never summarized, even when pruned.
const stillJson = (pruned[9] as { content: Array<{ output: { type: string } }> }).content[0]!;
assert.equal(stillJson.output.type, 'json');

// Template rules, exercised through a 6-exchange window:
const more: ModelMessage[] = [
  ...exchange('search_files', { directory: 'd', matches: ['x', 'y'] }),
  ...exchange('run_command', {}),
  ...messages,
];
const prunedMore = pruneToolResults(more);
const searchPart = (prunedMore[1] as { content: Array<{ output: { value: string } }> }).content[0]!;
assert.equal(searchPart.output.value, '[searched d — 2 matches]');
const runPart = (prunedMore[3] as { content: Array<{ output: { value: string } }> }).content[0]!;
assert.equal(runPart.output.value, '[command ran — exit ?]');

console.log('messagePruning.selfcheck: ok');
