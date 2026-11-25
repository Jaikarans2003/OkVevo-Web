'use client';

/**
 * Personal account subtree (plan §1, §3, §9). Provides the account to every
 * fetch below, records the visit as last-used, and redirects to the upgraded
 * org when Personal is hidden.
 */
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import AccessGate from '@/components/portal/AccessGate';
import DashboardContentSkeleton from '@/components/portal/DashboardContentSkeleton';
import { dashboardMenu, allowedSegments } from '@/components/portal/nav';
import { useMe } from '@/hooks/useAuthedQuery';
import { AccountProvider } from '@/lib/orgs/accountContext';
import { writeActiveOrgPublicId } from '@/lib/orgs/activeOrg';

const ACCOUNT = { account: 'personal' } as const;
const ALLOWED = allowedSegments(dashboardMenu({ account: ACCOUNT, role: null, kind: null }));

export default function PersonalLayout({ children }: { children: ReactNode }) {
    const router = useRouter();
    const me = useMe();

    // Visiting Personal records it as the last-used account.
    useEffect(() => {
        writeActiveOrgPublicId(null);
    }, []);

    const upgradedTo = me.data?.hidePersonal ? me.data.upgradedOrgPublicId : null;
    useEffect(() => {
        if (upgradedTo) router.replace(`/dashboard/o/${upgradedTo}`);
    }, [upgradedTo, router]);

    if (!me.data || upgradedTo) return <DashboardContentSkeleton />;

    return (
        <AccountProvider account={ACCOUNT}>
            <AccessGate allowed={ALLOWED}>{children}</AccessGate>
        </AccountProvider>
    );
}
