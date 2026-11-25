'use client';

import OrgSettingsModule from '@/components/portal/dashboard/org/SettingsModule';
import SuperSettingsModule from '@/components/portal/dashboard/superorg/SettingsModule';
import { useOrgContext } from '@/components/portal/dashboard/org/dashboard-hooks';

export default function OrgSettingsPage() {
    const ctx = useOrgContext();
    if (!ctx) return null;
    return ctx.kind === 'super_org' ? <SuperSettingsModule /> : <OrgSettingsModule />;
}
