/**
 * Ask-Me policy: concatenated choice reject + requiresConfirmedFields gate.
 * Run: npx tsx checks/askMePolicy.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { TOOL_META } from '../src/catalog/manifest';
import {
  canonicalConfirmedField,
  inferredConfirmedField,
  missingFieldsFromData,
  requestedLanguageFromAnswer,
} from '../src/confirmedFields';
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
  ['language', 'styleSeed']
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

assert.deepEqual(
  missingFieldsFromData({ confirmed: { orientation: 'vertical' } }, ['orientation']),
  []
);
assert.deepEqual(
  missingFieldsFromData({ confirmed: { styleSeed: 'minimal' } }, ['styleSeed', 'cardStyle']),
  []
);
assert.deepEqual(
  missingFieldsFromData({ talkingHeadStyle: 'editorial' }, ['styleSeed']),
  []
);
assert.deepEqual(
  missingFieldsFromData({ confirmed: { voice: 'alloy' } }, ['voice']),
  []
);
assert.deepEqual(missingFieldsFromData({}, ['voice']), ['voice']);

assert.equal(canonicalConfirmedField('transcription-language'), 'language');
assert.equal(
  inferredConfirmedField('What language should the cards be in?'),
  'language'
);
assert.equal(inferredConfirmedField('Which palette should I use?'), null);
assert.equal(requestedLanguageFromAnswer('english', 'English'), 'en');
assert.equal(requestedLanguageFromAnswer('spanish', 'Spanish'), 'auto');
assert.deepEqual(
  missingFieldsFromData({ confirmed: { language: 'en' } }, ['language']),
  []
);
assert.deepEqual(
  missingFieldsFromData({ confirmed: { language: 'spanish' } }, ['language']),
  []
);
assert.deepEqual(missingFieldsFromData({}, ['language']), ['language']);

console.log('askMePolicy.selfcheck: ok');
