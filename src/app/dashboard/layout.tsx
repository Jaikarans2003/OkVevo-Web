'use client';

import DashboardShell from '@/components/portal/DashboardShell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return <DashboardShell>{children}</DashboardShell>;
}