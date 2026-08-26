/**
 * Auto-Run engine: shouldPause + resolveAutoField.
 * Run: npx tsx checks/autonomy.selfcheck.ts
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { resolveAutoField, shouldPause } from '../src/autonomy';
import { loadSkillManifest, validateManifest } from '../src/catalog/manifest';

assert.equal(shouldPause('ask'), true);
assert.equal(shouldPause('auto'), false);

const edu = loadSkillManifest('edu-video');
assert.deepEqual(resolveAutoField(edu, 'orientation', undefined), {
  value: 'horizontal',
});
assert.deepEqual(resolveAutoField(edu, 'orientation', 'vertical'), {
  value: 'vertical',
});
assert.deepEqual(resolveAutoField(edu, 'language', undefined), { value: 'auto' });
assert.deepEqual(resolveAutoField(edu, 'animationStyle', undefined), {
  value: 'moderate',
});

const talking = loadSkillManifest('talking-head');
assert.deepEqual(resolveAutoField(talking, 'language', undefined), {
  value: 'auto',
});
const stylePick = resolveAutoField(talking, 'styleSeed', undefined);
assert.equal('needsModelPick' in stylePick, true);
if ('needsModelPick' in stylePick) {
  assert.ok(stylePick.choices.includes('academic'));
  assert.ok(stylePick.choices.includes('minimal'));
}

assert.throws(
  () =>
    validateManifest(
      {
        id: 'x',
        tools: [],
        confirmedFields: ['orientation'],
        defaults: { orientation: 'diagonal' },
      },
      'x'
    ),
  /defaults.orientation/
);

console.log('autonomy.selfcheck: ok');
