/**
 * Run: npx tsx services/agent/src/editTargets.selfcheck.ts
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
  type ResolveEditTargetsResult,
} from './editTargets.ts';
import type { ResolvedTaggedAsset } from './taggedAssets.ts';

const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'edit-targets-'));
const projectDir = path.join(workdir, 'hf-project');
fs.mkdirSync(path.join(projectDir, 'compositions', 'sections'), { recursive: true });
fs.writeFileSync(
  path.join(projectDir, 'index.html'),
  '<div id="stage"></div><div id="speaker-wrap"></div><div id="bg-overlay"></div>\n',
  'utf-8'
);
fs.writeFileSync(
  path.join(projectDir, 'compositions', 'captions-overlay.html'),
  '<div class="hl-group">caps</div>\n',
  'utf-8'
);
fs.writeFileSync(
  path.join(projectDir, 'compositions', 'sections', '01-seg.html'),
  '<section style="background:#000"></section>\n',
  'utf-8'
);
fs.writeFileSync(
  path.join(projectDir, 'COMPOSITION_MANIFEST.json'),
  JSON.stringify({
    segments: [
      {
        file: 'compositions/sections/01-seg.html',
        concept_name: 'The Hidden Problem Discovery',
      },
    ],
  }),
  'utf-8'
);

// FIX 0: tagged draft_video → project_dir + fresh bodies
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
assert.equal(tagged.files.length, 2);
assert.ok(tagged.files.some((f) => f.relative === 'index.html'));
assert.ok(
  tagged.files.some((f) => f.relative === 'compositions/captions-overlay.html')
);
assert.deepEqual(tagged.restoreGeneration, {
  assetId: 'asset_final_2',
  url: 'https://example.com/final_2.mp4',
  label: 'final_2',
});
const block = formatEditTargetsBlock(tagged);
assert.match(block, /restore_generation/);
assert.match(block, /project_dir:/);
assert.match(block, /speaker-wrap/);
assert.match(block, /hl-group/);

// manim tag → script path
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

// FIX 0b cases
assert.deepEqual(classifyEditIntent('Captions should be movie style not karaoke'), [
  'captions',
]);
assert.ok(
  classifyEditIntent('make background dark crimson red').includes('background')
);
assert.ok(
  classifyEditIntent(
    'speaker should become bigger vertical rectangle from 22nd second'
  ).includes('speaker')
);

function intentFiles(message: string): ResolveEditTargetsResult {
  return resolveEditTargets({
    sessionId: 'sess',
    userMessage: message,
    taggedArtifacts: [],
    workdir,
    hasHfProject: true,
  });
}

const caps = intentFiles('Captions should be movie style not karaoke');
assert.equal(caps.files.length, 1);
assert.equal(caps.files[0].relative, 'compositions/captions-overlay.html');

const bg = intentFiles('make background dark crimson red');
assert.ok(bg.files.some((f) => f.relative === 'index.html'));
assert.ok(bg.files.some((f) => f.relative.includes('sections/')));

const sp = intentFiles(
  'speaker should become bigger vertical rectangle from 22nd second'
);
assert.ok(sp.files.some((f) => f.relative === 'index.html'));
// "vertical rectangle" is speaker geometry, not orientation switch
assert.equal(sp.orientationRebuild, undefined);

const amb = intentFiles('make it better');
assert.equal(amb.needsClarification, true);
assert.equal(amb.files.length, 0);
assert.match(formatEditTargetsBlock(amb), /ask_clarification/);

assert.equal(
  looksLikeEditIntent('create an edu-video from scratch', false),
  false,
  'cold pipeline start is not edit intent'
);
assert.ok(looksLikeEditIntent('change the captions color', true));

// Orientation rebuild
assert.equal(parseOrientationTarget('make it vertical'), 'vertical');
assert.equal(parseOrientationTarget('switch to 9:16'), 'vertical');
assert.equal(parseOrientationTarget('change to horizontal'), 'horizontal');
assert.equal(parseOrientationTarget('landscape please'), 'horizontal');
assert.equal(parseOrientationTarget('Make This Into Horizontal Video'), 'horizontal');
assert.equal(parseOrientationTarget('make this into a good video'), null);
assert.equal(parseOrientationTarget('make captions red'), null);

const intoH = intentFiles('Make This Into Horizontal Video');
assert.deepEqual(intoH.orientationRebuild, { target: 'horizontal' });

const orient = intentFiles('make it vertical');
assert.deepEqual(orient.orientationRebuild, { target: 'vertical' });
assert.ok(shouldInjectEditTargets(orient));
const orientBlock = formatEditTargetsBlock(orient, undefined, {
  sessionManimClips: [
    { safeName: 'Foo', clip_url: 'https://storage.example/manim_Foo.mp4' },
  ],
});
assert.match(orientBlock, /Orientation rebuild/);
assert.match(orientBlock, /scaffold_hf_project/);
assert.match(orientBlock, /https:\/\/storage\.example\/manim_Foo\.mp4/);
assert.match(orientBlock, /do NOT auto-regen/i);
assert.doesNotMatch(orientBlock, /--- index\.html/);

// Combined: tagged final + make vertical
const combined = resolveEditTargets({
  sessionId: 'sess',
  userMessage: 'make it vertical',
  taggedArtifacts: [draft],
  workdir,
  hasHfProject: true,
});
assert.ok(combined.restoreGeneration);
assert.deepEqual(combined.orientationRebuild, { target: 'vertical' });
const combinedBlock = formatEditTargetsBlock(combined, undefined, {
  sessionManimClips: [],
});
assert.match(combinedBlock, /restore_generation/);
assert.match(combinedBlock, /Orientation rebuild/);
assert.match(combinedBlock, /target_orientation: vertical/);
assert.match(combinedBlock, /scaffold_hf_project/);
assert.match(combinedBlock, /generate_manim_script/);
assert.match(combinedBlock, /render_manim_clip/);
assert.match(combinedBlock, /do not call/i);
assert.doesNotMatch(combinedBlock, /from the LIVE session/);
assert.match(combinedBlock, /restore_generation return|restored recipe/);

fs.rmSync(workdir, { recursive: true, force: true });
console.log('editTargets.selfcheck: ok');
