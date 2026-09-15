#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { applyEnvOverrides, leftoverPlaceholders, parseArgs, PLACEHOLDER, renderApphosting } from './render-apphosting.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

assert.deepEqual(parseArgs(['--env', 'staging', '--dry-run']), {
  env: 'staging',
  dryRun: true,
  checkOnly: false
})

const sample = `env:
  - variable: NEXT_PUBLIC_SITE_URL
    value: https://old.example
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: ${PLACEHOLDER}
`
const overlaid = applyEnvOverrides(sample, {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'AIza-live',
  NEXT_PUBLIC_SITE_URL: 'https://www.okvevo.com'
})
assert.match(overlaid, /value: AIza-live/)
assert.match(overlaid, /value: https:\/\/www\.okvevo\.com/)
assert.deepEqual(leftoverPlaceholders(sample), ['NEXT_PUBLIC_FIREBASE_API_KEY'])
assert.deepEqual(leftoverPlaceholders(overlaid), [])

const staging = renderApphosting({ envName: 'staging', root: ROOT })
assert.match(staging, /OKVEVO_ENV/)
assert.match(staging, /okvevo-testing/)
assert.doesNotMatch(staging, new RegExp(`value: ${PLACEHOLDER}`))

const production = renderApphosting({ envName: 'production', env: {}, root: ROOT })
assert.match(production, /variable: OKVEVO_ENV[\s\S]*?value: production/)
assert.match(production, /text2video-16cbf/)
assert.match(production, /www\.okvevo\.com/)
assert.doesNotMatch(production, new RegExp(`value: ${PLACEHOLDER}`))
assert.match(production, /secret: RAZORPAY_KEY_SECRET/)

const blocked = fs.mkdtempSync(path.join(os.tmpdir(), 'apphosting-blocked-'))
fs.writeFileSync(
  path.join(blocked, 'apphosting.production.yaml'),
  `env:\n  - variable: NEXT_PUBLIC_RAZORPAY_KEY_ID\n    value: ${PLACEHOLDER}\n`
)
assert.throws(
  () => renderApphosting({ envName: 'production', env: {}, root: blocked }),
  /CHANGE_ME/
)
fs.rmSync(blocked, { recursive: true, force: true })

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apphosting-render-'))
for (const name of ['apphosting.staging.yaml', 'apphosting.production.yaml']) {
  fs.copyFileSync(path.join(ROOT, name), path.join(tmp, name))
}
const filled = renderApphosting({
  envName: 'production',
  root: tmp,
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: 'AIza-prod',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:123:web:abc',
    NEXT_PUBLIC_RAZORPAY_KEY_ID: 'rzp_live_x',
    RAZORPAY_STARTER_PLAN_ID: 'plan_live_1',
    RAZORPAY_STARTER_ANNUAL_PLAN_ID: 'plan_live_2',
    RAZORPAY_PRO_PLAN_ID: 'plan_live_3',
    RAZORPAY_PRO_ANNUAL_PLAN_ID: 'plan_live_4',
    RAZORPAY_MAX_PLAN_ID: 'plan_live_5',
    RAZORPAY_MAX_ANNUAL_PLAN_ID: 'plan_live_6',
    RAZORPAY_INR_STARTER_PLAN_ID: 'plan_live_7',
    RAZORPAY_INR_STARTER_ANNUAL_PLAN_ID: 'plan_live_8',
    RAZORPAY_INR_PRO_PLAN_ID: 'plan_live_9',
    RAZORPAY_INR_PRO_ANNUAL_PLAN_ID: 'plan_live_10',
    RAZORPAY_INR_MAX_PLAN_ID: 'plan_live_11',
    RAZORPAY_INR_MAX_ANNUAL_PLAN_ID: 'plan_live_12'
  }
})
assert.match(filled, /variable: OKVEVO_ENV[\s\S]*?value: production/)
assert.match(filled, /www\.okvevo\.com/)
assert.doesNotMatch(filled, new RegExp(`value: ${PLACEHOLDER}`))
assert.match(filled, /secret: RAZORPAY_KEY_SECRET/)

fs.rmSync(tmp, { recursive: true, force: true })
console.log('render-apphosting.selfcheck: ok')
