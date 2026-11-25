/**
 * Billing reads: credits health, payments, activity children, org overview.
 * Run: DATABASE_URL=... npx tsx src/lib/analytics/billingReads.ledgercheck.ts
 */
import assert from 'node:assert/strict'

process.env.OKVEVO_ENV ??= 'local'
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:9099'

const { sql } = await import('@/lib/db/client')
const { withTx } = await import('@/lib/db/tx')
const {
  ensureUserAndBilling,
  getBillingByOrgId,
  getBillingByUserId,
  insertCreditTransaction,
  updateBillingById,
  upsertRazorpaySubscription,
} = await import('@/lib/db/wallet')
const { loadCreditsHealth, lotExpirySchedule } = await import('@/lib/analytics/billingCredits')
const { listPayments, parsePaymentRequestId } = await import('@/lib/analytics/payments')
const { upgradeIndividualToOrg } = await import('@/lib/orgs/upgrade')
const { createChildOrg } = await import('@/lib/orgs/createChildOrg')
const { writeAuditLog } = await import('@/lib/orgs/auditLog')
const { installFirebaseAuthMock, setFakeAuthUid } = await import('@/lib/billing/layer1Harness')

const stamp = Date.now().toString(16)
const DAY = 24 * 60 * 60 * 1000
const now = new Date()

/* --------------------------------------------------------------------------
 * 1. Credits health: expiry schedule per bucket, burn netting, forecast.
 * ------------------------------------------------------------------------ */
const uid = `br-c-${stamp}`
await ensureUserAndBilling(sql, uid)
const billing0 = await getBillingByUserId(sql, uid)
assert.ok(billing0)
const billing = billing0!
const periodEnd = new Date(now.getTime() + 20 * DAY)
await updateBillingById(sql, billing.id, {
  plan: 'pro',
  planName: 'Pro',
  planStatus: 'active',
  creditsIncluded: 1000,
  allocationBalance: 300,
  allocationGrantedTotal: 1000,
  currentPeriodEnd: periodEnd,
  topUpBalance: 650,
  topUpReference: 700,
  sponsoredBalance: 30,
  sponsoredReference: 50,
})

const exp10 = new Date(now.getTime() + 10 * DAY)
await insertCreditTransaction(sql, `br-l10-${stamp}`, billing.id, {
  user_id: uid, type: 'grant', amount: 100, bucket: 'top_up', expires_at: exp10, reason: 'seed',
})
await insertCreditTransaction(sql, `br-l40-${stamp}`, billing.id, {
  user_id: uid, type: 'grant', amount: 200, bucket: 'top_up',
  expires_at: new Date(now.getTime() + 40 * DAY), reason: 'seed',
})
await insertCreditTransaction(sql, `br-l80-${stamp}`, billing.id, {
  user_id: uid, type: 'grant', amount: 400, bucket: 'top_up',
  expires_at: new Date(now.getTime() + 80 * DAY), reason: 'seed',
})
await insertCreditTransaction(sql, `br-s50-${stamp}`, billing.id, {
  user_id: uid, type: 'transfer_in', amount: 50, bucket: 'sponsored',
  expires_at: new Date(now.getTime() + 50 * DAY), reason: 'seed',
})

// Burn: net7 = 70-7 = 63 → 9/day; net30 = 63 + 230-23 = 270 → 9/day.
await insertCreditTransaction(sql, `br-d1-${stamp}`, billing.id, {
  user_id: uid, type: 'debit', amount: 70, bucket: 'allocation',
  created_at: new Date(now.getTime() - 1 * DAY),
})
await insertCreditTransaction(sql, `br-r1-${stamp}`, billing.id, {
  user_id: uid, type: 'refund', amount: 7, bucket: 'allocation',
  created_at: new Date(now.getTime() - 2 * DAY),
})
await insertCreditTransaction(sql, `br-d2-${stamp}`, billing.id, {
  user_id: uid, type: 'debit', amount: 230, bucket: 'allocation',
  created_at: new Date(now.getTime() - 10 * DAY),
})
await insertCreditTransaction(sql, `br-r2-${stamp}`, billing.id, {
  user_id: uid, type: 'refund', amount: 23, bucket: 'allocation',
  created_at: new Date(now.getTime() - 20 * DAY),
})

