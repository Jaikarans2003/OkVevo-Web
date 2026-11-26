/** Customer wording for stored audit actions. Unknown actions stay generic. */

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function amount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function credits(n: number): string {
  return n.toLocaleString('en-US')
}

export function activityWording(
  action: string,
  metadata: Record<string, unknown> | null | undefined,
  targetName?: string | null
): string {
  const meta = metadata ?? {}
  const name = targetName?.trim() || ''
  switch (action) {
    case 'credits.transfer': {
      const sent = `Sent ${credits(amount(meta.amount))} credits to ${name || 'the organisation'}`
      const debt = amount(meta.debtRecovered)
      return debt > 0 ? `${sent} (${credits(debt)} repaid owed credits)` : sent
    }
    case 'org.rename':
      return `Renamed ${text(meta.from) || 'the organisation'} to ${text(meta.to) || name || 'the new name'}`
    case 'plan.change':
      return `Changed plan from ${text(meta.fromPlan) || 'the previous plan'} to ${text(meta.toPlan) || 'the new plan'}`
    case 'plan.cancel':
      return `Cancelled the ${text(meta.plan) || 'current'} plan${text(meta.endsAt) ? `, ends ${text(meta.endsAt)}` : ''}`
    case 'plan.activated':
      return `${text(meta.plan) || 'The'} plan started`
    case 'plan.ended':
      return `${text(meta.plan) || 'The'} plan ended`
    case 'member.role':
      return 'Changed a member role'
    case 'member.remove':
      return 'Removed a member'
    case 'join_code.create':
      return 'Created a join code'
    case 'join_code.deactivate':
      return 'Turned off a join code'
    case 'join_code.regenerate':
      return 'Replaced the join code'
    case 'join_code.accept_parent':
      return 'Joined a super-organisation'
    case 'org.leave_super':
      return 'Left the super-organisation'
    case 'org.remove_child':
      return 'Removed an organisation'
    default:
      return 'Updated the organisation'
  }
}

export function actorLabel(actorUserId: string): string {
  return actorUserId === 'system' ? 'Automatic' : actorUserId
}
