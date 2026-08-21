/**
 * Talking-head scaffold invariants.
 * Run: npx tsx src/tools/pipeline/talkingHead.selfcheck.ts
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SKILLS_DIR } from '../../skills';
import {
  buildTalkingHeadPrefQuestions,
  nearestTalkingHeadStyle,
  selfcheckTalkingHeadFrontLoad,
  STYLE_ORIENTATION_HINT,
  TALKING_HEAD_STYLE_IDS,
} from '../../skills/talkingHead/prePipelineCheckpoint';
import {
  compileDataAnimStatement,
  loadTalkingHeadLayouts,
  resolveLayoutBounds,
  speakerNormalizeGopCommand,
  zoneToCardBounds,
} from './talkingHead';
import { SPEAKER_NORMALIZE_VF } from '../lib/utils';

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
// VF must stay double-quoted so shell does not strip scale='min(1920,iw)'
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

selfcheckTalkingHeadFrontLoad();

// Freeform path: nearest seed → that seed's token set must still be the structure base.
const freeformBrief = 'dark terminal code vibe for developers';
const seed = nearestTalkingHeadStyle(freeformBrief);
assert.equal(seed, 'technical');
const seedHtml = fs.readFileSync(path.join(stylesDir, `${seed}.html`), 'utf-8');
const tokenLine = seedHtml.match(/^\s*(bg|ink|accent)\s+#([0-9a-fA-F]{3,8})/m);
assert(tokenLine, `${seed}.html must expose token hexes for freeform nearest-seed path`);
assert.equal(STYLE_ORIENTATION_HINT[seed], '16:9');
assert.deepEqual(
  [...TALKING_HEAD_STYLE_IDS],
  buildTalkingHeadPrefQuestions({}, {})
    .find((q) => q.id === 'card_style')!
    .choices!.map((c) => c.id)
);

console.log('talkingHead.selfcheck: ok');
