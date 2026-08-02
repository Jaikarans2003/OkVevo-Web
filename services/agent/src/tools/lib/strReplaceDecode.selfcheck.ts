/**
 * Run: npx tsx services/agent/src/tools/lib/strReplaceDecode.selfcheck.ts
 */
import assert from 'node:assert/strict';
import {
  decodeModelStringEscapes,
  pickStrReplacePair,
} from './strReplaceDecode.ts';

assert.equal(decodeModelStringEscapes('a\\nb'), 'a\nb');
assert.equal(decodeModelStringEscapes('a\\tb\\rc'), 'a\tb\rc');

const html = '<div class="cap">\n  Hello\n</div>\n';

// Literal `\n` from model → decode path matches once
const litOld = '<div class="cap">\\n  Hello\\n</div>';
const litNew = '<div class="cap">\\n  Hi\\n</div>';
const decoded = pickStrReplacePair(html, litOld, litNew);
assert.equal(decoded.matches, 1, 'literal \\n old_string matches after decode');
assert.equal(decoded.old_string, '<div class="cap">\n  Hello\n</div>');
assert.equal(decoded.new_string, '<div class="cap">\n  Hi\n</div>');
const after = html.replace(decoded.old_string, decoded.new_string);
assert.equal(after, '<div class="cap">\n  Hi\n</div>\n');

// Real newlines unchanged
const real = pickStrReplacePair(html, '<div class="cap">\n  Hello\n</div>', 'X');
assert.equal(real.matches, 1);
assert.equal(real.old_string, '<div class="cap">\n  Hello\n</div>');

// Python-style file with intentional literal `\n` — exact match wins, no forced decode
const py = 'print("line1\\nline2")\n';
const pyPair = pickStrReplacePair(py, 'print("line1\\nline2")', 'print("ok")');
assert.equal(pyPair.matches, 1, 'exact literal \\n in Python preserved');
assert.equal(pyPair.old_string, 'print("line1\\nline2")');

console.log('strReplaceDecode.selfcheck: ok');
