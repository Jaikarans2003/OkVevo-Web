import { useState, useEffect } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth } from '../config/firebase'
import { authedJson } from '@/lib/api/browser'
import type { MePayload } from '@/lib/api/me'
import type { UserProfile } from '../services/userService'

export interface AuthState {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  error: string | null
}

function profileFromMe(payload: MePayload): UserProfile {
  return {
    uid: payload.user.id,
    email: payload.user.email || '',
    onboardingComplete: true,
    bio: payload.user.bio ?? undefined,
    phoneNumber: payload.user.phoneNumber ?? undefined,
    createdAt: null,
    updatedAt: null,
  }
}

/** Hook to get current authenticated user and their profile via GET /api/me. */
export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    userProfile: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const me = await authedJson<MePayload>(user, '/api/me')
          setAuthState({
            user,
            userProfile: profileFromMe(me),
            loading: false,
            error: null,
          })
        } catch (error) {
          console.error('Failed to fetch user profile:', error)
          setAuthState({
            user,
            userProfile: null,
            loading: false,
            error: 'Failed to load user profile',
          })
        }
      } else {
        setAuthState({
          user: null,
          userProfile: null,
          loading: false,
          error: null,
        })
      }
    })

    return () => unsubscribe()
  }, [])

  const getStorageId = (): string | null => {
    return authState.userProfile?.uid ?? null
  }

  const isAuthenticated = (): boolean => authState.user !== null

  const getUserType = (): 'single' | 'organisation' | 'pro' | null => {
    return authState.userProfile?.userType || null
  }

  return {
    ...authState,
    getStorageId,
    isAuthenticated,
    getUserType,
  }
}