const health = await loadCreditsHealth(sql, billing.id, now)
assert.ok(health)
const allocBucket = health!.buckets.find((b) => b.key === 'allocation')!
assert.equal(allocBucket.label, 'Plan')
assert.equal(allocBucket.remainingPct, 30)
assert.equal(allocBucket.expiresAt, periodEnd.toISOString())
assert.deepEqual(allocBucket.expiry, { next30: 300, days31to60: 0, days61to90: 0 })
const topUpBucket = health!.buckets.find((b) => b.key === 'top_up')!
assert.equal(topUpBucket.label, 'Additional')
assert.equal(topUpBucket.remainingPct, 92.85)
assert.equal(topUpBucket.expiresAt, exp10.toISOString())
// FIFO: 650 remaining = 400 of the 80d lot + 200 of the 40d lot + 50 of the 10d lot.
assert.deepEqual(topUpBucket.expiry, { next30: 50, days31to60: 200, days61to90: 400 })
const sponsoredBucket = health!.buckets.find((b) => b.key === 'sponsored')!
assert.equal(sponsoredBucket.remainingPct, 60)
assert.deepEqual(sponsoredBucket.expiry, { next30: 0, days31to60: 30, days61to90: 0 })
assert.equal(health!.burn.perDay7, 9)
assert.equal(health!.burn.perDay30, 9)
assert.equal(health!.forecastDays, Math.round(980 / 9)) // 109

// Pure edge: lots beyond 90 days never land in a window.
assert.deepEqual(
  lotExpirySchedule(50, [{ amount: 100, expiresAt: new Date(now.getTime() + 91 * DAY) }], now),
  { next30: 0, days31to60: 0, days61to90: 0 }
)

// Zero-usage wallet → no forecast.
const zUid = `br-z-${stamp}`
await ensureUserAndBilling(sql, zUid)
const zBilling = await getBillingByUserId(sql, zUid)
assert.ok(zBilling)
const zHealth = await loadCreditsHealth(sql, zBilling!.id)
assert.ok(zHealth)
assert.equal(zHealth!.burn.perDay30, 0)
assert.equal(Object.hasOwn(zHealth!, 'forecastDays'), false)

/* --------------------------------------------------------------------------
 * 2. Payments: row typing, Razorpay id extraction, Renews vs Ends header.
 * ------------------------------------------------------------------------ */
const pUid = `br-p-${stamp}`
await ensureUserAndBilling(sql, pUid)
const pBilling0 = await getBillingByUserId(sql, pUid)
assert.ok(pBilling0)
await updateBillingById(sql, pBilling0!.id, {
  plan: 'pro',
  planName: 'Pro',
  planStatus: 'active',
  currentPeriodEnd: new Date('2027-01-15T00:00:00.000Z'),
  cancelAtPeriodEnd: false,
})
await insertCreditTransaction(sql, `brpay-rp-${stamp}`, pBilling0!.id, {
  user_id: pUid, type: 'grant', amount: 500, bucket: 'top_up',
  request_id: 'rp_123', reason: 'nia_add_credits',
})
const subId = `sub${stamp}` // razorpay_subscriptions PK is global — stamp it
await insertCreditTransaction(sql, `brpay-chg1-${stamp}`, pBilling0!.id, {
  user_id: pUid, type: 'grant', amount: 1000, bucket: 'allocation',
  request_id: `sub_charged_${subId}_1`, reason: 'subscription.charged',
  created_at: new Date(now.getTime() - 30 * DAY),
})
await insertCreditTransaction(sql, `brpay-chg2-${stamp}`, pBilling0!.id, {
  user_id: pUid, type: 'grant', amount: 1000, bucket: 'allocation',
  request_id: `sub_charged_${subId}_2`, reason: 'subscription.charged',
  created_at: new Date(now.getTime() - 1 * DAY),
})
await insertCreditTransaction(sql, `brpay-act-${stamp}`, pBilling0!.id, {
  user_id: pUid, type: 'grant', amount: 1000, bucket: 'allocation',
  request_id: `sub_activated_${subId}`, reason: 'subscription.activated',
  created_at: new Date(now.getTime() - 60 * DAY),
})
await upsertRazorpaySubscription(sql, subId, pBilling0!.id, {
  status: 'active',
  chargeCount: 2,
  lastPaymentId: 'pay_999',
})

