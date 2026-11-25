'use client'

/**
 * One Firebase auth listener for the whole dashboard. Provides the User so
 * every TanStack Query can attach a Bearer token; sends signed-out visitors
 * to /login (all dashboard routes are gated here).
 */
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'

import { auth } from '@/config/firebase'

type PortalAuth = { user: User | null; ready: boolean }

const PortalAuthContext = createContext<PortalAuth>({ user: null, ready: false })

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<PortalAuth>({ user: null, ready: false })

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setState({ user, ready: true })
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (state.ready && !state.user) router.replace('/login')
  }, [state.ready, state.user, router])

  return <PortalAuthContext.Provider value={state}>{children}</PortalAuthContext.Provider>
}

export function usePortalAuth(): PortalAuth {
  return useContext(PortalAuthContext)
}
