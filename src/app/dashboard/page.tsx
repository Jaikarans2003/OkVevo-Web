'use client';

/**
 * /dashboard — tiny client redirect (plan §3): resolve the last-used account
 * against /api/me and replace with its URL. No content lives here.
 */
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import DashboardContentSkeleton from '@/components/portal/DashboardContentSkeleton';
import { usePortalAuth } from '@/components/portal/PortalAuth';
import { useMe } from '@/hooks/useAuthedQuery';
import { readActiveOrgPublicId, resolveActiveOrg } from '@/lib/orgs/activeOrg';

export default function DashboardRedirect() {
    const router = useRouter();
    const { user, ready } = usePortalAuth();
    const me = useMe();

    useEffect(() => {
        if (!ready || !user || !me.data) return;
        const resolved = resolveActiveOrg({
            stored: readActiveOrgPublicId(),
            hidePersonal: me.data.hidePersonal,
            upgradedOrgPublicId: me.data.upgradedOrgPublicId,
            memberships: me.data.memberships,
        });
        router.replace(resolved ? `/dashboard/o/${resolved}` : '/dashboard/personal');
    }, [ready, user, me.data, router]);

    return <DashboardContentSkeleton />;
}
