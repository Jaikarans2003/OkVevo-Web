'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'

import UsageBar from '@/components/billing/UsageBar'
import PortalShell from '@/components/portal/PortalShell'
import LoadingScreen from '@/components/shared/LoadingScreen'
import { useAuth } from '@/hooks/useAuth'
import { authedFetch, authedJson } from '@/lib/api/browser'
import type { MePayload } from '@/lib/api/me'
import {
  readActiveOrgPublicId,
  resolveActiveOrg,
  writeActiveOrgPublicId,
} from '@/lib/orgs/activeOrg'
import {
  canChangeMemberRoles,
  canRemovePrivilegedMembers,
  dashboardNavForRole,
} from '@/lib/orgs/dashboardHelpers'

type OrgDashboard = {
  org: {
    publicId: string
    name: string
    kind: 'org' | 'super_org'
    parentId: string | null
    parentName: string | null
  }
  role: string
  canSpend: boolean
  wallet: {
    accountKind: string
    accessMode: string
    remainingPct: number
    additionalPct: number
    sponsoredPct: number
    overdrawnPct?: number
    canPurchase: boolean
    cancelAtPeriodEnd?: boolean
    periodEnd?: string | null
    plan?: string | null
    planName?: string | null
    fundedBy?: string | null
  } | null
  members: Array<{
    userId: string
    email?: string | null
    role: string
    creditsUsed?: number
    lastActive?: string | null
  }>
  children: Array<{
    publicId: string
    name: string
    active?: boolean
    creditsUsed?: number
    memberCount?: number
    owesPct?: number
    owesCredits?: number
    wallet?: {
      remainingPct: number
      additionalPct: number
      sponsoredPct: number
      overdrawnPct?: number
    } | null
  }>
  exact?: {
    availableToSend: number
    availableToSendLabel: string
    owedByOrganisations: number
    overdrawnSentence: string | null
  }
  period?: { from: string; to: string; creditsUsed: number; activeMemberCount: number }
}

