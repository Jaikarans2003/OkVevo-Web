'use client';

/**
 * /dashboard/billing[...] — deep-link redirect (plan §3): resolve the active
 * account, then replace with /dashboard/{account}/billing/{slug}, keeping the
 * query string. L2 desktop deeplinks and the /billing 308s land here.
 */
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import DashboardContentSkeleton from '@/components/portal/DashboardContentSkeleton';
import { usePortalAuth } from '@/components/portal/PortalAuth';
import { useMe } from '@/hooks/useAuthedQuery';
import { readActiveOrgPublicId, resolveActiveOrg } from '@/lib/orgs/activeOrg';

export default function BillingDeepLinkRedirect() {
    const router = useRouter();
    const params = useParams<{ slug?: string[] }>();
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
        const base = resolved ? `/dashboard/o/${resolved}` : '/dashboard/personal';
        const slug = params.slug?.length ? `/${params.slug.join('/')}` : '';
        // window.location.search keeps the query string; avoids a
        // useSearchParams Suspense requirement on this client-only page.
        const search = window.location.search;
        router.replace(`${base}/billing${slug}${search}`);
    }, [ready, user, me.data, params.slug, router]);

    return <DashboardContentSkeleton />;
}
