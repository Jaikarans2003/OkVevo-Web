'use client';

/**
 * URL-scoped dashboard shell (plan §1, §7). Account comes from the URL
 * (/dashboard/personal, /dashboard/o/:publicId); switching accounts is plain
 * navigation — never a hard page reload. Data comes from the one TanStack
 * Query cache (useMe / useOrgDetail share keys with the account layouts, so
 * nothing fetches twice).
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { signOut } from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronsUpDown, LogOut, User } from 'lucide-react';

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSkeleton,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
} from '@/components/ui/sidebar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { auth } from '@/config/firebase';
import AccountSwitcher from '@/components/portal/AccountSwitcher';
import DashboardBreadcrumb from '@/components/portal/DashboardBreadcrumb';
import { useMe, useOrgDetail } from '@/hooks/useAuthedQuery';
import {
    readActiveOrgPublicId,
    resolveActiveOrg,
    writeActiveOrgPublicId,
} from '@/lib/orgs/activeOrg';
import type { AccountRef } from '@/lib/orgs/accountContext';
import { dashboardMenu, navItemHref } from '@/components/portal/nav';
import '@/components/landing-page/okvevo-landing.css';
import './portal.css';

const LOGO = '/OKVEVO%20Logos%20WithOut%20BackGrounds/Orange.svg';

/** Account-less deep links kept alive: next.config.mjs 308s land on these,
 *  and /dashboard/billing[...] client-redirects to the active account's
 *  billing (L2 desktop deeplinks depend on both). */
const PROFILE_DEEP_LINK = { name: 'Profile', href: '/dashboard/profile' } as const;
const BILLING_DEEP_LINK = { name: 'Billing', href: '/dashboard/billing' } as const;

/** Active account from the URL; null on account-less pages (profile, redirects). */
function accountFromPath(pathname: string | null): AccountRef | null {
    const seg = (pathname ?? '').split('/').filter(Boolean);
    if (seg[0] !== 'dashboard') return null;
    if (seg[1] === 'personal') return { account: 'personal' };
    if (seg[1] === 'o' && seg[2]) return { account: 'org', publicId: seg[2] };
    return null;
}

