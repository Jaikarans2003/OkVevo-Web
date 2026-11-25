/** Customer wording for stored job release reasons. Unknown reasons humanise. */

const WORDING: Record<string, string> = {
  cancelled: 'Cancelled',
  expired: 'Expired',
  fal_not_accepted: 'Not accepted',
  plan_inactive: 'Plan inactive',
}

export function releaseReasonWording(reason: string | null | undefined): string | null {
  if (reason == null || reason === '') return null
  const known = WORDING[reason]
  if (known) return known
  const humanised = reason.replace(/[_-]+/g, ' ').trim()
  return humanised ? humanised.charAt(0).toUpperCase() + humanised.slice(1) : null
}
