'use client';

import { OrgUsageModule } from '@/components/portal/dashboard/org/UsageModule';
import SuperUsageModule from '@/components/portal/dashboard/superorg/UsageModule';
import { useOrgContext } from '@/components/portal/dashboard/org/dashboard-hooks';

export default function OrgUsagePage() {
    const ctx = useOrgContext();
    if (!ctx) return null;
    return ctx.kind === 'super_org' ? <SuperUsageModule /> : <OrgUsageModule />;
}
