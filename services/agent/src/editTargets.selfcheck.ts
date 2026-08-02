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
  resolveEditTargets,
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
  label: 'draft',
  url: 'https://example.com/draft_video.mp4',
  type: 'video',
  key: 'tagged_0',
  localPath: path.join(workdir, 'draft_video.mp4'),
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
const block = formatEditTargetsBlock(tagged);
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

fs.rmSync(workdir, { recursive: true, force: true });
console.log('editTargets.selfcheck: ok');