type TransferItem = {
  id?: string
  requestId?: string
  transferred?: number
  total?: number
  repaid: number
  added: number
  childName?: string | null
  label?: string
  createdAt: string
}
type UsageRow = Record<string, unknown>

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const [me, setMe] = useState<MePayload | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [data, setData] = useState<OrgDashboard | null>(null)
  const [joinCode, setJoinCode] = useState<{ id: string; code: string } | null>(null)
  const [transfers, setTransfers] = useState<TransferItem[]>([])
  const [usageRows, setUsageRows] = useState<UsageRow[]>([])
  const [usageGroup, setUsageGroup] = useState('day')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  const [orgNameEdit, setOrgNameEdit] = useState('')
  const [childName, setChildName] = useState('')
  const [childNameConfirm, setChildNameConfirm] = useState('')
  const [sendTo, setSendTo] = useState('')
  const [sendAmount, setSendAmount] = useState(100)

  const reload = useCallback(async () => {
    if (!user) return
    setError(null)
    const payload = await authedJson<MePayload>(user, '/api/me')
    setMe(payload)
    const resolved = resolveActiveOrg({
      stored: readActiveOrgPublicId(),
      hidePersonal: payload.hidePersonal,
      upgradedOrgPublicId: payload.upgradedOrgPublicId,
      memberships: payload.memberships,
    })
    writeActiveOrgPublicId(resolved)
    setOrgId(resolved)
    if (!resolved) {
      setData(null)
      setLoading(false)
      return
    }

    const dash = await authedJson<OrgDashboard>(user, `/api/orgs/${resolved}`)
    setData(dash)
    setOrgNameEdit(dash.org.name)

    const nav = dashboardNavForRole(dash.role)
    if (nav === 'my_usage') {
      const usage = await authedJson<{ rows: UsageRow[] }>(
        user,
        `/api/orgs/${resolved}/usage?group_by=day`
      )
      setUsageRows(usage.rows ?? [])
      setLoading(false)
      return
    }

    const ownerViewer = dashboardNavForRole(dash.role) === 'dashboard' && canChangeMemberRoles(dash.role)
    const fetches: [
      Promise<{ id: string; code: string } | null>,
      Promise<{ items: TransferItem[] }>,
      Promise<{ rows: UsageRow[] }>,
    ] = [
      ownerViewer
        ? authedJson<{ id: string; code: string }>(user, `/api/orgs/${resolved}/join-codes`)
        : Promise.resolve(null),
      authedJson<{ items: TransferItem[] }>(user, `/api/orgs/${resolved}/transfers`),
      authedJson<{ rows: UsageRow[] }>(user, `/api/orgs/${resolved}/usage?group_by=${usageGroup}`),
    ]
    const [codeRes, xferRes, usage] = await Promise.all(fetches)
    setJoinCode(codeRes ? { id: codeRes.id, code: codeRes.code } : null)
    setTransfers(xferRes.items ?? [])
    setUsageRows(usage.rows ?? [])
    setLoading(false)
  }, [user, usageGroup])

  useEffect(() => {
    if (!authLoading && !isAuthenticated()) router.push('/login')
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (!user) return
    setLoading(true)
    reload().catch((e) => {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard')
      setLoading(false)
    })
  }, [user, reload])

  const isAdmin = data ? dashboardNavForRole(data.role) === 'dashboard' : false
  const ownerCapable = canChangeMemberRoles(data?.role)
  const canRemovePriv = canRemovePrivilegedMembers(data?.role)

  const run = async (fn: () => Promise<void>, successMsg = 'Done.') => {
    setBusy(true)
    setBanner(null)
    setError(null)
    try {
      await fn()
      setBanner(successMsg)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  const spot = (ink: string) => ({ '--spot': `var(--${ink})` } as CSSProperties)

  const memberOnly = useMemo(
    () => data != null && dashboardNavForRole(data.role) === 'my_usage',
    [data]
  )

  if (authLoading || loading) return <LoadingScreen loadKey="dashboard" />

  return (
    <PortalShell>
      <section className="wrap pt-head">
        <div>
          <h1>
            {memberOnly ? 'My usage' : 'Dashboard'}
            <span>.</span>
          </h1>
          <p className="sub">
            {data ? data.org.name : 'Choose an organisation in the account switcher.'}
          </p>
        </div>
      </section>

      <div className="wrap pt-stack">
        {error ? (
          <p className="pt-note pt-note--bad" role="alert">
            <AlertCircle size={18} aria-hidden /> {error}
          </p>
        ) : null}
        {banner ? (
          <p className="pt-note pt-note--good" role="status">
            {banner}
          </p>
        ) : null}

        {!orgId || !data ? (
          <section className="sheet pt-sheet">
            <h2>No organisation selected</h2>
            <p className="sub">Upgrade or switch to an organisation account to open the dashboard.</p>
            <Link href="/profile" className="btn btn--go">
              Go to Profile
            </Link>
          </section>
        ) : memberOnly ? (
          <section className="sheet pt-sheet">
            <h2>Your usage</h2>
            <UsageTable rows={usageRows} />
          </section>
        ) : (
          <>
            {/* Overview */}
            <section className="sheet pt-sheet">
              <h2>Overview</h2>
              <p className="pt-fine">
                Plan: <b>{data.wallet?.planName || data.wallet?.plan || 'None'}</b>
                {data.period
                  ? ` · ${data.period.creditsUsed} credits used this period · ${data.period.activeMemberCount} active members`
                  : null}
              </p>
              <div className="pt-grid2" style={{ marginTop: 16 }}>
                <UsageBar
                  label="Your credits · plan"
                  pct={data.wallet?.remainingPct ?? 0}
                  spot="var(--orange)"
                />
                <UsageBar
                  label="Your credits · additional"
                  pct={data.wallet?.additionalPct ?? 0}
                  spot="var(--teal)"
                />
              </div>
              {(data.org.parentName || (data.wallet?.sponsoredPct ?? 0) > 0) && (
                <div style={{ marginTop: 12 }}>
                  <UsageBar
                    label={
                      data.org.parentName
                        ? `From ${data.org.parentName}`
                        : 'Sponsored credits'
                    }
                    pct={data.wallet?.sponsoredPct ?? 0}
                    spot="var(--olive)"
                  />
                </div>
              )}
              {data.exact?.overdrawnSentence ? (
                <p className="pt-note pt-note--bad" role="status" style={{ marginTop: 12 }}>
                  <AlertCircle size={18} aria-hidden /> {data.exact.overdrawnSentence}
                </p>
              ) : null}
              {data.wallet?.cancelAtPeriodEnd ? (
                <p className="pt-note pt-note--info" style={{ marginTop: 12 }}>
                  Your previous plan ends on {fmtDate(data.wallet.periodEnd)}.
                  {data.wallet.canPurchase ? (
                    <>
                      {' '}
                      <Link href="/pricing" className="pt-link">
                        Buy a new plan
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : null}
              <p style={{ marginTop: 12 }}>
                <Link href="/billing" className="btn">
                  Open Billing
                </Link>
              </p>
            </section>

            {/* Super-org organisations */}
            {data.org.kind === 'super_org' ? (
              <section className="sheet pt-sheet">
                <h2>Organisations</h2>
                <p className="pt-fine">
                  Owed by your organisations:{' '}
                  <b>{data.exact?.owedByOrganisations ?? 0} credits</b>
                </p>
                <div style={{ overflowX: 'auto', marginTop: 12 }}>
                  <table className="pt-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th align="left">Name</th>
                        <th align="left">Status</th>
                        <th align="right">Used</th>
                        <th align="right">Plan %</th>
                        <th align="right">Add’l %</th>
                        <th align="right">Sponsored %</th>
                        <th align="right">Owes</th>
                        <th align="right">Members</th>
                        <th align="left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.children.map((c) => (
                        <tr key={c.publicId}>
                          <td>{c.name}</td>
                          <td>{c.active ? 'Active' : 'Inactive'}</td>
                          <td align="right">{c.creditsUsed ?? 0}</td>
                          <td align="right">{c.wallet?.remainingPct ?? 0}%</td>
                          <td align="right">{c.wallet?.additionalPct ?? 0}%</td>
                          <td align="right">{c.wallet?.sponsoredPct ?? 0}%</td>
                          <td align="right">
                            {c.owesCredits ?? 0} credits ({c.owesPct ?? 0}%)
                          </td>
                          <td align="right">{c.memberCount ?? 0}</td>
                          <td>
                            <button
                              type="button"
                              className="btn"
                              style={{ marginRight: 6 }}
                              disabled={busy}
                              onClick={() => {
                                writeActiveOrgPublicId(c.publicId)
                                window.location.reload()
                              }}
                            >
                              Open
                            </button>
                            {ownerCapable ? (
                              <button
                                type="button"
                                className="btn btn--danger"
                                disabled={busy}
                                onClick={() =>
                                  run(async () => {
                                    if (
                                      !window.confirm(
                                        `Remove ${c.name}? The super-org may absorb unpaid sponsored debt.`
                                      )
                                    ) {
                                      return
                                    }
                                    await authedJson(
                                      user!,
                                      `/api/orgs/${data.org.publicId}/organisations/${c.publicId}/remove`,
                                      { method: 'POST', body: '{}' }
                                    )
                                  })
                                }
                              >
                                Remove
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {ownerCapable ? (
                  <div style={{ marginTop: 20 }}>
                    <h3>Create organisation</h3>
                    <div className="pt-field">
                      <label htmlFor="child-name">Name</label>
                      <input
                        id="child-name"
                        className="pt-input"
                        value={childName}
                        onChange={(e) => setChildName(e.target.value)}
                      />
                    </div>
                    <div className="pt-field">
                      <label htmlFor="child-name-confirm">Confirm name</label>
                      <input
                        id="child-name-confirm"
                        className="pt-input"
                        value={childNameConfirm}
                        onChange={(e) => setChildNameConfirm(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn--go"
                      disabled={
                        busy ||
                        !childName.trim() ||
                        childName.trim() !== childNameConfirm.trim()
                      }
                      onClick={() =>
                        run(async () => {
                          const name = childName.trim()
                          await authedJson(user!, '/api/orgs', {
                            method: 'POST',
                            body: JSON.stringify({
                              name,
                              confirmName: childNameConfirm.trim(),
                              parent: data.org.publicId,
                            }),
                          })
                          setChildName('')
                          setChildNameConfirm('')
                        })
                      }
                    >
                      Create
                    </button>
                  </div>
                ) : null}

                {ownerCapable ? (
                  <div className="prin" style={{ marginTop: 20, ...spot('orange') }}>
                    <h3>Send credits</h3>
                    <p className="pt-fine">{data.exact?.availableToSendLabel ?? 'Available to send: 0 credits'}</p>
                    <div className="pt-field">
                      <label htmlFor="send-to">Child org public id</label>
                      <select
                        id="send-to"
                        className="pt-input"
                        value={sendTo}
                        onChange={(e) => setSendTo(e.target.value)}
                      >
                        <option value="">Select…</option>
                        {data.children.map((c) => (
                          <option key={c.publicId} value={c.publicId}>
                            {c.name} ({c.publicId})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="pt-field">
                      <label htmlFor="send-amt">Credits (exact)</label>
                      <input
                        id="send-amt"
                        type="number"
                        min={1}
                        step={1}
                        className="pt-input"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(Number(e.target.value))}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn--go"
                      disabled={busy || !sendTo || !Number.isInteger(sendAmount) || sendAmount <= 0}
                      onClick={() =>
                        run(async () => {
                          const key = `dash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
                          const res = await authedFetch(user!, `/api/orgs/${data.org.publicId}/transfers`, {
                            method: 'POST',
                            body: JSON.stringify({
                              toOrg: sendTo,
                              credits: sendAmount,
                              idempotencyKey: key,
                            }),
                          })
                          const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
                          if (!res.ok) {
                            throw new Error(
                              typeof json.error === 'string' ? json.error : 'Transfer failed'
                            )
                          }
                        })
                      }
                    >
                      {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
                      Send
                    </button>
                  </div>
                ) : null}

                <div style={{ marginTop: 20 }}>
                  <h3>Transfers</h3>
                  <ul className="pt-stack">
                    {transfers.map((t) => (
                      <li key={t.id ?? t.requestId} className="pt-fine">
                        Sent {t.transferred ?? t.total ?? 0} to {t.childName ?? 'child'} —{' '}
                        {t.repaid} repaid, {t.added} added · {fmtDate(t.createdAt)}
                      </li>
                    ))}
                    {transfers.length === 0 ? <li className="pt-fine">No transfers yet.</li> : null}
                  </ul>
                </div>
              </section>
            ) : null}

            {/* Child received transfers */}
            {data.org.parentId ? (
              <section className="sheet pt-sheet">
                <h2>Credits from {data.org.parentName || 'super-organisation'}</h2>
                <ul className="pt-stack">
                  {transfers.map((t) => (
                    <li key={t.requestId ?? t.createdAt} className="pt-fine">
                      {t.label ??
                        `Received ${t.total ?? 0} credits (${t.repaid} repaid, ${t.added} added)`}{' '}
                      · {fmtDate(t.createdAt)}
                    </li>
                  ))}
                  {transfers.length === 0 ? <li className="pt-fine">No transfers received.</li> : null}
                </ul>
              </section>
            ) : null}

            {/* Members */}
            <section className="sheet pt-sheet">
              <h2>Members</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th align="left">Email</th>
                      <th align="left">Role</th>
                      <th align="right">Used</th>
                      <th align="left">Last active</th>
                      <th align="left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.map((m) => {
                      const privileged = m.role === 'owner'
                      const canRemove = privileged ? canRemovePriv : isAdmin
                      return (
                        <tr key={m.userId}>
                          <td>{m.email || m.userId}</td>
                          <td>
                            {ownerCapable ? (
                              <select
                                className="pt-input"
                                value={m.role}
                                disabled={busy}
                                onChange={(e) =>
                                  run(async () => {
                                    await authedJson(
                                      user!,
                                      `/api/orgs/${data.org.publicId}/members/${m.userId}`,
                                      {
                                        method: 'PATCH',
                                        body: JSON.stringify({ role: e.target.value }),
                                      }
                                    )
                                  })
                                }
                              >
                                <option value="member">member</option>
                                <option value="owner">owner</option>
                              </select>
                            ) : (
                              m.role
                            )}
                          </td>
                          <td align="right">{m.creditsUsed ?? 0}</td>
                          <td>{fmtDate(m.lastActive)}</td>
                          <td>
                            {canRemove ? (
                              <button
                                type="button"
                                className="btn btn--danger"
                                disabled={busy}
                                onClick={() =>
                                  run(
                                    async () => {
                                      await authedJson(
                                        user!,
                                        `/api/orgs/${data.org.publicId}/members/${m.userId}`,
                                        { method: 'DELETE' }
                                      )
                                    },
                                    'Member removed. Regenerate the join code if they still have it.'
                                  )
                                }
                              >
                                Remove
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {ownerCapable ? (
                <div style={{ marginTop: 16 }}>
                  <h3>Join code</h3>
                  <p className="pt-fine">Share this code so people can join as members.</p>
                  {joinCode ? (
                    <p className="pt-fine">
                      <code>{joinCode.code}</code>{' '}
                      <button
                        type="button"
                        className="btn"
                        onClick={() => navigator.clipboard.writeText(joinCode.code)}
                      >
                        Copy
                      </button>
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await authedJson(user!, `/api/orgs/${data.org.publicId}/join-codes`, {
                          method: 'POST',
                          body: '{}',
                        })
                      })
                    }
                  >
                    Regenerate
                  </button>
                </div>
              ) : null}
            </section>

            {/* Usage */}
            <section className="sheet pt-sheet">
              <h2>Usage</h2>
              <label className="pt-field">
                Group by{' '}
                <select
                  className="pt-input"
                  value={usageGroup}
                  onChange={(e) => setUsageGroup(e.target.value)}
                >
                  <option value="day">day</option>
                  <option value="user">member</option>
                  {data.org.kind === 'super_org' ? <option value="org">organisation</option> : null}
                  <option value="end_customer">end customer</option>
                </select>
              </label>
              <UsageTable rows={usageRows} />
            </section>

            {/* Settings */}
            <section className="sheet pt-sheet">
              <h2>Settings</h2>
              <div className="pt-field">
                <label htmlFor="org-rename">Organisation name</label>
                <input
                  id="org-rename"
                  className="pt-input"
                  value={orgNameEdit}
                  onChange={(e) => setOrgNameEdit(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn"
                disabled={busy || !orgNameEdit.trim()}
                onClick={() =>
                  run(async () => {
                    await authedJson(user!, `/api/orgs/${data.org.publicId}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ name: orgNameEdit.trim() }),
                    })
                  })
                }
              >
                Save name
              </button>
              {data.org.parentId && ownerCapable ? (
                <p style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="btn btn--danger"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        if (
                          !window.confirm(
                            'Leave this super-organisation? Unused sponsored credits return; debt may be charged to the super-org.'
                          )
                        ) {
                          return
                        }
                        await authedJson(user!, `/api/orgs/${data.org.publicId}/leave`, {
                          method: 'POST',
                          body: '{}',
                        })
                      })
                    }
                  >
                    Leave super-organisation
                  </button>
                </p>
              ) : null}
            </section>
          </>
        )}
      </div>
    </PortalShell>
  )
}

function UsageTable({ rows }: { rows: UsageRow[] }) {
  if (!rows.length) return <p className="pt-fine">No usage in this period.</p>
  const keys = Object.keys(rows[0] ?? {})
  return (
    <div style={{ overflowX: 'auto', marginTop: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k} align="left">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {keys.map((k) => (
                <td key={k}>{String(r[k] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
