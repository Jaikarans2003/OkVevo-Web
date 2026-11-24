/**
 * Customer model labels. No database.
 * Run: npx tsx src/lib/gateway/customerModel.selfcheck.ts
 */
import assert from 'node:assert/strict'

import { acceptedRequestedModel, customerModel } from '@/lib/gateway/modelCatalog'

const cost = customerModel({
  requestedModel: 'okvevo/auto-cost',
  model: 'anthropic/claude-sonnet-5',
  provider: 'openrouter',
})
assert.equal(cost.label, 'Auto · Cost-effective')
assert.equal(cost.jobType, 'Chat')

const oldAuto = customerModel({
  requestedModel: null,
  model: 'openrouter/auto-beta',
  provider: 'openrouter',
})
assert.equal(oldAuto.label, 'Auto')

const seedanceA = customerModel({
  requestedModel: 'bytedance/seedance-2.0/text-to-video',
  provider: 'fal',
})
const seedanceB = customerModel({
  requestedModel: 'bytedance/seedance-2.0/image-to-video',
  provider: 'fal',
})
assert.equal(seedanceA.label, 'Seedance 2.0')
assert.equal(seedanceB.label, seedanceA.label)
assert.equal(seedanceA.jobType, 'Video')

const named = customerModel({
  requestedModel: 'anthropic/claude-sonnet-5',
  provider: 'openrouter',
  catalogName: () => 'Anthropic: Claude Sonnet 5',
})
assert.equal(named.label, 'Claude Sonnet 5')

const unknown = customerModel({
  requestedModel: 'acme/weird-model',
  provider: 'openrouter',
})
assert.equal(unknown.label, 'Weird Model')
assert.equal(unknown.label.includes('openrouter'), false)
assert.equal(unknown.label.toLowerCase().includes('fal-ai'), false)

const search = customerModel({ requestedModel: 'tavily-search', provider: 'tavily' })
assert.equal(search.label, 'Web search')
assert.equal(search.jobType, 'Search')

assert.equal(
  acceptedRequestedModel('okvevo/auto-cost', 'openrouter/auto-beta'),
  'okvevo/auto-cost'
)
assert.equal(acceptedRequestedModel('okvevo/auto-cost', 'anthropic/claude-sonnet-5'), null)
assert.equal(acceptedRequestedModel('not-auto', 'openrouter/auto-beta'), null)

console.log('customerModel.selfcheck: ok')