const pBilling = await getBillingByUserId(sql, pUid)
const payPage = await listPayments(sql, { billing: pBilling!, cursor: null })
assert.equal(payPage.items.length, 4)
const [rpRow, chg2Row, chg1Row, actRow] = payPage.items
assert.equal(rpRow!.type, 'Top-up')
assert.equal(rpRow!.razorpayId, '123')
assert.equal(rpRow!.status, 'Paid')
assert.equal(rpRow!.plan, 'Pro')
assert.equal(chg2Row!.type, 'Subscription')
assert.equal(chg2Row!.subscriptionId, subId)
assert.equal(chg2Row!.cycle, 2)
assert.equal(chg2Row!.razorpayId, 'pay_999') // latest cycle → last_payment_id
assert.equal(chg2Row!.status, 'active')
assert.equal(chg1Row!.cycle, 1)
assert.equal(chg1Row!.razorpayId, `${subId}/1`) // older cycle → sub id + cycle
assert.equal(actRow!.type, 'Subscription')
assert.equal(actRow!.subscriptionId, subId)
assert.equal(actRow!.razorpayId, subId)
assert.equal(actRow!.cycle, undefined)
assert.equal(payPage.header?.status, 'active')
assert.equal(payPage.header?.line, 'Renews 2027-01-15')

await updateBillingById(sql, pBilling!.id, { cancelAtPeriodEnd: true })
const payPage2 = await listPayments(sql, {
  billing: (await getBillingByUserId(sql, pUid))!,
  cursor: null,
})
assert.equal(payPage2.header?.line, 'Ends 2027-01-15')

assert.deepEqual(parsePaymentRequestId('sub_charged_s_1_12'), {
  kind: 'sub_charged',
  subscriptionId: 's_1',
  cycle: 12,
})
assert.deepEqual(parsePaymentRequestId('sub_activated_sub_ABC_1750000000'), {
  kind: 'sub_activated',
  subscriptionId: 'sub_ABC',
})
assert.deepEqual(parsePaymentRequestId('rp_pay_ABC'), { kind: 'top_up', paymentId: 'pay_ABC' })
assert.equal(parsePaymentRequestId('xfer_x_y'), null)
assert.equal(parsePaymentRequestId(null), null)

/* --------------------------------------------------------------------------
 * Fixture orgs for 3 + 4: super-org with two children.
 * ------------------------------------------------------------------------ */
const soUid = `br-so-${stamp}`
await ensureUserAndBilling(sql, soUid)
const superName = `Reads Super ${stamp}`
const superUp = await withTx((tx) =>
  upgradeIndividualToOrg(tx, { userId: soUid, name: superName, kind: 'super_org' })
)
assert.ok(superUp.ok)
if (!superUp.ok) throw new Error('super')

const caUid = `br-ca-${stamp}`
const cbUid = `br-cb-${stamp}`
await ensureUserAndBilling(sql, caUid)
await ensureUserAndBilling(sql, cbUid)
const childAName = `Reads Child A ${stamp}`
const childBName = `Reads Child B ${stamp}`
const childA = await withTx((tx) =>
  createChildOrg(tx, {
    parentOrgId: superUp.orgId,
    name: childAName,
    confirmName: childAName,
    createdBy: caUid,
  })
)
const childB = await withTx((tx) =>
  createChildOrg(tx, {
    parentOrgId: superUp.orgId,
    name: childBName,
    confirmName: childBName,
    createdBy: cbUid,
  })
)
assert.ok(childA.ok && childB.ok)
if (!childA.ok || !childB.ok) throw new Error('children')

await withTx(async (tx) => {
  await writeAuditLog(tx, {
    orgId: childA.orgId, actorUserId: caUid, action: 'plan.activated',
    targetType: 'organization', targetId: childA.orgId, metadata: { plan: 'Pro' },
  })
  await writeAuditLog(tx, {
    orgId: childB.orgId, actorUserId: cbUid, action: 'plan.activated',
    targetType: 'organization', targetId: childB.orgId, metadata: { plan: 'Max' },
  })
  await writeAuditLog(tx, {
    orgId: superUp.orgId, actorUserId: soUid, action: 'org.rename',
    targetType: 'organization', targetId: superUp.orgId, metadata: { from: 'A', to: 'B' },
  })
})

await installFirebaseAuthMock()
const { NextRequest } = await import('next/server')
const activityRoute = await import('@/app/api/orgs/[publicId]/activity/route')
const overviewRoute = await import('@/app/api/orgs/[publicId]/overview/route')
const creditsRoute = await import('@/app/api/billing/credits/route')

type RouteGet = (
  req: InstanceType<typeof NextRequest>,
  ctx: { params: Promise<{ publicId: string }> }
) => Promise<Response>

