/**
 * Ask-Me policy: concatenated choice reject + requiresConfirmedFields gate.
 * Run: npx tsx checks/askMePolicy.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { TOOL_META } from '../src/catalog/manifest';
import { missingFieldsFromData } from '../src/confirmedFields';
import {
  askFingerprint,
  concatenatedChoiceError,
} from '../src/clarifyShape';

const concat = concatenatedChoiceError([
  { id: 'english_horizontal_custom', label: 'English + Horizontal + Custom' },
]);
assert(concat, 'english_horizontal_custom must be rejected before checkpoint write');
assert.match(concat!, /english_horizontal_custom/);

assert.equal(
  concatenatedChoiceError([
    { id: 'en', label: 'English' },
    { id: 'auto', label: 'Auto-detect' },
  ]),
  null
);
assert.equal(
  concatenatedChoiceError([{ id: 'from_video', label: 'From video' }]),
  null
);

const fp = askFingerprint('Choose language', [
  { id: 'en' },
  { id: 'auto' },
]);
assert.equal(
  fp,
  askFingerprint('Choose language please', [{ id: 'auto' }, { id: 'en' }])
);

assert.deepEqual(TOOL_META.generate_manim_script.requiresConfirmedFields, [
  'language',
  'orientation',
]);
assert.deepEqual(
  TOOL_META.scaffold_talking_head_project.requiresConfirmedFields,
  ['language', 'cardStyle']
);

assert.deepEqual(
  missingFieldsFromData({}, ['language', 'orientation']),
  ['language', 'orientation']
);
assert.deepEqual(
  missingFieldsFromData({ orientation: 'vertical' }, ['orientation']),
  []
);
assert.deepEqual(
  missingFieldsFromData({ requestedLanguage: 'en' }, ['language', 'orientation']),
  ['orientation']
);
assert.ok(
  missingFieldsFromData({}, TOOL_META.generate_manim_script.requiresConfirmedFields!)
    .includes('orientation'),
  'generate_manim_script blocked when orientation unset'
);

console.log('askMePolicy.selfcheck: ok');
