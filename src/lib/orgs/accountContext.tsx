'use client'

/**
 * URL-scoped account context (plan §1). One AccountProvider per account
 * layout (app/dashboard/personal, app/dashboard/o/[publicId]); every fetch in
 * that subtree reads the account from here — never from localStorage.
 */
import { createContext, useContext, type ReactNode } from 'react'

export type AccountRef =
  | { account: 'personal' }
  | { account: 'org'; publicId: string }

const AccountContext = createContext<AccountRef | null>(null)

export function AccountProvider({
  account,
  children,
}: {
  account: AccountRef
  children: ReactNode
}) {
  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>
}

/** Active account, or null above/outside an account layout (shell, redirects). */
export function useAccount(): AccountRef | null {
  return useContext(AccountContext)
}

export function accountBasePath(account: AccountRef): string {
  return account.account === 'personal'
    ? '/dashboard/personal'
    : `/dashboard/o/${account.publicId}`
}

/** Cache-key fragment: 'personal' or 'org:<publicId>'. */
export function accountKey(account: AccountRef | null): string {
  return account && account.account === 'org' ? `org:${account.publicId}` : 'personal'
}
