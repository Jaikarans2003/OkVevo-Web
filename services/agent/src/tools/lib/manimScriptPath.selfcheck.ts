/**
 * Self-check: omitted script_path resolves to session manim_scripts/{safeName}.py
 * Run: npx tsx src/tools/lib/manimScriptPath.selfcheck.ts
 */
import assert from 'node:assert';
import path from 'node:path';
import { defaultSessionManimScriptPath } from './manimScriptPath';
import { getSessionWorkdir } from './utils';

const sessionId = '06d0cbc3-07be-4093-8182-ea8aa33fdca6';
const className = 'SceneWord_to_Vector_Embedding';
const expected = path.join(
  getSessionWorkdir(sessionId),
  'manim_scripts',
  'Word_to_Vector_Embedding.py'
);

assert.strictEqual(defaultSessionManimScriptPath(sessionId, className), expected);
assert.strictEqual(
  defaultSessionManimScriptPath('sess', 'SceneFoo_Bar'),
  path.join(getSessionWorkdir('sess'), 'manim_scripts', 'Foo_Bar.py')
);

console.log('manimScriptPath.selfcheck: ok');