async function callRoute(
  route: { GET: RouteGet },
  actor: string,
  url: string,
  publicId?: string,
  headers: Record<string, string> = {}
) {
  setFakeAuthUid(actor)
  const req = new NextRequest(url, {
    headers: { authorization: `Bearer ${actor}`, ...headers },
  })
  const res = await route.GET(req, { params: Promise.resolve({ publicId: publicId ?? '' }) })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

/* --------------------------------------------------------------------------
 * 3. Activity: super owner sees children with orgName; child owner is scoped.
 * ------------------------------------------------------------------------ */
const superFeed = await callRoute(
  activityRoute, soUid, `http://localhost/api/orgs/${superUp.orgPublicId}/activity`, superUp.orgPublicId
)
assert.equal(superFeed.status, 200)
const feedItems = superFeed.json.items as Array<Record<string, unknown>>
const feedOrgNames = new Set(feedItems.map((i) => String(i.orgName)))
assert.ok(feedOrgNames.has(childAName))
assert.ok(feedOrgNames.has(childBName))
assert.ok(feedOrgNames.has(superName))
const childAFeedRow = feedItems.find((i) => String(i.orgName) === childAName)
assert.ok(childAFeedRow)
assert.equal(String(childAFeedRow!.action), 'Pro plan started')

const childFeed = await callRoute(
  activityRoute, caUid, `http://localhost/api/orgs/${childA.orgPublicId}/activity`, childA.orgPublicId
)
assert.equal(childFeed.status, 200)
const childItems = childFeed.json.items as Array<Record<string, unknown>>
assert.ok(childItems.length >= 1)
for (const item of childItems) {
  // Own rows only — never sibling or parent events.
  assert.equal(String(item.orgName), childAName)
}

/* --------------------------------------------------------------------------
 * 4. Overview: org variant omission, super variant aggregates, member 403.
 * ------------------------------------------------------------------------ */
const poUid = `br-po-${stamp}`
await ensureUserAndBilling(sql, poUid)
const plainUp = await withTx((tx) =>
  upgradeIndividualToOrg(tx, { userId: poUid, name: `Reads Plain ${stamp}` })
)
assert.ok(plainUp.ok)
if (!plainUp.ok) throw new Error('plain')
const plainBilling = await getBillingByOrgId(sql, plainUp.orgId)
assert.ok(plainBilling)
await updateBillingById(sql, plainBilling!.id, {
  plan: 'pro',
  planName: 'Pro',
  planStatus: 'active',
  creditsIncluded: 1000,
  allocationBalance: 800,
  allocationGrantedTotal: 1000,
  currentPeriodEnd: new Date(now.getTime() + 15 * DAY),
})
const poMember = `br-pom-${stamp}`
await ensureUserAndBilling(sql, poMember)
await sql`
  insert into memberships (org_id, user_id, role, status)
  values (${plainUp.orgId}, ${poMember}, 'member', 'active')
`
// Current period = [periodEnd-1mo, now]; previous equal period just before.
await insertCreditTransaction(sql, `br-po-d1-${stamp}`, plainBilling!.id, {
  user_id: poUid, org_id: plainUp.orgId, type: 'debit', amount: 100, bucket: 'allocation',
  created_at: new Date(now.getTime() - 5 * DAY),
})
await insertCreditTransaction(sql, `br-po-d2-${stamp}`, plainBilling!.id, {
  user_id: poUid, org_id: plainUp.orgId, type: 'debit', amount: 40, bucket: 'allocation',
  created_at: new Date(now.getTime() - 20 * DAY),
})

const plainOv = await callRoute(
  overviewRoute, poUid, `http://localhost/api/orgs/${plainUp.orgPublicId}/overview`, plainUp.orgPublicId
)
assert.equal(plainOv.status, 200)
assert.equal(plainOv.json.badge, 'independent')
assert.equal(plainOv.json.planPct, 80)
assert.equal(Object.hasOwn(plainOv.json, 'sponsoredPct'), false)
assert.equal(plainOv.json.memberCount, 2)
assert.deepEqual(plainOv.json.usedThisPeriod, { credits: 100, delta: 60 })
const plainTop = plainOv.json.top10Members as Array<Record<string, unknown>>
assert.equal(plainTop.length, 1)
assert.equal(String(plainTop[0]!.userId), poUid)
assert.equal(Number(plainTop[0]!.credits), 100)
assert.equal((plainOv.json.usageLast30Days as unknown[]).length, 30)

// Member role → 403.
const memberOv = await callRoute(
  overviewRoute, poMember, `http://localhost/api/orgs/${plainUp.orgPublicId}/overview`, plainUp.orgPublicId
)
assert.equal(memberOv.status, 403)

// Child org via inherited_read (super owner): badge partOf + sponsoredPct.
await updateBillingById(sql, childA.billingAccountId, {
  sponsoredBalance: 50,
  sponsoredReference: 100,
})
const childOv = await callRoute(
  overviewRoute, soUid, `http://localhost/api/orgs/${childA.orgPublicId}/overview`, childA.orgPublicId
)
assert.equal(childOv.status, 200)
assert.deepEqual(childOv.json.badge, { partOf: superName })
assert.equal(childOv.json.sponsoredPct, 50)
assert.equal(Object.hasOwn(childOv.json, 'availableToSend'), false)

// Super-org variant.
const superBilling = await getBillingByOrgId(sql, superUp.orgId)
assert.ok(superBilling)
await updateBillingById(sql, superBilling!.id, {
  topUpBalance: 800,
  topUpReference: 1000,
})
await updateBillingById(sql, childB.billingAccountId, {
  sponsoredBalance: -25,
  sponsoredReference: 0,
})
const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
await insertCreditTransaction(sql, `br-x1-${stamp}`, superBilling!.id, {
  user_id: soUid, org_id: superUp.orgId, type: 'transfer_out', amount: 300,
  bucket: 'top_up', reason: 'org.transfer', request_id: `br-x1r-${stamp}`, created_at: now,
})
await insertCreditTransaction(sql, `br-x2-${stamp}`, superBilling!.id, {
  user_id: soUid, org_id: superUp.orgId, type: 'transfer_out', amount: 200,
  bucket: 'top_up', reason: 'org.transfer', request_id: `br-x2r-${stamp}`,
  created_at: new Date(monthStart.getTime() - 15 * DAY),
})
await insertCreditTransaction(sql, `br-ca-d-${stamp}`, childA.billingAccountId, {
  user_id: caUid, org_id: childA.orgId, super_org_id: superUp.orgId,
  type: 'debit', amount: 100, bucket: 'sponsored', created_at: now,
})
await insertCreditTransaction(sql, `br-cb-d-${stamp}`, childB.billingAccountId, {
  user_id: cbUid, org_id: childB.orgId, super_org_id: superUp.orgId,
  type: 'debit', amount: 50, bucket: 'sponsored', created_at: now,
})

const superOv = await callRoute(
  overviewRoute, soUid, `http://localhost/api/orgs/${superUp.orgPublicId}/overview`, superUp.orgPublicId
)
assert.equal(superOv.status, 200)
assert.equal(superOv.json.kind, 'super_org')
assert.equal(superOv.json.organisationsCount, 2)
assert.equal(superOv.json.activeOrgs30d, 2)
assert.equal(superOv.json.owed, 25)
assert.equal(superOv.json.availableToSend, 800)
assert.equal(superOv.json.poolPct, 80)
assert.equal(superOv.json.sentThisMonth, 300)
assert.equal(Object.hasOwn(superOv.json, 'planPct'), false)
const top5 = superOv.json.top5Orgs as Array<Record<string, unknown>>
assert.equal(top5.length, 2)
assert.equal(String(top5[0]!.name), childAName)
assert.equal(Number(top5[0]!.credits), 100)
assert.equal(String(top5[1]!.name), childBName)
assert.equal(Number(top5[1]!.credits), 50)
const months = superOv.json.sentVsUsedByMonth as Array<Record<string, unknown>>
assert.equal(months.length, 6)
const curMonthLabel = monthStart.toISOString().slice(0, 7)
const prevMonthLabel = new Date(monthStart.getTime() - 15 * DAY).toISOString().slice(0, 7)
assert.deepEqual(months[5], { month: curMonthLabel, sent: 300, used: 150 })
assert.deepEqual(months[4], { month: prevMonthLabel, sent: 200, used: 0 })
const trend = superOv.json.usageTrend as Array<Record<string, unknown>>
assert.equal(trend.length, 30)
assert.equal(trend.reduce((s, p) => s + Number(p.credits), 0), 150)

/* --------------------------------------------------------------------------
 * 5. Billing credits route auth: org wallet owner only.
 * ------------------------------------------------------------------------ */
const ownerCredits = await callRoute(
  creditsRoute, soUid, 'http://localhost/api/billing/credits', undefined,
  { 'x-okvevo-org': superUp.orgPublicId }
)
assert.equal(ownerCredits.status, 200)
assert.ok(Array.isArray(ownerCredits.json.buckets))

const memberCredits = await callRoute(
  creditsRoute, poMember, 'http://localhost/api/billing/credits', undefined,
  { 'x-okvevo-org': plainUp.orgPublicId }
)
assert.equal(memberCredits.status, 403)

const personalCredits = await callRoute(
  creditsRoute, uid, 'http://localhost/api/billing/credits'
)
assert.equal(personalCredits.status, 200)

console.log('billingReads.ledgercheck: ok')
await sql.end({ timeout: 1 })
