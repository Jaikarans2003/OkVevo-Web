'use client';

import OrgOverviewModule from '@/components/portal/dashboard/org/OverviewModule';
import SuperOverviewModule from '@/components/portal/dashboard/superorg/OverviewModule';
import { useOrgContext } from '@/components/portal/dashboard/org/dashboard-hooks';

export default function OrgOverviewPage() {
    const ctx = useOrgContext();
    if (!ctx) return null;
    return ctx.kind === 'super_org' ? <SuperOverviewModule /> : <OrgOverviewModule />;
}
