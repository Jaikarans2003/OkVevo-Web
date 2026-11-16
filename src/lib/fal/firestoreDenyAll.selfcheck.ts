/**
 * Post-cutover Firestore rules must deny all client access.
 * Run: npx tsx src/lib/fal/firestoreDenyAll.selfcheck.ts
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8')
const firebaseJson = fs.readFileSync(path.join(root, 'firebase.json'), 'utf8')

assert.match(rules, /allow read,\s*write:\s*if false/)
assert.match(rules, /match \/\{document=\*\*\}/)
assert.doesNotMatch(rules, /allow create:\s*if true/)
assert.doesNotMatch(rules, /contactSubmissions/)
assert.match(firebaseJson, /"rules":\s*"firestore\.rules"/)

console.log('firestoreDenyAll.selfcheck: ok')
