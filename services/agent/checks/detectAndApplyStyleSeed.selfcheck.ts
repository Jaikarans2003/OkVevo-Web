/**
 * Style-seed match + resume string (no Firebase).
 * Run: npx tsx checks/detectAndApplyStyleSeed.selfcheck.ts
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { loadSkillManifest } from '../src/catalog/manifest';

const talking = loadSkillManifest('talking-head');
assert.deepEqual(talking.styleSeeds, [
  'academic',
  'editorial',
  'minimal',
  'corporate',
  'technical',
  'whiteboard',
  'social',
]);
assert.match(talking.styleSeedResume ?? '', /\{seed\}/);
assert.match(
  (talking.styleSeedResume ?? '').replaceAll('{seed}', 'social'),
  /social/
);

console.log('detectAndApplyStyleSeed.selfcheck: ok');
