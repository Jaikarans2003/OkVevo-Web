import assert from 'node:assert/strict';
import { parseBrandColorsFromText, DEFAULT_BRAND_COLORS } from './utils.ts';

function main() {
  assert.deepEqual(parseBrandColorsFromText('#fff'), {
    primary: '#ffffff',
    accent: '#ffffff',
    bg_dark: DEFAULT_BRAND_COLORS.bg_dark,
  });
  assert.deepEqual(parseBrandColorsFromText('primary #112233 secondary #aabbcc'), {
    primary: '#112233',
    accent: '#aabbcc',
    bg_dark: DEFAULT_BRAND_COLORS.bg_dark,
  });
  assert.equal(parseBrandColorsFromText(''), null);
  console.log('parseBrandColorsFromText.selfcheck: ok');
}

main();
