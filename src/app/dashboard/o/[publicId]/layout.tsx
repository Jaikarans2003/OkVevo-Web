'use client';

/**
 * Org account subtree (plan §1, §4, §9). The org detail fetch is the access
 * gate: 403/404 from /api/orgs/:publicId renders NoAccess. A successful visit
 * records the org as last-used. Role/kind come from the org detail (members,
 * inherited_read, platform_admin included) with the /api/me membership as
 * instant fallback.
 */
import { useParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import AccessGate from '@/components/portal/AccessGate';
import DashboardContentSkeleton from '@/components/portal/DashboardContentSkeleton';
import NoAccess from '@/components/portal/NoAccess';
import { dashboardMenu, allowedSegments } from '@/components/portal/nav';
import { useMe, useOrgDetail } from '@/hooks/useAuthedQuery';
import { AccountProvider, type AccountRef } from '@/lib/orgs/accountContext';
import { writeActiveOrgPublicId } from '@/lib/orgs/activeOrg';

export default function OrgLayout({ children }: { children: ReactNode }) {
    const params = useParams<{ publicId: string }>();
    const publicId = params.publicId;
    const me = useMe();
    const org = useOrgDetail(publicId);

    const readable = !!org.data;
    useEffect(() => {
        if (readable) writeActiveOrgPublicId(publicId);
    }, [readable, publicId]);

    if (me.isPending || org.isPending) return <DashboardContentSkeleton />;
    if (org.isError || !org.data) return <NoAccess />;

    const membership = me.data?.memberships.find((m) => m.orgPublicId === publicId) ?? null;
    const role = org.data.role ?? membership?.role ?? null;
    const kind = membership?.kind ?? org.data.org.kind ?? null;
    const account: AccountRef = { account: 'org', publicId };
    const allowed = allowedSegments(dashboardMenu({ account, role, kind }));

    return (
        <AccountProvider account={account}>
            <AccessGate allowed={allowed}>{children}</AccessGate>
        </AccountProvider>
    );
}
