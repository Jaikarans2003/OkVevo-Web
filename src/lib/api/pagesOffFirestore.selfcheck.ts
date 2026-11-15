/**
 * Portal pages must not use the Firestore client SDK.
 * Run: npx tsx src/lib/api/pagesOffFirestore.selfcheck.ts
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function src(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

const surfaces = [
  'app/billing/[[...slug]]/page.tsx',
  'app/profile/page.tsx',
  'components/shared/AuthForm.tsx',
  'components/shared/ContactUsModal.tsx',
  'hooks/useAuth.ts',
  'services/CreditsService.ts',
  'config/firebase.ts',
]

for (const rel of surfaces) {
  const text = src(rel)
  assert.doesNotMatch(text, /firebase\/firestore/, `${rel} must not import firestore`)
  assert.doesNotMatch(text, /onSnapshot/, `${rel} must not use onSnapshot`)
  assert.doesNotMatch(text, /createUserProfile/, `${rel} must not call createUserProfile`)
}

assert.match(src('services/CreditsService.ts'), /\/api\/billing\/summary/)
assert.match(src('hooks/useAuth.ts'), /\/api\/me/)
assert.match(src('components/shared/ContactUsModal.tsx'), /\/api\/contact/)
assert.match(src('app/profile/page.tsx'), /method: 'PATCH'/)
assert.ok(!fs.existsSync(path.join(root, 'app/api/auth/desktop/custom-token/route.ts')))
assert.ok(!fs.existsSync(path.join(root, 'lib/agent')))

console.log('pagesOffFirestore.selfcheck: ok')
