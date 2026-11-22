'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
    CreditCard,
    LayoutDashboard,
    LogOut,
    User,
} from 'lucide-react';

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
    SidebarProvider,
    SidebarRail,
    SidebarSeparator,
    SidebarTrigger,
} from '@/components/ui/sidebar';
import { auth } from '@/config/firebase';
import { authedJson } from '@/lib/api/browser';
import type { MePayload } from '@/lib/api/me';
import {
    readActiveOrgPublicId,
    resolveActiveOrg,
    writeActiveOrgPublicId,
} from '@/lib/orgs/activeOrg';
import {
    dashboardNavForRole,
    dashboardNavLabel,
} from '@/lib/orgs/dashboardHelpers';
import '@/components/landing-page/okvevo-landing.css';
import './portal.css';

const LOGO = '/OKVEVO%20Logos%20WithOut%20BackGrounds/Orange.svg';

function navIsCurrent(pathname: string | null, href: string): boolean {
    if (!pathname) return false;
    if (href === '/dashboard') {
        return pathname === '/dashboard' || pathname === '/dashboard/';
    }
    return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [me, setMe] = useState<MePayload | null>(null);
    const [activeOrg, setActiveOrg] = useState<string | null>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setMe(null);
                setActiveOrg(null);
                return;
            }
            try {
                const payload = await authedJson<MePayload>(user, '/api/me');
                setMe(payload);
                const resolved = resolveActiveOrg({
                    stored: readActiveOrgPublicId(),
                    hidePersonal: payload.hidePersonal,
                    upgradedOrgPublicId: payload.upgradedOrgPublicId,
                    memberships: payload.memberships,
                });
                writeActiveOrgPublicId(resolved);
                setActiveOrg(resolved);
            } catch (e) {
                console.error('DashboardShell /api/me', e);
            }
        });
        return () => unsub();
    }, []);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            writeActiveOrgPublicId(null);
            router.push('/login');
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    const onAccountChange = (value: string) => {
        const next = value === '' ? null : value;
        writeActiveOrgPublicId(next);
        setActiveOrg(next);
        router.refresh();
        window.location.reload();
    };

    const showSwitcher =
        me && (me.memberships.length > 0 || !me.hidePersonal);

    const activeRole = useMemo(() => {
        if (!me || !activeOrg) return null;
        return me.memberships.find((m) => m.orgPublicId === activeOrg)?.role ?? null;
    }, [me, activeOrg]);

    const dashNav = dashboardNavForRole(activeRole);
    const dashLabel = dashboardNavLabel(dashNav);

    const navItems = useMemo(() => {
        const items: Array<{
            name: string;
            href: string;
            icon: typeof LayoutDashboard;
        }> = [];

        if (!activeOrg) {
            items.push({
                name: 'Overview',
                href: '/dashboard',
                icon: LayoutDashboard,
            });
        } else if (dashLabel) {
            items.push({
                name: dashLabel,
                href: '/dashboard',
                icon: LayoutDashboard,
            });
        }

        items.push(
            { name: 'Billing', href: '/dashboard/billing', icon: CreditCard },
            { name: 'Profile', href: '/dashboard/profile', icon: User }
        );

        return items;
    }, [activeOrg, dashLabel]);

    const activeMembership = useMemo(
        () => me?.memberships.find((m) => m.orgPublicId === activeOrg),
        [me, activeOrg]
    );
    const isSuperOrgOwner =
        activeMembership?.kind === 'super_org' &&
        dashboardNavForRole(activeRole) === 'dashboard';

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
                        {showSwitcher && me ? (
                            <label className="grid gap-1.5 px-1 group-data-[collapsible=icon]:hidden">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                                    Use credits from
                                </span>
                                <select
                                    aria-label="Use credits from"
                                    value={activeOrg ?? ''}
                                    onChange={(e) => onAccountChange(e.target.value)}
                                    className="pt-input h-9 w-full text-sm"
                                >
                                    {!me.hidePersonal ? (
                                        <option value="">Personal</option>
                                    ) : null}
                                    {me.memberships.map((m) => (
                                        <option key={m.orgPublicId} value={m.orgPublicId}>
                                            {m.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        ) : null}
                    </SidebarHeader>

                    <SidebarContent>
                        <SidebarGroup>
                            <SidebarGroupLabel className="text-[var(--muted)]">
                                Account
                            </SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {navItems.map((item) => (
                                        <SidebarMenuItem key={item.href}>
                                            <SidebarMenuButton
                                                asChild
                                                isActive={navIsCurrent(pathname, item.href)}
                                                tooltip={item.name}
                                                className="rounded-full data-[active=true]:bg-[var(--orange)] data-[active=true]:font-medium data-[active=true]:text-[var(--ink)] data-[active=true]:shadow-[inset_0_0_0_1.5px_var(--ink)]"
                                            >
                                                <Link
                                                    href={item.href}
                                                    aria-current={
                                                        navIsCurrent(pathname, item.href)
                                                            ? 'page'
                                                            : undefined
                                                    }
                                                >
                                                    <item.icon aria-hidden />
                                                    <span>{item.name}</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>

                        {isSuperOrgOwner ? (
                            <>
                                <SidebarSeparator className="bg-[var(--rule)]" />
                                <SidebarGroup>
                                    <SidebarGroupLabel className="text-[var(--muted)]">
                                        Organisations
                                    </SidebarGroupLabel>
                                    <SidebarGroupContent>
                                        <p className="px-2 text-xs leading-relaxed text-[var(--ink-2)] group-data-[collapsible=icon]:hidden">
                                            Child organisations appear on the overview page.
                                        </p>
                                    </SidebarGroupContent>
                                </SidebarGroup>
                            </>
                        ) : null}
                    </SidebarContent>

                    <SidebarFooter className="border-t border-[var(--rule)] p-2">
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    type="button"
                                    onClick={handleSignOut}
                                    aria-label="Sign out"
                                    className="rounded-full"
                                >
                                    <LogOut aria-hidden />
                                    <span>Sign out</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarFooter>
                    <SidebarRail />
                </Sidebar>

                <SidebarInset className="ok-landing bg-[var(--paper)]">
                    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--rule)] bg-[var(--grain),var(--card)] px-4 md:hidden">
                        <SidebarTrigger aria-label="Open navigation menu" />
                        <span className="font-[family-name:var(--f-head)] text-lg italic">
                            Account
                        </span>
                    </header>
                    <main id="main" className="pt-main dashboard-main">
                        {children}
                    </main>
                </SidebarInset>
        </SidebarProvider>
    );
}