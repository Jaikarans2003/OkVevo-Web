/**
 * Contact form validation (plain categories only in PR 1).
 * Run: npx tsx src/lib/api/contact.selfcheck.ts
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { CONTACT_CATEGORIES, validateContactInput } from './contact.ts'

assert.deepEqual([...CONTACT_CATEGORIES], ['enterpriseEnquiry', 'problemTicket', 'generalQuery'])

assert.equal(validateContactInput({ category: 'generalQuery', email: '', message: 'hi' }).ok, false)
assert.equal(
  validateContactInput({ category: 'generalQuery', email: 'bad', message: 'hi' }).ok,
  false
)
assert.equal(
  validateContactInput({ category: 'super_org_application', email: 'a@b.co', message: 'hi' }).ok,
  false
)
assert.equal(
  validateContactInput({ category: 'generalQuery', email: 'a@b.co', message: '' }).ok,
  false
)

const ok = validateContactInput({
  category: 'enterpriseEnquiry',
  email: 'a@b.co',
  message: 'Hello',
  whatsapp: '  +1  ',
})
assert.equal(ok.ok, true)
if (ok.ok) {
  assert.equal(ok.value.whatsapp, '+1')
  assert.equal(ok.value.category, 'enterpriseEnquiry')
}

const route = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../app/api/contact/route.ts'),
  'utf8'
)
assert.match(route, /validateContactInput/)
assert.match(route, /insertContactSubmission/)
assert.match(route, /checkRateLimit/)
assert.doesNotMatch(route, /super_org/)

console.log('contact.selfcheck: ok')
