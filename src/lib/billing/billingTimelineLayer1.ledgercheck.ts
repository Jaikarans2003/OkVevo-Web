/**
 * Billing timeline Layer 1 (plan §14.2, picked up by `npm run test:ledger`).
 *
 * Signed Razorpay webhook fixtures replayed through the REAL webhook route
 * (`src/app/api/razorpay/webhook/route.ts`) and, where the scenario is
 * route-initiated (upgrade/downgrade/cancel), through the REAL billing
 * routes — against LOCAL Supabase. The Razorpay SDK transport and Firebase
 * ID-token verification are mocked in-process (see `layer1Harness.ts`); no
 * network call ever leaves this machine and no prod/live key is used.
 *
 * Run: npx supabase db reset && DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *   npx tsx src/lib/billing/billingTimelineLayer1.ledgercheck.ts
 * (or just `npm run test:ledger`, which resets nothing itself — run
 * `npx supabase db reset` first if the schema may be stale.)
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
// Dummy, never-real Razorpay credentials. The Razorpay SDK requires a
// truthy key_id to construct, and `RAZORPAY_CONFIG` freezes these at
// `config/razorpay.ts` import time — must be set before any route imports it.
process.env.RAZORPAY_KEY_ID ??= 'rzp_test_layer1_dummy'
process.env.RAZORPAY_KEY_SECRET ??= 'layer1_dummy_key_secret'
process.env.RAZORPAY_WEBHOOK_SECRET ??= 'layer1_dummy_webhook_secret'
// Lets firebase-admin initialize without a real service account; verifyIdToken
// itself is monkey-patched below and never makes a real call either way.
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:9099'

const { sql } = await import('@/lib/db/client')
const { ensureUserAndBilling, updateBillingByUserId, getBillingByUserId, getRazorpaySubscription } =
  await import('@/lib/db/wallet')
const {
  installRazorpayApiMock,
  installFirebaseAuthMock,
  resetRazorpayCalls,
  razorpayCalls,
  setClock,
  restoreClock,
  postWebhook,
  callBillingRoute,
  getBillingSummary,
} = await import('@/lib/billing/layer1Harness')
const {
  subscriptionActivatedPayload,
  subscriptionChargedPayload,
  subscriptionUpdatedPayload,
  subscriptionStatusPayload,
  paymentCapturedAddCreditsPayload,
} = await import('@/lib/billing/__fixtures__/razorpayEvents')
const { SUBSCRIPTION_PLANS, getRazorpayPlanId } = await import('@/config/razorpay')
const { allocationCreditDelta, proratedCreditGrant } = await import('@/lib/billing/planChange')
const { remainingPct, additionalRemainingPct } = await import('@/types/credits')
const { isUpdatablePlanStatus } = await import('@/lib/billing/userSoT')

await installRazorpayApiMock()
await installFirebaseAuthMock()

const BASE_NOW = '2027-03-15T00:00:00.000Z'
const BASE_NOW_UNIX = Math.floor(new Date(BASE_NOW).getTime() / 1000)
const MONTH = 30 * 24 * 60 * 60

const CREDITS = {
  starter: SUBSCRIPTION_PLANS.starter.creditsIncluded,
  pro: SUBSCRIPTION_PLANS.pro.creditsIncluded,
  max: SUBSCRIPTION_PLANS.max.creditsIncluded,
} as const

let seq = 0
function uid(tag: string): string {
  seq += 1
  return `l1-${tag}-${Date.now().toString(16)}-${seq}`
}

async function seedBilling(id: string, patch: Record<string, unknown>): Promise<void> {
  await ensureUserAndBilling(sql, id)
  await updateBillingByUserId(sql, id, patch)
}

async function grantRows(id: string): Promise<Array<Record<string, unknown>>> {
  const billing = await getBillingByUserId(sql, id)
  if (!billing) return []
  const rows = await sql`
    select bucket, amount, mode, reason, request_id
    from credit_transactions
    where billing_account_id = ${billing.id} and type = 'grant'
    order by created_at asc
  `
  return rows as unknown as Array<Record<string, unknown>>
}

const UPGRADE_PAIRS: Array<['starter' | 'pro', 'pro' | 'max']> = [
  ['starter', 'pro'],
  ['starter', 'max'],
  ['pro', 'max'],
]
const DOWNGRADE_PAIRS: Array<['pro' | 'max', 'starter' | 'pro']> = [
  ['pro', 'starter'],
  ['max', 'pro'],
  ['max', 'starter'],
]

type Scenario = { name: string; fn: () => Promise<void> }
const scenarios: Scenario[] = []
function scenario(name: string, fn: () => Promise<void>): void {
  scenarios.push({ name, fn })
}

// ---------------------------------------------------------------------------
// 1. Buy
// ---------------------------------------------------------------------------
scenario('buy: plan credits granted once, entitled until current_period_end', async () => {
  const id = uid('buy')
  const subId = `sub_${id}`
  resetRazorpayCalls()
  const { status, json } = await postWebhook({
    eventType: 'subscription.activated',
    payload: subscriptionActivatedPayload({
      subscriptionId: subId,
      userId: id,
      planType: 'starter',
      currentStart: BASE_NOW_UNIX,
      currentEnd: BASE_NOW_UNIX + MONTH,
      paymentMethod: 'card',
    }),
  })
  assert.equal(status, 200, JSON.stringify(json))

  const billing = await getBillingByUserId(sql, id)
  assert.equal(billing?.plan, 'starter')
  assert.equal(billing?.planStatus, 'active')
  assert.equal(billing?.allocationBalance, CREDITS.starter)
  assert.equal(billing?.allocationGrantedTotal, CREDITS.starter)
  assert.equal(billing?.razorpaySubscriptionId, subId)

  const grants = await grantRows(id)
  assert.equal(grants.length, 1, 'plan credits must be granted exactly once')
  assert.equal(Number(grants[0].amount), CREDITS.starter)
  assert.equal(grants[0].bucket, 'allocation')

  const summary = await getBillingSummary(id)
  assert.equal(summary.status, 200)
  assert.equal(summary.json.entitled, true)
  assert.equal(summary.json.remainingPct, 100)
  assert.equal(summary.json.additionalPct, 0)
})

// ---------------------------------------------------------------------------
// 2. Renewal
// ---------------------------------------------------------------------------
scenario('renew: subscription.charged SETs allocation; additional untouched', async () => {
  const id = uid('renew')
  const subId = `sub_${id}`
  await seedBilling(id, {
    plan: 'starter',
    planName: 'Starter',
    planStatus: 'active',
    billingCycle: 'monthly',
    currency: 'USD',
    razorpaySubscriptionId: subId,
    creditsIncluded: CREDITS.starter,
    allocationBalance: 1234, // partially spent
    allocationGrantedTotal: CREDITS.starter,
    topUpBalance: 300,
    topUpPurchasedTotal: 1000,
    currentPeriodEnd: new Date((BASE_NOW_UNIX + MONTH) * 1000),
    nextAllocationDate: new Date((BASE_NOW_UNIX - 60) * 1000), // already due, relative to the clock set below
  })

  setClock(BASE_NOW) // refreshAllocationIfDue reads `now = new Date()` with no explicit arg
  const { status } = await postWebhook({
    eventType: 'subscription.charged',
    payload: subscriptionChargedPayload({
      subscriptionId: subId,
      userId: id,
      planType: 'starter',
      currentStart: BASE_NOW_UNIX + MONTH,
      currentEnd: BASE_NOW_UNIX + 2 * MONTH,
      paymentMethod: 'card',
    }),
  })
  assert.equal(status, 200)

  const billing = await getBillingByUserId(sql, id)
  assert.equal(billing?.allocationBalance, CREDITS.starter, 'renewal SETs allocation to plan credits')
  assert.equal(billing?.topUpBalance, 300, 'additional credits untouched by renewal')

  const summary = await getBillingSummary(id)
  assert.equal(summary.json.remainingPct, 100)
  assert.equal(summary.json.additionalPct, 30) // 300/1000
})

// ---------------------------------------------------------------------------
// 3. Cancel — real cancel-subscription route, then the cycle-end webhook
// ---------------------------------------------------------------------------
scenario('cancel: cycle-end cancel via route, then webhook — no grace after period end', async () => {
  const id = uid('cancel')
  const subId = `sub_${id}`
  const periodEnd = BASE_NOW_UNIX + 10 * 24 * 60 * 60
  await seedBilling(id, {
    plan: 'pro',
    planStatus: 'active',
    razorpaySubscriptionId: subId,
    paymentMethod: 'card',
    creditsIncluded: CREDITS.pro,
    allocationBalance: CREDITS.pro,
    allocationGrantedTotal: CREDITS.pro,
    currentPeriodEnd: new Date(periodEnd * 1000),
  })

  setClock(BASE_NOW)
  resetRazorpayCalls()
  const { status, json } = await callBillingRoute(
    (await import('@/app/api/razorpay/cancel-subscription/route')).POST,
    id
  )
  assert.equal(status, 200, JSON.stringify(json))
  const cancelCall = razorpayCalls.find((c) => c.method === 'post' && c.url === `/subscriptions/${subId}/cancel`)
  assert.ok(cancelCall, 'cancel-subscription route must call Razorpay cancel')
  assert.deepEqual(cancelCall!.data, { cancel_at_cycle_end: 1 })

  let billing = await getBillingByUserId(sql, id)
  assert.equal(billing?.cancelAtPeriodEnd, true)

  let summary = await getBillingSummary(id)
  assert.equal(summary.json.entitled, true, 'still usable until period end')

  // Cycle end arrives: Razorpay sends subscription.cancelled.
  setClock(new Date((periodEnd + 3600) * 1000))
  const webhookRes = await postWebhook({
    eventType: 'subscription.cancelled',
    payload: subscriptionStatusPayload({
      subscriptionId: subId,
      userId: id,
      planType: 'pro',
      status: 'cancelled',
      currentStart: BASE_NOW_UNIX,
      currentEnd: periodEnd,
    }),
  })
  assert.equal(webhookRes.status, 200)

  billing = await getBillingByUserId(sql, id)
  assert.equal(billing?.planStatus, 'cancelled')
  assert.equal(billing?.cancelAtPeriodEnd, false)

  summary = await getBillingSummary(id)
  assert.equal(summary.json.entitled, false, 'no spending after cancellation — no grace')
  restoreClock()
})

// ---------------------------------------------------------------------------
// 4. Upgrade, card — exact Razorpay update() arguments, every upgrade pair
// ---------------------------------------------------------------------------
for (const [from, to] of UPGRADE_PAIRS) {
  scenario(`upgrade card ${from}->${to}: exact Razorpay update() args`, async () => {
    const id = uid(`upc-${from}-${to}`)
    const subId = `sub_${id}`
    await seedBilling(id, {
      plan: from,
      planStatus: 'active',
      billingCycle: 'monthly',
      currency: 'USD',
      razorpaySubscriptionId: subId,
      paymentMethod: 'card',
      creditsIncluded: CREDITS[from],
      allocationBalance: CREDITS[from],
      allocationGrantedTotal: CREDITS[from],
      currentPeriodEnd: new Date((BASE_NOW_UNIX + MONTH) * 1000),
    })

    setClock(BASE_NOW)
    resetRazorpayCalls()
    const { status, json } = await callBillingRoute(
      (await import('@/app/api/razorpay/update-subscription/route')).POST,
      id,
      { newPlanType: to, newBillingPeriod: 'monthly' }
    )
    assert.equal(status, 200, JSON.stringify(json))
    assert.equal(json.scheduleChangeAt, 'now')

    const updateCall = razorpayCalls.find((c) => c.method === 'patch')
    assert.ok(updateCall, 'update route must call Razorpay subscriptions.update')
    assert.equal(updateCall!.url, `/subscriptions/${subId}`)
    assert.deepEqual(updateCall!.data, {
      plan_id: getRazorpayPlanId(to, 'monthly', 'USD'),
      schedule_change_at: 'now',
      customer_notify: 1,
    })
    restoreClock()
  })
}

// ---------------------------------------------------------------------------
// 5. Upgrade, card — proration day1/mid/last, every upgrade pair
// ---------------------------------------------------------------------------
for (const [from, to] of UPGRADE_PAIRS) {
  for (const [label, offset] of [
    ['day1', 0],
    ['mid', Math.floor(MONTH / 2)],
    ['last', MONTH - 3600],
  ] as const) {
    scenario(`upgrade card proration ${from}->${to} @ ${label}`, async () => {
      const id = uid(`upp-${from}-${to}-${label}`)
      const subId = `sub_${id}`
      const currentStart = BASE_NOW_UNIX
      const currentEnd = BASE_NOW_UNIX + MONTH
      const createdAt = currentStart + offset

      await seedBilling(id, {
        plan: from,
        planStatus: 'active',
        billingCycle: 'monthly',
        currency: 'USD',
        razorpaySubscriptionId: subId,
        paymentMethod: 'card',
        creditsIncluded: CREDITS[from],
        allocationBalance: CREDITS[from],
        allocationGrantedTotal: CREDITS[from],
        currentPeriodEnd: new Date(currentEnd * 1000),
      })

      const delta = allocationCreditDelta(CREDITS[from], CREDITS[to])
      const expectedGrant = proratedCreditGrant(delta, currentEnd - createdAt, currentEnd - currentStart)

      const { status } = await postWebhook({
        eventType: 'subscription.updated',
        createdAt,
        payload: subscriptionUpdatedPayload({
          subscriptionId: subId,
          userId: id,
          planType: to,
          currentStart,
          currentEnd,
          hasScheduledChanges: false,
        }),
      })
      assert.equal(status, 200)

      const billing = await getBillingByUserId(sql, id)
      assert.equal(billing?.plan, to)
      assert.equal(
        billing?.allocationBalance,
        CREDITS[from] + expectedGrant,
        `${from}->${to} @ ${label}: grant must equal proratedCreditGrant(delta=${delta}, remaining=${
          currentEnd - createdAt
        }, period=${currentEnd - currentStart}) = ${expectedGrant}`
      )
    })
  }
}

// ---------------------------------------------------------------------------
// 6. Upgrade, UPI — new sub activates with full grant; old sub cancelled
// ---------------------------------------------------------------------------
scenario('upgrade UPI: new sub ADD full grant, old sub cancelled with exact args', async () => {
  const id = uid('upupi')
  const oldSubId = `sub_old_${id}`
  const newSubId = `sub_new_${id}`
  await seedBilling(id, {
    plan: 'starter',
    planStatus: 'active',
    billingCycle: 'monthly',
    currency: 'USD',
    razorpaySubscriptionId: oldSubId,
    paymentMethod: 'upi',
    creditsIncluded: CREDITS.starter,
    allocationBalance: 500, // leftover kept
    allocationGrantedTotal: CREDITS.starter,
    currentPeriodEnd: new Date((BASE_NOW_UNIX + MONTH) * 1000),
  })

  resetRazorpayCalls()
  const { status } = await postWebhook({
    eventType: 'subscription.activated',
    payload: subscriptionActivatedPayload({
      subscriptionId: newSubId,
      userId: id,
      planType: 'pro',
      currentStart: BASE_NOW_UNIX,
      currentEnd: BASE_NOW_UNIX + MONTH,
      paymentMethod: 'upi',
      notes: { upgrade_flow: 'true', replacing_subscription_id: oldSubId },
    }),
  })
  assert.equal(status, 200)

  const cancelCall = razorpayCalls.find(
    (c) => c.method === 'post' && c.url === `/subscriptions/${oldSubId}/cancel`
  )
  assert.ok(cancelCall, 'UPI upgrade must cancel the old subscription via Razorpay')
  assert.deepEqual(cancelCall!.data, { cancel_at_cycle_end: 1 })

  const billing = await getBillingByUserId(sql, id)
  assert.equal(billing?.razorpaySubscriptionId, newSubId)
  assert.equal(billing?.allocationBalance, 500 + CREDITS.pro, 'kept leftover + new plan full grant (ADD)')

  const oldSub = await getRazorpaySubscription(sql, oldSubId)
  assert.equal(oldSub?.cancelAtCycleEnd, true)
})

// ---------------------------------------------------------------------------
// 7. Downgrade, card — scheduled via route, then SET at renewal; every pair
// ---------------------------------------------------------------------------
for (const [from, to] of DOWNGRADE_PAIRS) {
  scenario(`downgrade card ${from}->${to}: scheduled via route, SET at renewal`, async () => {
    const id = uid(`dnc-${from}-${to}`)
    const subId = `sub_${id}`
    await seedBilling(id, {
      plan: from,
      planStatus: 'active',
      billingCycle: 'monthly',
      currency: 'USD',
      razorpaySubscriptionId: subId,
      paymentMethod: 'card',
      creditsIncluded: CREDITS[from],
      allocationBalance: CREDITS[from],
      allocationGrantedTotal: CREDITS[from],
      currentPeriodEnd: new Date((BASE_NOW_UNIX + MONTH) * 1000),
      nextAllocationDate: new Date(BASE_NOW_UNIX * 1000), // due by the renewal instant set below
    })

    setClock(BASE_NOW)
    resetRazorpayCalls()
    const { status, json } = await callBillingRoute(
      (await import('@/app/api/razorpay/update-subscription/route')).POST,
      id,
      { newPlanType: to, newBillingPeriod: 'monthly' }
    )
    assert.equal(status, 200, JSON.stringify(json))
    assert.equal(json.scheduleChangeAt, 'cycle_end')

    const updateCall = razorpayCalls.find((c) => c.method === 'patch')
    assert.ok(updateCall)
    assert.deepEqual(updateCall!.data, {
      plan_id: getRazorpayPlanId(to, 'monthly', 'USD'),
      schedule_change_at: 'cycle_end',
      customer_notify: 1,
    })

    let billing = await getBillingByUserId(sql, id)
    assert.equal(billing?.hasScheduledChanges, true)
    assert.equal(billing?.scheduledPlanType, to)
    assert.equal(billing?.plan, from, 'current plan and credits stay until period end')

    // Renewal: Razorpay now charges the (already-switched) lower plan.
    setClock(new Date((BASE_NOW_UNIX + MONTH) * 1000)) // refreshAllocationIfDue reads `now = new Date()`

    // Real Razorpay fires `subscription.updated` (has_scheduled_changes -> false)
    // at the instant the scheduled change takes effect, which is what actually
    // flips `plan`/`creditsIncluded` in billing_accounts. Downgrade delta is <=0,
    // so this event ADDs zero credits (no mid-cycle clawback) and merely syncs
    // the plan fields; `subscription.charged` (below) is the separate renewal
    // invoice that SETs allocationBalance to the new plan's grant via plan_id.
    const { status: updatedStatus } = await postWebhook({
      eventType: 'subscription.updated',
      payload: subscriptionUpdatedPayload({
        subscriptionId: subId,
        userId: id,
        planType: to,
        currentStart: BASE_NOW_UNIX + MONTH,
        currentEnd: BASE_NOW_UNIX + 2 * MONTH,
        hasScheduledChanges: false,
        updatedAt: BASE_NOW_UNIX + MONTH,
      }),
    })
    assert.equal(updatedStatus, 200)

    billing = await getBillingByUserId(sql, id)
    assert.equal(billing?.plan, to, 'plan field synced by subscription.updated at cycle end')
    assert.equal(billing?.creditsIncluded, CREDITS[to])
    assert.equal(billing?.hasScheduledChanges, false)

    const { status: chargedStatus } = await postWebhook({
      eventType: 'subscription.charged',
      payload: subscriptionChargedPayload({
        subscriptionId: subId,
        userId: id,
        planType: to,
        currentStart: BASE_NOW_UNIX + MONTH,
        currentEnd: BASE_NOW_UNIX + 2 * MONTH,
        paymentMethod: 'card',
      }),
    })
    assert.equal(chargedStatus, 200)

    billing = await getBillingByUserId(sql, id)
    assert.equal(billing?.allocationBalance, CREDITS[to], 'smaller plan credits SET at renewal')
    assert.equal(billing?.creditsIncluded, CREDITS[to])
    restoreClock()
  })
}

// ---------------------------------------------------------------------------
// 8. Downgrade, UPI — scheduled locally, no Razorpay call
// ---------------------------------------------------------------------------
scenario('downgrade UPI: scheduled locally, no Razorpay call', async () => {
  const id = uid('dnupi')
  const subId = `sub_${id}`
  await seedBilling(id, {
    plan: 'pro',
    planStatus: 'active',
    billingCycle: 'monthly',
    currency: 'USD',
    razorpaySubscriptionId: subId,
    paymentMethod: 'upi',
    creditsIncluded: CREDITS.pro,
    allocationBalance: CREDITS.pro,
    allocationGrantedTotal: CREDITS.pro,
    currentPeriodEnd: new Date((BASE_NOW_UNIX + MONTH) * 1000),
  })

  resetRazorpayCalls()
  const { status, json } = await callBillingRoute(
    (await import('@/app/api/razorpay/update-subscription/route')).POST,
    id,
    { newPlanType: 'starter', newBillingPeriod: 'monthly' }
  )
  assert.equal(status, 200, JSON.stringify(json))
  assert.equal(json.scheduleChangeAt, 'cycle_end')
  assert.equal(razorpayCalls.length, 0, 'UPI downgrade must not call Razorpay at all')

  const billing = await getBillingByUserId(sql, id)
  assert.equal(billing?.hasScheduledChanges, true)
  assert.equal(billing?.scheduledPlanType, 'starter')
  assert.equal(billing?.plan, 'pro')
})

// ---------------------------------------------------------------------------
// 9. Cancel a scheduled downgrade — plan stays
// ---------------------------------------------------------------------------
scenario('cancel scheduled downgrade: plan stays', async () => {
  const id = uid('cxl-sched')
  const subId = `sub_${id}`
  await seedBilling(id, {
    plan: 'pro',
    planStatus: 'active',
    razorpaySubscriptionId: subId,
    paymentMethod: 'card',
    hasScheduledChanges: true,
    scheduledPlanType: 'starter',
    scheduledPlanId: getRazorpayPlanId('starter', 'monthly', 'USD'),
    scheduledChangeAt: new Date((BASE_NOW_UNIX + MONTH) * 1000),
  })

  resetRazorpayCalls()
  const { status, json } = await callBillingRoute(
    (await import('@/app/api/razorpay/cancel-scheduled-change/route')).POST,
    id
  )
  assert.equal(status, 200, JSON.stringify(json))

  const cancelSchedCall = razorpayCalls.find(
    (c) => c.method === 'post' && c.url === `/subscriptions/${subId}/cancel_scheduled_changes`
  )
  assert.ok(cancelSchedCall, 'must call Razorpay cancelScheduledChanges')

  const billing = await getBillingByUserId(sql, id)
  assert.equal(billing?.hasScheduledChanges, false)
  assert.equal(billing?.scheduledPlanType, null)
  assert.equal(billing?.scheduledPlanId, null)
  assert.equal(billing?.plan, 'pro', 'plan stays')
})

// ---------------------------------------------------------------------------
// 10. Payment failure -> pending -> halted -> resumed restores
// ---------------------------------------------------------------------------
scenario('pending -> halted -> resumed: no spending while halted; resumed restores', async () => {
  const id = uid('halt')
  const subId = `sub_${id}`
  await seedBilling(id, {
    plan: 'pro',
    planStatus: 'active',
    razorpaySubscriptionId: subId,
    creditsIncluded: CREDITS.pro,
    allocationBalance: CREDITS.pro,
    allocationGrantedTotal: CREDITS.pro,
    currentPeriodEnd: new Date((BASE_NOW_UNIX + MONTH) * 1000),
  })

  setClock(BASE_NOW)
  await postWebhook({
    eventType: 'subscription.pending',
    payload: subscriptionStatusPayload({
      subscriptionId: subId,
      userId: id,
      planType: 'pro',
      status: 'pending',
      currentStart: BASE_NOW_UNIX,
      currentEnd: BASE_NOW_UNIX + MONTH,
    }),
  })
  let billing = await getBillingByUserId(sql, id)
  assert.equal(billing?.planStatus, 'active', 'subscription.pending does not touch billing planStatus (grace)')
  let sub = await getRazorpaySubscription(sql, subId)
  assert.equal(sub?.status, 'pending')
  const grace = sub?.gracePeriodEndsAt as Date | null
  assert.ok(grace, 'grace_period_ends_at must be set')
  assert.equal(
    Math.round((grace!.getTime() - new Date(BASE_NOW).getTime()) / (24 * 60 * 60 * 1000)),
    7,
    'grace period is 7 days from now'
  )

  await postWebhook({
    eventType: 'subscription.halted',
    payload: subscriptionStatusPayload({
      subscriptionId: subId,
      userId: id,
      planType: 'pro',
      status: 'halted',
      currentStart: BASE_NOW_UNIX,
      currentEnd: BASE_NOW_UNIX + MONTH,
    }),
  })
  billing = await getBillingByUserId(sql, id)
  assert.equal(billing?.planStatus, 'halted')
  let summary = await getBillingSummary(id)
  assert.equal(summary.json.entitled, false, 'no spending while halted')

  await postWebhook({
    eventType: 'subscription.resumed',
    payload: subscriptionStatusPayload({
      subscriptionId: subId,
      userId: id,
      planType: 'pro',
      status: 'active',
      currentStart: BASE_NOW_UNIX,
      currentEnd: BASE_NOW_UNIX + MONTH,
    }),
  })
  billing = await getBillingByUserId(sql, id)
  assert.equal(billing?.planStatus, 'active', 'resumed restores planStatus')
  summary = await getBillingSummary(id)
  assert.equal(summary.json.entitled, true)
  restoreClock()
})

// ---------------------------------------------------------------------------
// 11. Refuse upgrade on pending/halted
// ---------------------------------------------------------------------------
for (const blockedStatus of ['pending', 'halted'] as const) {
  scenario(`refuse upgrade when subscription is ${blockedStatus}`, async () => {
    assert.equal(isUpdatablePlanStatus(blockedStatus), false)

    const id = uid(`refuse-${blockedStatus}`)
    const subId = `sub_${id}`
    await seedBilling(id, {
      plan: 'starter',
      planStatus: blockedStatus,
      razorpaySubscriptionId: subId,
      paymentMethod: 'card',
      creditsIncluded: CREDITS.starter,
      allocationBalance: CREDITS.starter,
      allocationGrantedTotal: CREDITS.starter,
    })

    resetRazorpayCalls()
    const { status } = await callBillingRoute(
      (await import('@/app/api/razorpay/update-subscription/route')).POST,
      id,
      { newPlanType: 'pro', newBillingPeriod: 'monthly' }
    )
    assert.equal(status, 400)
    assert.equal(razorpayCalls.length, 0, 'refused before ever calling Razorpay')
  })
}

// ---------------------------------------------------------------------------
// 12. Add Credits — granted exactly once, duplicate webhook is a no-op
// ---------------------------------------------------------------------------
scenario('add credits: granted exactly once; duplicate webhook ignored', async () => {
  const id = uid('addc')
  await ensureUserAndBilling(sql, id)
  const paymentId = `pay_${id}`
  const eventId = `evt_${id}`
  const payload = paymentCapturedAddCreditsPayload({ paymentId, uid: id, amountUsd: 10 })

  const first = await postWebhook({ eventType: 'payment.captured', payload, eventId })
  assert.equal(first.status, 200)

  let billing = await getBillingByUserId(sql, id)
  assert.equal(billing?.topUpBalance, 10000)

  const second = await postWebhook({ eventType: 'payment.captured', payload, eventId })
  assert.equal(second.status, 200)
  assert.equal(second.json.duplicate, true)

  billing = await getBillingByUserId(sql, id)
  assert.equal(billing?.topUpBalance, 10000, 'duplicate webhook must not re-grant')

  const grants = await grantRows(id)
  assert.equal(grants.length, 1)
})

// ---------------------------------------------------------------------------
// 13. Out-of-order webhooks: charged before activated -> same final state
// ---------------------------------------------------------------------------
scenario('out-of-order: charged before activated converges to the same final state', async () => {
  const id = uid('ooo')
  const subId = `sub_${id}`

  const chargedBefore = await postWebhook({
    eventType: 'subscription.charged',
    eventId: `evt_${id}_charged`,
    payload: subscriptionChargedPayload({
      subscriptionId: subId,
      userId: id,
      planType: 'pro',
      currentStart: BASE_NOW_UNIX,
      currentEnd: BASE_NOW_UNIX + MONTH,
    }),
  })
  assert.equal(chargedBefore.status, 200, 'stale charge before any activation is ignored, not an error')

  const activated = await postWebhook({
    eventType: 'subscription.activated',
    eventId: `evt_${id}_activated`,
    payload: subscriptionActivatedPayload({
      subscriptionId: subId,
      userId: id,
      planType: 'pro',
      currentStart: BASE_NOW_UNIX,
      currentEnd: BASE_NOW_UNIX + MONTH,
      paymentMethod: 'card',
    }),
  })
  assert.equal(activated.status, 200)

  const billing = await getBillingByUserId(sql, id)
  assert.equal(billing?.allocationBalance, CREDITS.pro, 'same final state as activated-first')
  assert.equal(billing?.planStatus, 'active')

  const grants = await grantRows(id)
  assert.equal(grants.length, 1, 'the stale charged event must not have granted anything')
})

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
let failures = 0
for (const s of scenarios) {
  try {
    await s.fn()
    console.log(`  ok  ${s.name}`)
  } catch (err) {
    failures += 1
    console.error(`FAIL  ${s.name}`)
    console.error(err instanceof Error ? (err.stack ?? err.message) : err)
  } finally {
    restoreClock()
  }
}

console.log(`billingTimelineLayer1.ledgercheck: ${scenarios.length - failures}/${scenarios.length} passed`)
await sql.end({ timeout: 1 })
if (failures > 0) {
  process.exit(1)
}
console.log('billingTimelineLayer1.ledgercheck: ok')
