/**
 * API response shapes for the org / super-org dashboard modules (W3b).
 * Field lists mirror the route handlers — never invent client-side fields.
 */

/* GET /api/orgs/:publicId/overview (owner / inherited_read / platform_admin) */
export type OrgOverview = {
  publicId: string
  name: string
  kind: 'org' | 'super_org'
  badge: 'independent' | { partOf: string }
  memberCount: number
  planPct?: number
  additionalPct?: number
  sponsoredPct?: number
  usedThisPeriod?: { credits: number; delta: number }
  top10Members?: { userId: string; label: string; credits: number }[]
  usageLast30Days?: { day: string; credits: number }[]
  /* super-org only */
  organisationsCount?: number
  activeOrgs30d?: number
  owed?: number
  sentThisMonth?: number
  poolPct?: number
  availableToSend?: number
  top5Orgs?: { publicId: string; name: string; credits: number }[]
  sentVsUsedByMonth?: { month: string; sent: number; used: number }[]
  usageTrend?: { day: string; credits: number }[]
}

/* Extra fields on GET /api/orgs/:publicId beyond the shell's OrgDetail. */
export type OrgWalletPct = {
  accountKind: string
  accessMode: string
  remainingPct: number
  additionalPct: number
  sponsoredPct: number
  canPurchase: boolean
  cancelAtPeriodEnd: boolean
  periodEnd: string | null
  plan: string | null
  planName: string | null
  billingCycle: string | null
  overdrawnPct?: number
  fundedBy?: string | null
}

export type OrgMemberSelfRow = {
  userId: string
  email?: string | null
  role: string
  status?: string
  creditsUsed?: number
  lastActive?: string | null
  createdAt?: string
}

export type OrgExactCredits = {
  availableToSend: number
  availableToSendLabel: string
  owedByOrganisations: number
  overdrawnSentence: string | null
}

/* GET /api/orgs/:publicId/members */
export type MemberRow = {
  userId: string
  name: string | null
  email: string | null
  role: string
  status: string
  creditsUsed: number
  lastActive: string | null
}

/* GET /api/orgs/:publicId/organisations */
export type ChildOrgRow = {
  publicId: string
  name: string
  ownerName: string | null
  ownerEmail: string | null
  memberCount: number
  walletPct: number
  creditsUsed: number
  burnPerDay: number
  daysLeft: number | null
  owes: number
  active: boolean
}

/* GET …/usage (org + billing) */
export type UsageSeriesRow = { bucket: string; key: string; credits: number; requests: number }
export type UsageResult = {
  tz: string
  bucket: 'day' | 'week' | 'month'
  groupBy: 'model' | 'job_type' | 'member' | 'org'
  from: string
  to: string
  series: UsageSeriesRow[]
  labels: Record<string, string>
  totals: { credits: number; requests: number; activeMembers?: number }
  previous: { credits: number; requests: number }
  top: { key: string; credits: number }[]
}

/* GET …/jobs */
export type JobRow = {
  id: string
  createdAt: string
  memberUserId: string
  modelLabel: string
  jobType: string
  status: string
  credits: number
  releaseReason: string | null
}

/* GET /api/orgs/:publicId/activity */
export type ActivityItem = {
  id: string
  createdAt: string
  actor: string
  action: string
  target: string | null
  orgName: string
}

/* GET /api/orgs/:publicId/transfers (super-org) */
export type TransferRow = {
  id: string
  requestId: string
  transferred: number
  repaid: number
  added: number
  childPublicId: string | null
  childName: string | null
  createdAt: string
}

/* GET /api/billing/credits */
export type CreditsHealth = {
  buckets: {
    key: 'allocation' | 'top_up' | 'sponsored'
    label: string
    remainingPct: number
    expiresAt: string | null
    expiry: { next30: number; days31to60: number; days61to90: number }
  }[]
  burn: { perDay7: number; perDay30: number }
  forecastDays?: number
}

/* GET /api/billing/payments */
export type PaymentsPage = {
  header?: { status: string | null; line: string | null }
  items: {
    id: string
    date: string
    type: 'Subscription' | 'Top-up'
    plan: string | null
    status: string
    razorpayId: string
    subscriptionId?: string
    cycle?: number
  }[]
  nextCursor: string | null
}

/* GET /api/billing/transactions */
export type LedgerItem = {
  id: string
  type: string
  amount: number
  bucket: string | null
  absorbed: number
  reason: string | null
  requestId: string | null
  modelLabel: string
  jobType: string
  createdAt: string
}

/* GET /api/orgs/:publicId/join-codes */
export type JoinCode = { id: string; code: string; created: boolean }

/* Paged list envelope shared by every keyset endpoint. */
export type Paged<T> = { items: T[]; nextCursor: string | null }
