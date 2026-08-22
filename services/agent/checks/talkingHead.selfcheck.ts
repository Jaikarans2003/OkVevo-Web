/**
 * Talking-head scaffold invariants.
 * Run: npx tsx checks/talkingHead.selfcheck.ts
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SKILLS_DIR } from '../src/skills';
import {
  buildIndexHtml,
  compileDataAnimStatement,
  hostFadeSec,
  loadTalkingHeadLayouts,
  remapSpeakerUrlFromDocs,
  resolveCardLayoutKey,
  resolveLayoutBounds,
  speakerNormalizeGopCommand,
  zoneToCardBounds,
} from '../src/tools/pipeline/talkingHead';
import {
  newScaffoldRunId,
  runHfProjectPrefix,
} from '../src/tools/lib/hfProjectSync';
import { SPEAKER_NORMALIZE_VF } from '../src/tools/lib/utils';

const layouts = loadTalkingHeadLayouts();
const keys = Object.keys(layouts.layouts);
assert.deepEqual(keys.sort(), ['overlay', 'pip', 'split', 'stack'].sort());

for (const key of keys) {
  for (const orientation of ['horizontal', 'vertical'] as const) {
    const b = resolveLayoutBounds(key, orientation, layouts);
    assert(b.video.width > 0 && b.card.width > 0, `${key}/${orientation}`);
    const viaZone = zoneToCardBounds(b.zone, orientation, layouts);
    assert.deepEqual(viaZone, b.card);
  }
}

const stackH = resolveLayoutBounds('stack', 'horizontal', layouts);
assert(
  stackH.card.top < stackH.video.top,
  'stack horizontal: cards top, speaker bottom'
);
const stackV = resolveLayoutBounds('stack', 'vertical', layouts);
assert(
  stackV.card.top < stackV.video.top,
  'stack vertical: cards top, speaker bottom'
);

const raw = fs.readFileSync(
  path.join(SKILLS_DIR, 'talking-head', 'references', 'layouts.json'),
  'utf-8'
);
assert(!/"4:5"|1350/.test(raw), '4:5 must not appear in layouts.json');

const sample = compileDataAnimStatement(
  'card-01',
  { kind: 'fade-in', at: 0.05, duration: 0.4, id: 'kicker' },
  1.05
);
assert.match(sample, /fromTo/);
assert.match(sample, /card-01/);
assert.match(sample, /#kicker/);

const gopCmd = speakerNormalizeGopCommand('/in.mp4', '/out.mp4');
assert.match(gopCmd, /-g 30/);
assert.match(gopCmd, /-keyint_min 30/);
assert.match(
  gopCmd,
  new RegExp(`-vf "${SPEAKER_NORMALIZE_VF.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`)
);
assert(!gopCmd.includes(`-vf ${SPEAKER_NORMALIZE_VF} `), 'unquoted -vf must not appear');

const stylesDir = path.join(SKILLS_DIR, 'talking-head', 'references', 'styles');
const styleFiles = fs.readdirSync(stylesDir).filter((f) => f.endsWith('.html'));
assert.equal(styleFiles.length, 7);

const cjk = /[\u4e00-\u9fff]/;
for (const file of styleFiles) {
  const html = fs.readFileSync(path.join(stylesDir, file), 'utf-8');
  const rootMatch = html.match(/<div class="root">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/);
  const root = (rootMatch?.[1] ?? '').replace(/<!--[\s\S]*?-->/g, '');
  assert.equal(cjk.test(root), false, `${file} has CJK in .root`);

  const hasKeyframes = /@keyframes/.test(html);
  if (file === 'technical.html') {
    assert(hasKeyframes, 'technical.html must keep cursor @keyframes');
  } else {
    assert.equal(hasKeyframes, false, `${file} must not contain @keyframes`);
  }
}

for (const file of ['academic.html', 'minimal.html']) {
  const html = fs.readFileSync(path.join(stylesDir, file), 'utf-8');
  const chars = [...html.matchAll(/<span class="char">([^<]*)<\/span>/g)].map((m) => m[1]);
  assert(chars.some((c) => c.length > 1), `${file} kinetic-chars must be word-split`);
}

const seedHtml = fs.readFileSync(path.join(stylesDir, 'technical.html'), 'utf-8');
const tokenLine = seedHtml.match(/^\s*(bg|ink|accent)\s+#([0-9a-fA-F]{3,8})/m);
assert(tokenLine, 'technical.html must expose token hexes for freeform nearest-seed path');

assert.equal(
  resolveCardLayoutKey({ id: 'c', startSec: 0, endSec: 1, layout: 'stack' }, 'split', 'horizontal', 'minimal'),
  'split'
);
assert.equal(
  resolveCardLayoutKey({ id: 'c', startSec: 0, endSec: 1, layout: 'stack' }, 'split', 'vertical', 'academic'),
  'split'
);
assert.equal(
  resolveCardLayoutKey({ id: 'c', startSec: 0, endSec: 1, layout: 'stack' }, 'split', 'horizontal', 'social'),
  'stack'
);
assert.equal(
  resolveCardLayoutKey({ id: 'c', startSec: 0, endSec: 1, layout: 'pip' }, 'split', 'vertical', 'social'),
  'overlay'
);
assert.equal(
  resolveCardLayoutKey({ id: 'c', startSec: 0, endSec: 1, layout: 'overlay' }, 'split', 'vertical', 'social'),
  'overlay'
);

assert.equal(
  hostFadeSec({
    neighborLayout: 'split',
    currentLayout: 'split',
    gapSec: 0,
  }),
  0
);
assert.equal(
  hostFadeSec({
    neighborLayout: 'split',
    currentLayout: 'split',
    gapSec: 0,
    transition: 'fade',
  }),
  0.12
);
assert.equal(
  hostFadeSec({
    neighborLayout: 'pip',
    currentLayout: 'split',
    gapSec: 0,
  }),
  0
);

const rect = { left: 0, top: 0, width: 100, height: 100 };
const html = buildIndexHtml({
  width: 1920,
  height: 1080,
  duration: 10,
  orientation: 'horizontal',
  speakerSrc: 'https://example.com/v.mp4',
  audioSrc: 'https://example.com/a.mp3',
  cards: [
    {
      id: 'a',
      startSec: 0,
      endSec: 4,
      layoutKey: 'split',
      cardHtml: '<div class="card" data-card-id="a"></div>',
      cardRect: rect,
      videoRect: rect,
    },
    {
      id: 'b',
      startSec: 4,
      endSec: 8,
      layoutKey: 'split',
      cardHtml: '<div class="card" data-card-id="b"></div>',
      cardRect: rect,
      videoRect: rect,
    },
  ],
});
assert.equal(html.includes("duration: 0.4"), false, 'same-layout abutting cards must cut, not fade');
assert.match(html, /tl\.set\('\.card-host\[data-card-id="a"\]', \{ opacity: 1 \}/);

const pipRect = { left: 20, top: 20, width: 40, height: 40 };
const mixed = buildIndexHtml({
  width: 1920,
  height: 1080,
  duration: 10,
  orientation: 'horizontal',
  speakerSrc: 'https://example.com/v.mp4',
  audioSrc: 'https://example.com/a.mp3',
  cards: [
    {
      id: 'a',
      startSec: 0,
      endSec: 4,
      layoutKey: 'split',
      cardHtml: '<div class="card" data-card-id="a"></div>',
      cardRect: rect,
      videoRect: rect,
    },
    {
      id: 'b',
      startSec: 4,
      endSec: 8,
      layoutKey: 'pip',
      cardHtml: '<div class="card" data-card-id="b"></div>',
      cardRect: rect,
      videoRect: pipRect,
      chrome: 'pip-pill',
    },
  ],
});
assert.match(mixed, /blur\(16px\)/);
assert.match(mixed, /duration: 0\.6/);

const overlayHtml = buildIndexHtml({
  width: 1920,
  height: 1080,
  duration: 6,
  orientation: 'horizontal',
  speakerSrc: 'https://example.com/v.mp4',
  audioSrc: 'https://example.com/a.mp3',
  cards: [
    {
      id: 'a',
      startSec: 0,
      endSec: 6,
      layoutKey: 'overlay',
      cardHtml: '<div class="card" data-card-id="a"><div class="root"></div></div>',
      cardRect: rect,
      videoRect: rect,
    },
  ],
});
assert.match(overlayHtml, /blur\(10px\)/);
assert.match(overlayHtml, /data-layout="overlay"/);
assert.match(overlayHtml, /backdrop-filter/);
assert.match(overlayHtml, /background: rgba\(255,255,255,\.18\)/);

const runA = newScaffoldRunId();
const runB = newScaffoldRunId();
assert.notEqual(runA, runB);
assert.notEqual(
  runHfProjectPrefix('u', 's', 'talking-head', runA),
  runHfProjectPrefix('u', 's', 'talking-head', runB)
);
assert.match(
  runHfProjectPrefix('u', 's', 'talking-head', runA),
  /users\/u\/sessions\/s\/runs\/talking-head-[a-f0-9]{8}\/hf-project/
);

assert.equal(
  remapSpeakerUrlFromDocs(
    'https://storage.example/mute.mp4',
    [
      {
        id: 'a1',
        url: 'https://storage.example/mute.mp4',
        contentRole: 'primary-speaker-source',
        metadata: { sourceUrl: 'https://storage.example/original-upload.mp4' },
      },
    ],
    'https://storage.example/session-video.mp4'
  ),
  'https://storage.example/original-upload.mp4',
  'mute role URL remaps via metadata.sourceUrl'
);
assert.equal(
  remapSpeakerUrlFromDocs(
    'https://cdn.example/path/speaker_noaudio-abc.mp4',
    [],
    'https://storage.example/session-video.mp4'
  ),
  'https://storage.example/session-video.mp4',
  'speaker_noaudio path remaps to session videoUrl'
);

console.log('talkingHead.selfcheck: ok');
