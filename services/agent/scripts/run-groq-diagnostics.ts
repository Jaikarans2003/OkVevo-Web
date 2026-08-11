import 'dotenv/config';
import assert from 'node:assert/strict';
import { runGroqDiagnostics } from '../src/diagnostics/groqConnectivity';

async function selfcheckRedaction(): Promise<void> {
  // ponytail: fails if redaction ever dumps a full gsk_ key
  const fake = 'gsk_THIS_MUST_NEVER_APPEAR_IN_FULL_OUTPUT_XXXXXXXX';
  const prev = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = fake;
  try {
    const { checks } = await runGroqDiagnostics();
    const blob = JSON.stringify(checks);
    assert.equal(blob.includes(fake), false, 'full GROQ key leaked in diagnostics output');
    assert.equal(blob.includes('gsk_'), true, 'expected redacted prefix gsk_');
    const keyCheck = checks.find((c) => c.id === 'groq_key');
    assert.equal((keyCheck?.detail as { prefix?: string })?.prefix, 'gsk_');
    assert.equal((keyCheck?.detail as { length?: number })?.length, fake.length);
    console.log(JSON.stringify({ summary: 'selfcheck ok' }));
  } finally {
    if (prev === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = prev;
  }
}

async function main() {
  if (process.argv.includes('--selfcheck')) {
    await selfcheckRedaction();
    return;
  }
  const result = await runGroqDiagnostics();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.checks.some((c) => !c.ok) ? 1 : 0);
}

void main();
