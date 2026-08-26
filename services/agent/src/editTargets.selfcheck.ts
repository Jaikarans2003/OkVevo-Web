/**
 * Run: npx tsx src/editTargets.selfcheck.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  classifyEditIntent,
  classifyTaggedForEdit,
  formatEditTargetsBlock,
  looksLikeEditIntent,
  parseOrientationTarget,
  resolveEditTargets,
  shouldInjectEditTargets,
} from './editTargets.ts';
import type { ResolvedTaggedAsset } from './taggedAssets.ts';

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'edit-targets-'));
const projectDir = path.join(workdir, 'hf-project');
fs.mkdirSync(path.join(projectDir, 'compositions', 'sections'), { recursive: true });
fs.writeFileSync(path.join(projectDir, 'index.html'), '<div id="stage"></div>\n', 'utf-8');

const draft: ResolvedTaggedAsset = {
  id: 'asset_final_2',
  label: 'final_2',
  url: 'https://example.com/final_2.mp4',
  type: 'video',
  key: 'tagged_0',
  localPath: path.join(workdir, 'final_2.mp4'),
};
assert.deepEqual(classifyTaggedForEdit(draft, workdir), { kind: 'draft_final' });

const tagged = resolveEditTargets({
  sessionId: 'sess',
  userMessage: 'make speaker bigger',
  taggedArtifacts: [draft],
  workdir,
  hasHfProject: true,
});
assert.equal(tagged.files.length, 0);
assert.deepEqual(tagged.restoreGeneration, {
  assetId: 'asset_final_2',
  url: 'https://example.com/final_2.mp4',
  label: 'final_2',
});
assert.ok(shouldInjectEditTargets(tagged));
const taggedBlock = formatEditTargetsBlock(tagged);
assert.match(taggedBlock, /Tagged past final/);
assert.doesNotMatch(taggedBlock, /scaffold_hf_project/);
assert.doesNotMatch(taggedBlock, /generate_manim_script/);

const manim: ResolvedTaggedAsset = {
  label: 'clip',
  url: 'https://example.com/manim/Foo_Bar.mp4',
  type: 'video',
  key: 'tagged_1',
  localPath: path.join(workdir, 'manim', 'Foo_Bar.mp4'),
};
assert.deepEqual(classifyTaggedForEdit(manim, workdir), {
  kind: 'manim',
  safeName: 'Foo_Bar',
});

assert.deepEqual(classifyEditIntent('Captions should be movie style not karaoke'), [
  'captions',
]);

function intentFiles(message: string) {
  return resolveEditTargets({
    sessionId: 'sess',
    userMessage: message,
    taggedArtifacts: [],
    workdir,
    hasHfProject: true,
  });
}

const caps = intentFiles('Captions should be movie style not karaoke');
assert.equal(caps.files.length, 0);
assert.equal(caps.needsClarification, false);
assert.equal(shouldInjectEditTargets(caps), false);

const playbookBlock = formatEditTargetsBlock(caps, undefined, {
  editConfig: {
    editGuidance: '../shared/hyperframes-prompting-vocabulary.md',
    editTargets: 'references/edit-requests.md',
  },
  skillDir: '/tmp/skill',
});
assert.match(playbookBlock, /edit guidance/);
assert.match(playbookBlock, /revision playbook/);
assert.doesNotMatch(playbookBlock, /scaffold_hf_project/);

const amb = intentFiles('make it better');
assert.equal(amb.needsClarification, true);
assert.match(formatEditTargetsBlock(amb), /ask_clarification/);

assert.equal(
  looksLikeEditIntent('create an edu-video from scratch', false),
  false
);
assert.ok(looksLikeEditIntent('change the captions color', true));

assert.equal(parseOrientationTarget('make it vertical'), 'vertical');
const orient = intentFiles('make it vertical');
assert.deepEqual(orient.orientationRebuild, { target: 'vertical' });
assert.ok(shouldInjectEditTargets(orient));
assert.doesNotMatch(formatEditTargetsBlock(orient), /scaffold_hf_project/);
assert.doesNotMatch(formatEditTargetsBlock(orient), /generate_manim_script/);

fs.rmSync(workdir, { recursive: true, force: true });
console.log('editTargets.selfcheck: ok');
