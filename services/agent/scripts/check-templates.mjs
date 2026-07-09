// Self-check: every {{PLACEHOLDER}} in the edu-video templates must be one the
// scaffold_hf_project code actually substitutes, and the coupled MANIM_GSAP
// placeholder must exist on both sides. Fails loud if template and code drift.
// Run: node scripts/check-templates.mjs
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const templates = path.join(root, 'Skills/edu-video/templates');
const toolsDir = path.join(root, 'services/agent/src/tools');
const hyperframesSrc = fs.readFileSync(path.join(toolsDir, 'edu-video/hyperframes.ts'), 'utf-8');
const utilsSrc = fs.readFileSync(path.join(toolsDir, 'lib/utils.ts'), 'utf-8');

const placeholders = (file) =>
  new Set(
    [...fs.readFileSync(path.join(templates, file), 'utf-8').matchAll(/\{\{([A-Z_]+)\}\}/g)].map(
      (m) => m[1]
    )
  );

// Keys scaffold_hf_project passes to substitutePlaceholders for index-root.html
const indexKeys = new Set([
  'TOTAL_DURATION',
  'SEGMENT_WIRING',
  'MANIM_CLIPS',
  'SPEAKER_GSAP',
  'MANIM_GSAP',
  'LIQUID_GLASS_INIT',
  'TRANSITION_WIRING',
]);
// Keys buildSegmentSection replaces in mode-*.html
const sectionKeys = new Set([
  'SEGMENT_ID',
  'SEGMENT_DURATION',
  'BRAND_CSS_VARS',
  'MODE_GSAP',
  'CATALOG_BLOCK_WIRING',
  'VIZ_GSAP',
]);
const captionKeys = new Set(['CAPTIONS_JSON', 'TOTAL_DURATION', 'BRAND_CSS_VARS']);

const checks = [
  ['index-root.html', indexKeys],
  ['compositions/mode-a.html', sectionKeys],
  ['compositions/mode-c.html', sectionKeys],
  ['compositions/captions-overlay.html', captionKeys],
];

for (const [file, known] of checks) {
  for (const p of placeholders(file)) {
    assert(known.has(p), `${file} has placeholder {{${p}}} the scaffold never substitutes`);
  }
}

// The A3 coupling: template placeholder AND code-side substitution must both exist.
assert(placeholders('index-root.html').has('MANIM_GSAP'), 'index-root.html missing {{MANIM_GSAP}}');
assert(/MANIM_GSAP:\s*manimGsap/.test(hyperframesSrc), 'hyperframes.ts does not substitute MANIM_GSAP');
assert(/function buildManimGsap/.test(utilsSrc), 'utils.ts missing buildManimGsap');
// mode-a must no longer carry per-segment Manim GSAP (moved to root timeline)
assert(
  !utilsSrc.includes("tl.set('#manim-${seg.manim_index}', { autoAlpha: 1, display: 'block' }, 0)"),
  'buildSegmentSection still stamps Manim GSAP into segment sub-compositions'
);

console.log('check-templates: OK');
