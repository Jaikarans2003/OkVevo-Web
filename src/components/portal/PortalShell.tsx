'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { LogOut } from 'lucide-react';
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

// Frame for the account pages: the landing's paper, inks and printed top bar.
// Signed out (login) the bar only leads back to the site.
export default function PortalShell({ children, signedIn = true }: { children: React.ReactNode; signedIn?: boolean }) {
    const pathname = usePathname();
    const router = useRouter();
    const [me, setMe] = useState<MePayload | null>(null);
    const [activeOrg, setActiveOrg] = useState<string | null>(null);

    useEffect(() => {
        if (!signedIn) return;
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
                console.error('PortalShell /api/me', e);
            }
        });
        return () => unsub();
    }, [signedIn]);

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
        // No reload: the URL-scoped dashboard passes org explicitly per
        // request; this shell only remains on signed-out pages (login).
    };

    const showSwitcher =
        signedIn &&
        me &&
        (me.memberships.length > 0 || !me.hidePersonal);

    const activeRole = useMemo(() => {
        if (!me || !activeOrg) return null;
        return me.memberships.find((m) => m.orgPublicId === activeOrg)?.role ?? null;
    }, [me, activeOrg]);

    const dashNav = dashboardNavForRole(activeRole);
    const dashLabel = dashboardNavLabel(dashNav);

    const links = useMemo(() => {
        const base: Array<{ name: string; href: string }> = [];
        if (dashLabel) {
            base.push({ name: dashLabel, href: '/dashboard' });
        }
        base.push(
            { name: 'Billing', href: '/dashboard/billing' },
            { name: 'Profile', href: '/dashboard/profile' }
        );
        return base;
    }, [dashLabel]);

    return (
        <div className="ok-landing portal">
            <header className="pt-bar">
                <div className="pt-bar-in">
                    <Link href="/" aria-label="OkVevo home" className="pt-logo">
                        <img src={LOGO} alt="" width={44} height={44} />
                    </Link>
                    {signedIn ? (
                        <nav aria-label="Account">
                            {showSwitcher ? (
                                <label className="pt-link" style={{ gap: 6 }}>
                                    <span className="lbl-long">Use credits from</span>
                                    <select
                                        aria-label="Use credits from"
                                        value={activeOrg ?? ''}
                                        onChange={(e) => onAccountChange(e.target.value)}
                                        className="pt-input"
                                        style={{ minWidth: 140, padding: '4px 8px', fontSize: 13 }}
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
                            {links.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="pt-link"
                                    aria-current={pathname?.startsWith(link.href) ? 'page' : undefined}
                                >
                                    {link.name}
                                </Link>
                            ))}
                            <button type="button" className="pt-link" onClick={handleSignOut} aria-label="Sign out">
                                <LogOut size={15} strokeWidth={1.75} aria-hidden />
                                <span className="lbl-long">Sign out</span>
                            </button>
                        </nav>
                    ) : (
                        <Link href="/" className="pt-link">Back to site</Link>
                    )}
                </div>
            </header>
            <main id="main" className="pt-main">{children}</main>
        </div>
    );
}
