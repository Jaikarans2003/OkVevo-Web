/**
 * Run: npx tsx services/agent/src/tools/lib/ownedEditFiles.selfcheck.ts
 */
import assert from 'node:assert/strict';
import { commandTargetsOwnedEditFile } from './ownedEditFiles.ts';

// Allow: circular-badge overlay ingestion
assert.equal(
  commandTargetsOwnedEditFile(
    'mkdir -p /tmp/okvevo/s/hf-project/capture/assets/images && curl -o /tmp/okvevo/s/hf-project/capture/assets/images/badge.png https://example.com/badge.png'
  ),
  false,
  'capture/assets curl allowed'
);

// Reject: sed on index
assert.equal(
  commandTargetsOwnedEditFile(
    "sed -i 's/foo/bar/' /tmp/okvevo/s/hf-project/index.html"
  ),
  true,
  'sed index.html blocked'
);

// Reject: Python rewrite of section HTML (cac82d4b MSG 7 pattern)
assert.equal(
  commandTargetsOwnedEditFile(
    'python3 -c "import re,pathlib; p=pathlib.Path(\'hf-project/compositions/sections/01-segment-01.html\'); t=p.read_text(); p.write_text(re.sub(r\'crimson\',\'red\',t))"'
  ),
  true,
  'section regex rewrite blocked'
);

// Allow: manim/ffmpeg outside owned paths
assert.equal(
  commandTargetsOwnedEditFile('ffmpeg -i /tmp/in.mp4 /tmp/out.mp4'),
  false,
  'unrelated ffmpeg allowed'
);
assert.equal(
  commandTargetsOwnedEditFile('manim render /tmp/other/Scene.py'),
  false,
  'manim outside manim_scripts allowed'
);

// Reject: manim_scripts path
assert.equal(
  commandTargetsOwnedEditFile(
    "python3 -c \"open('manim_scripts/Foo.py').write('x')\""
  ),
  true,
  'manim_scripts rewrite blocked'
);

console.log('ownedEditFiles.selfcheck: ok');
