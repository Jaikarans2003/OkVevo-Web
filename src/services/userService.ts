/**
 * Client profile shape. Persistence is GET/PATCH /api/me (Postgres).
 * Org fields stay for PR 2; unused in PR 1 UI.
 */
export interface UserProfile {
  uid: string
  email: string
  photoURL?: string
  userType?: 'single' | 'organisation' | 'pro'
  onboardingComplete: boolean
  introComplete?: boolean
  createdAt: unknown
  updatedAt: unknown
  bio?: string
  phoneNumber?: string
  organisationId?: string
  organisationRole?: 'admin' | 'member'
  organisationName?: string
  proOrganisationId?: string
  proOrganisationRole?: 'admin' | 'member'
  proOrganisationName?: string
  isPro?: boolean
  plan?: string | null
  planName?: string | null
  planStatus?: string | null
  billingCycle?: 'monthly' | 'yearly' | null
}