function navIsCurrent(pathname: string, href: string, isAccountRoot: boolean): boolean {
    if (isAccountRoot) return pathname === href || pathname === `${href}/`;
    return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const queryClient = useQueryClient();
    const meQuery = useMe();
    const me = meQuery.data ?? null;

    const urlAccount = accountFromPath(pathname);
    const urlOrgId = urlAccount?.account === 'org' ? urlAccount.publicId : null;
    const orgQuery = useOrgDetail(urlOrgId);

    // Account-less pages (profile): show the last-used account's nav.
    const displayAccount: AccountRef | null = useMemo(() => {
        if (urlAccount) return urlAccount;
        if (!me) return null;
        const resolved = resolveActiveOrg({
            stored: readActiveOrgPublicId(),
            hidePersonal: me.hidePersonal,
            upgradedOrgPublicId: me.upgradedOrgPublicId,
            memberships: me.memberships,
        });
        return resolved ? { account: 'org', publicId: resolved } : { account: 'personal' };
    }, [urlAccount, me]);

    const membership = useMemo(() => {
        if (!me || displayAccount?.account !== 'org') return null;
        return (
            me.memberships.find((m) => m.orgPublicId === displayAccount.publicId) ?? null
        );
    }, [me, displayAccount]);

    // Role/kind for menu filtering: org detail wins (covers inherited_read /
    // platform_admin), membership is the instant fallback.
    const orgDetail = orgQuery.data ?? null;
    const role =
        displayAccount?.account === 'org'
            ? (orgDetail?.role ?? membership?.role ?? null)
            : null;
    const kind =
        displayAccount?.account === 'org'
            ? (membership?.kind ?? orgDetail?.org.kind ?? null)
            : null;

    const menu = useMemo(() => {
        if (!displayAccount) return [];
        if (displayAccount.account === 'org' && !membership && orgQuery.isError) {
            // Unreadable org (NoAccess in the content area): minimal nav.
            return dashboardMenu({ account: displayAccount, role: 'member', kind: 'org' });
        }
        return dashboardMenu({ account: displayAccount, role, kind });
    }, [displayAccount, membership, orgQuery.isError, role, kind]);

    const navLoading =
        !me ||
        (displayAccount?.account === 'org' &&
            !membership &&
            orgQuery.isPending &&
            !!urlOrgId);

    const accountName =
        displayAccount?.account === 'org'
            ? (membership?.name ?? orgDetail?.org.name ?? null)
            : null;

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            writeActiveOrgPublicId(null);
            queryClient.clear();
            router.push('/login');
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    const userLabel = me?.user.displayName || me?.user.email || 'Account';

    return (
        <SidebarProvider className="ok-landing portal dashboard-shell min-h-svh w-full">
                <Sidebar collapsible="icon" className="border-[var(--ink)]/15">
                    <SidebarHeader className="gap-3 border-b border-[var(--rule)] p-3">
                        <Link
                            href="/"
                            aria-label="OkVevo home"
                            className="flex items-center gap-2 px-1"
                        >
                            <img src={LOGO} alt="" width={36} height={36} />
                            <span className="font-[family-name:var(--f-head)] text-lg italic group-data-[collapsible=icon]:hidden">
                                OkVevo
                            </span>
                        </Link>
                        <div className="group-data-[collapsible=icon]:hidden">
                            {me ? <AccountSwitcher me={me} account={displayAccount} /> : null}
                        </div>
                    </SidebarHeader>

                    <SidebarContent>
                        <SidebarGroup>
                            <SidebarGroupLabel className="text-[var(--muted)]">
                                Account
                            </SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {navLoading
                                        ? Array.from({ length: 4 }).map((_, i) => (
                                              <SidebarMenuItem key={i}>
                                                  <SidebarMenuSkeleton showIcon />
                                              </SidebarMenuItem>
                                          ))
                                        : menu.map((item) => {
                                              const href = navItemHref(displayAccount!, item);
                                              const current = navIsCurrent(
                                                  pathname ?? '',
                                                  href,
                                                  item.segment === '' && !item.externalHref
                                              );
                                              return (
                                                  <SidebarMenuItem key={item.name}>
                                                      <SidebarMenuButton
                                                          asChild
                                                          isActive={current}
                                                          tooltip={item.name}
                                                          className="rounded-full data-[active=true]:bg-[var(--orange)] data-[active=true]:font-medium data-[active=true]:text-[var(--ink)] data-[active=true]:shadow-[inset_0_0_0_1.5px_var(--ink)]"
                                                      >
                                                          <Link
                                                              href={href}
                                                              aria-current={current ? 'page' : undefined}
                                                          >
                                                              <item.icon aria-hidden />
                                                              <span>{item.name}</span>
                                                          </Link>
                                                      </SidebarMenuButton>
                                                  </SidebarMenuItem>
                                              );
                                          })}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    </SidebarContent>

                    <SidebarFooter className="border-t border-[var(--rule)] p-2">
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <SidebarMenuButton
                                            type="button"
                                            aria-label="Open user menu"
                                            className="rounded-full"
                                        >
                                            <User aria-hidden />
                                            <span className="truncate">{userLabel}</span>
                                            <ChevronsUpDown
                                                aria-hidden
                                                className="ml-auto"
                                                size={15}
                                            />
                                        </SidebarMenuButton>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent side="top" align="start" className="w-56">
                                        <DropdownMenuLabel className="truncate">
                                            {me?.user.email ?? userLabel}
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem asChild>
                                            <Link href={PROFILE_DEEP_LINK.href}>
                                                {PROFILE_DEEP_LINK.name}
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link href={BILLING_DEEP_LINK.href}>
                                                {BILLING_DEEP_LINK.name}
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onSelect={handleSignOut}>
                                            <LogOut aria-hidden size={15} />
                                            Sign out
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarFooter>
                    <SidebarRail />
                </Sidebar>

                <SidebarInset className="ok-landing bg-[var(--paper)]">
                    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--rule)] bg-[var(--grain),var(--card)] px-4">
                        <SidebarTrigger aria-label="Toggle navigation menu" />
                        <DashboardBreadcrumb account={displayAccount} accountName={accountName} />
                    </header>
                    <main id="main" className="pt-main dashboard-main">
                        {children}
                    </main>
                </SidebarInset>
        </SidebarProvider>
    );
}
