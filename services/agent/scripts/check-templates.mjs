// Self-check: every {{PLACEHOLDER}} in the edu-video templates must be one the
// scaffold_hf_project code actually substitutes, and the coupled MANIM_GSAP
// placeholder must exist on both sides. Fails loud if template and code drift.
// Run: node scripts/check-templates.mjs
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const templatesRoot = path.join(root, 'Skills/edu-video/templates');
const toolsDir = path.join(root, 'services/agent/src/tools');
const hyperframesSrc = fs.readFileSync(path.join(toolsDir, 'pipeline/hyperframes.ts'), 'utf-8');
const utilsSrc = fs.readFileSync(path.join(toolsDir, 'lib/utils.ts'), 'utf-8');

const placeholders = (orient, file) =>
  new Set(
    [
      ...fs
        .readFileSync(path.join(templatesRoot, orient, file), 'utf-8')
        .matchAll(/\{\{([A-Z_]+)\}\}/g),
    ].map((m) => m[1])
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
const captionKeys = new Set([
  'CAPTIONS_JSON',
  'TOTAL_DURATION',
  'BRAND_CSS_VARS',
  'CAPTION_POS_GSAP',
]);

const checks = [
  ['index-root.html', indexKeys],
  ['compositions/mode-a.html', sectionKeys],
  ['compositions/mode-c.html', sectionKeys],
  ['compositions/captions-overlay.html', captionKeys],
];

const orientations = fs
  .readdirSync(templatesRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'shared')
  .map((d) => d.name);

assert(orientations.includes('horizontal'), 'templates/horizontal/ missing');

for (const orient of orientations) {
  for (const [file, known] of checks) {
    const filePath = path.join(templatesRoot, orient, file);
    assert(fs.existsSync(filePath), `${orient}/${file} missing`);
    for (const p of placeholders(orient, file)) {
      assert(
        known.has(p),
        `${orient}/${file} has placeholder {{${p}}} the scaffold never substitutes`
      );
    }
  }
  assert(
    placeholders(orient, 'index-root.html').has('MANIM_GSAP'),
    `${orient}/index-root.html missing {{MANIM_GSAP}}`
  );
  // Cloud lint: project root is base URL — no parent-traversal asset paths
  const captionsHtml = fs.readFileSync(
    path.join(templatesRoot, orient, 'compositions/captions-overlay.html'),
    'utf-8'
  );
  assert(
    !/url\(['"]?\.\.\//.test(captionsHtml),
    `${orient}/captions-overlay.html must use root-relative assets/…, not ../assets/`
  );
  const indexRootFit = fs.readFileSync(
    path.join(templatesRoot, orient, 'index-root.html'),
    'utf-8'
  );
  assert(
    /#manim-wrap\s+video\s*\{[^}]*object-fit:\s*contain/s.test(indexRootFit),
    `${orient}/index-root.html #manim-wrap video must use object-fit: contain`
  );
  if (orient === 'vertical') {
    const indexRoot = fs.readFileSync(
      path.join(templatesRoot, orient, 'index-root.html'),
      'utf-8'
    );
    assert(
      /const FS = \{[^;]*width:\s*1080,\s*height:\s*1920/.test(indexRoot) ||
        /const FS = \{[^;]*borderRadius:\s*0/.test(indexRoot),
      'vertical/index-root.html FS must be edge-to-edge (1080×1920 or borderRadius: 0)'
    );
    assert(
      placeholders(orient, 'compositions/captions-overlay.html').has('CAPTION_POS_GSAP'),
      'vertical/captions-overlay.html missing {{CAPTION_POS_GSAP}}'
    );
  }
}

assert(
  /function buildCaptionPosGsap/.test(utilsSrc),
  'utils.ts missing buildCaptionPosGsap'
);
assert(
  /CAPTION_POS_GSAP:\s*captionPosGsap/.test(hyperframesSrc),
  'hyperframes.ts does not substitute CAPTION_POS_GSAP'
);

assert(/MANIM_GSAP:\s*manimGsap/.test(hyperframesSrc), 'hyperframes.ts does not substitute MANIM_GSAP');
assert(/function buildManimGsap/.test(utilsSrc), 'utils.ts missing buildManimGsap');
assert(
  !utilsSrc.includes("tl.set('#manim-${seg.manim_index}', { autoAlpha: 1, display: 'block' }, 0)"),
  'buildSegmentSection still stamps Manim GSAP into segment sub-compositions'
);

console.log(`check-templates: OK (${orientations.join(', ')})`);
