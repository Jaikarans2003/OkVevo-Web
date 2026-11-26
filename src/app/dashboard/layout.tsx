'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import DashboardShell from '@/components/portal/DashboardShell';
import { PortalAuthProvider } from '@/components/portal/PortalAuth';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    // One client cache for the whole dashboard (plan §5). Devtools-free.
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: { staleTime: 30_000, refetchOnWindowFocus: true },
                },
            })
    );

    return (
        <PortalAuthProvider>
            <QueryClientProvider client={queryClient}>
                <DashboardShell>{children}</DashboardShell>
            </QueryClientProvider>
        </PortalAuthProvider>
    );
}
