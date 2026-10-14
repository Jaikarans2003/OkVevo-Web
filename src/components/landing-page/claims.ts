/** What the landing page is allowed to state as live.
 * Accounting workflows are not a shipped product surface yet.
 * INR plans, the desktop app, local sessions, approvals, and scheduled jobs are.
 */

export const COMING_SOON = 'Coming soon'

export type Mark = 'yes' | 'no'

export type ComparisonRow = {
    label: string
    general: Mark
    nia: Mark
    live: boolean
}

export const COMPARISON: ComparisonRow[] = [
    { label: 'Everyday tasks (research, writing, planning)', general: 'yes', nia: 'yes', live: true },
    { label: 'Has a profession', general: 'no', nia: 'yes', live: true },
    { label: 'Understands Indian accounting, GST, TDS', general: 'no', nia: 'yes', live: false },
    { label: 'Knows a CA firm’s monthly cycle', general: 'no', nia: 'yes', live: false },
    { label: 'Bank reconciliation', general: 'no', nia: 'yes', live: false },
    { label: 'Invoice & bill entry prep', general: 'no', nia: 'yes', live: false },
    { label: 'Chases client documents', general: 'no', nia: 'yes', live: false },
    { label: 'Recurring jobs on schedule', general: 'yes', nia: 'yes', live: true },
    { label: 'Remembers each client’s formats', general: 'no', nia: 'yes', live: false },
    { label: 'Prepares, you approve', general: 'no', nia: 'yes', live: true },
    { label: 'Your data stays on your computer', general: 'no', nia: 'yes', live: true },
    { label: 'Desktop app', general: 'no', nia: 'yes', live: true },
    { label: 'Available in India today', general: 'no', nia: 'yes', live: true },
    { label: 'Priced in ₹', general: 'no', nia: 'yes', live: true },
    { label: 'Set up with you, on your real work', general: 'no', nia: 'yes', live: true },
    { label: 'Built for', general: 'no', nia: 'yes', live: true },
]

export const ASK_BOTH = [
    {
        prompt: 'Reconcile this statement.',
        general: 'Explains how to reconcile.',
        nia: 'Reconciles it, flags 3 mismatches.',
        live: false,
    },
    {
        prompt: 'What’s due this month?',
        general: 'Lists general deadlines.',
        nia: 'Lists deadlines per client, with what’s pending.',
        live: false,
    },
    {
        prompt: 'Follow up for missing bills.',
        general: 'Drafts a message.',
        nia: 'Sends it, tracks who replied.',
        live: false,
    },
] as const

export const HANDLES = [
    'Bank reconciliation',
    'Invoice & bill entry',
    'GST working papers',
    'Client follow-ups',
    'Expense categorisation',
    'Monthly summaries',
] as const

export function niaCell(row: ComparisonRow): { mark: Mark; soon: boolean } {
    return { mark: row.nia, soon: !row.live }
}

export function assertLandingClaims(): void {
    const soon = COMPARISON.filter((row) => !row.live)
    if (soon.length < 6) throw new Error('unshipped accounting rows must stay marked')
    for (const row of COMPARISON) {
        if (row.general !== 'yes' && row.general !== 'no') throw new Error(row.label)
        if (row.nia !== 'yes' && row.nia !== 'no') throw new Error(row.label)
    }
    for (const row of soon) {
        if (niaCell(row).soon !== true) throw new Error(`missing soon: ${row.label}`)
    }
    const priced = COMPARISON.find((row) => row.label === 'Priced in ₹')
    if (!priced?.live || priced.nia !== 'yes') throw new Error('INR pricing is live')
    if (COMPARISON.some((row) => /server/i.test(row.label))) throw new Error('do not claim a private server')
    const local = COMPARISON.find((row) => row.label === 'Your data stays on your computer')
    if (!local?.live || local.nia !== 'yes') throw new Error('sessions stay on the computer')
    if (ASK_BOTH.some((row) => row.live)) throw new Error('ask-both outcomes are not shipped')
    if (HANDLES.length !== 6) throw new Error('six handle cards')
}
