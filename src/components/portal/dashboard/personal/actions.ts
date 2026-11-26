'use client'

/**
 * Mutations for the personal dashboard action cards (Organisations,
 * Account type). Every call is account-less (`org: null` — personal account)
 * and invalidates through TanStack Query, never reload/refresh.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { authedJson } from '@/lib/api/browser'
import { usePortalAuth } from '@/components/portal/PortalAuth'
import { queryKeys } from '@/hooks/useAuthedQuery'

/** Small customer-facing wording for the personal-action API codes. */
export function friendlyMutationError(code: string): string {
  switch (code) {
    case 'invalid_code':
      return 'That code isn’t valid.'
    case 'revoked':
      return 'That code has been replaced.'
    case 'already_member':
      return 'You’re already a member of that organisation.'
    case 'org_cannot_join_by_code':
      return 'This account can’t join with a code.'
    case 'invalid_name':
      return 'Enter a valid name.'
    case 'already_upgraded':
      return 'This account already has an organisation.'
    case 'already_upgraded_needs_org':
      return 'This account already has an organisation — apply from its Settings instead.'
    case 'invalid_email':
      return 'Enter a valid email address.'
    case 'invalid_message':
      return 'Tell us why you need a super-organisation.'
    case 'last_owner':
      return 'The last owner can’t leave the organisation.'
    case 'jobs_in_flight':
      return 'Jobs are still running — try again shortly.'
    case 'org_access_denied':
      return 'You don’t have access to this.'
    case 'not_found':
      return 'That membership no longer exists.'
    case 'rate_limit':
    case 'rate_limited':
      return 'Too many attempts — try again shortly.'
    default:
      return code.replace(/_/g, ' ')
  }
}

/**
 * Inline error text for a mutation, or null when nothing should render.
 * `create_org_first` always returns null: it opens the CreateOrgFirstDialog
 * and the raw API code must never be rendered.
 */
export function mutationInlineError(error: Error | null): string | null {
  if (!error || error.message === 'create_org_first') return null
  return friendlyMutationError(error.message)
}

type JoinResponse = { success: true; action: string; orgPublicId?: string }

/**
 * POST /api/orgs/join `{code}` with no org header (personal account).
 * 422 `create_org_first` (individual + super-org code) is routed to
 * `onCreateOrgFirst` instead of the inline error.
 */
export function useJoinWithCode(opts: {
  onCreateOrgFirst: () => void
  onJoined?: () => void
}) {
  const { user } = usePortalAuth()
  const queryClient = useQueryClient()
  return useMutation<JoinResponse, Error, string>({
    mutationFn: (code) =>
      authedJson<JoinResponse>(user!, '/api/orgs/join', {
        method: 'POST',
        body: JSON.stringify({ code }),
        org: null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me })
      opts.onJoined?.()
    },
    onError: (error) => {
      if (error.message === 'create_org_first') opts.onCreateOrgFirst()
    },
  })
}

/** DELETE /api/orgs/:publicId/members/:uid — self-leave a membership. */
export function useLeaveMembership(opts?: { onLeft?: () => void }) {
  const { user } = usePortalAuth()
  const queryClient = useQueryClient()
  return useMutation<{ success: true }, Error, string>({
    mutationFn: (orgPublicId) =>
      authedJson<{ success: true }>(user!, `/api/orgs/${orgPublicId}/members/${user!.uid}`, {
        method: 'DELETE',
        org: null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me })
      void queryClient.invalidateQueries({ queryKey: ['org'] })
      opts?.onLeft?.()
    },
  })
}

type UpgradeResponse = { success: true; orgPublicId: string }

/** POST /api/me/upgrade `{name}` — one-way individual → organisation. */
export function useCreateOrganisation(opts: { onCreated: (orgPublicId: string) => void }) {
  const { user } = usePortalAuth()
  const queryClient = useQueryClient()
  return useMutation<UpgradeResponse, Error, string>({
    mutationFn: (name) =>
      authedJson<UpgradeResponse>(user!, '/api/me/upgrade', {
        method: 'POST',
        body: JSON.stringify({ name }),
        org: null,
      }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me })
      opts.onCreated(data.orgPublicId)
    },
  })
}

/** POST /api/contact — super_org_application with requestedName + reason. */
export function useApplySuperOrg(opts: { onApplied: () => void }) {
  const { user } = usePortalAuth()
  return useMutation<{ ok: true; id: string }, Error, { requestedName: string; message: string }>({
    mutationFn: ({ requestedName, message }) =>
      authedJson<{ ok: true; id: string }>(user!, '/api/contact', {
        method: 'POST',
        body: JSON.stringify({
          category: 'super_org_application',
          email: user?.email ?? '',
          requestedName,
          message,
        }),
        org: null,
      }),
    onSuccess: () => opts.onApplied(),
  })
}
