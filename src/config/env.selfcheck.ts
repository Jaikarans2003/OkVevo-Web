/**
 * Minimal assert: production mode throws when ALLOWED_ORIGINS / SITE_URL / bucket missing.
 * Run: npm run check:env
 */
import assert from 'node:assert/strict';
import {
  isLocalMode,
  localDefault,
  resolveAllowedOrigins,
  required,
} from './env.ts';

function expectThrow(fn: () => unknown, label: string) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert.equal(threw, true, label);
}

const productionEnv: NodeJS.ProcessEnv = {
  OKVEVO_ENV: 'production',
  NODE_ENV: 'production',
};

assert.equal(isLocalMode(productionEnv), false, 'production is not local');

expectThrow(
  () => resolveAllowedOrigins(productionEnv),
  'ALLOWED_ORIGINS required in production'
);
expectThrow(
  () => localDefault('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000', productionEnv),
  'SITE_URL required in production'
);
expectThrow(
  () => required('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', productionEnv),
  'storage bucket required in production'
);

const localEnv: NodeJS.ProcessEnv = {
  OKVEVO_ENV: 'local',
  NODE_ENV: 'development',
};
assert.deepEqual(resolveAllowedOrigins(localEnv), [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);
assert.equal(
  localDefault('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000', localEnv),
  'http://localhost:3000'
);

const overrideEnv: NodeJS.ProcessEnv = {
  OKVEVO_ENV: 'production',
  NODE_ENV: 'development',
};
assert.equal(
  isLocalMode(overrideEnv),
  false,
  'OKVEVO_ENV=production wins over NODE_ENV=development'
);

console.log('env.selfcheck: ok');
