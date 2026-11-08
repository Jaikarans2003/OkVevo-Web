'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import LoadingScreen from '@/components/shared/LoadingScreen';

// The tab's first page shows the full loader animation (loading-screen.css: drawn by ~2s, work flowing from ~1.9s) and holds it
// until at least MIN_PLAY_MS after navigation start, even on a fast load, then lifts away.
// Later pages and reloads (the layout's head script sets data-loader="quick") skip it: the site is already warm,
// and route-level loaders (app/loading.tsx, billing, profile) show the quick variant only while really waiting.
const MIN_PLAY_MS = 3000;

export function AppLoadingGate({ children }: { children: React.ReactNode }) {
    const { loading: authLoading } = useAuth();
    const [done, setDone] = useState(false);
    const [fadingOut, setFadingOut] = useState(false);

    useEffect(() => {
        if (done || fadingOut) return;
        if (document.documentElement.dataset.loader === 'quick') {
            setDone(true);
            return;
        }
        if (authLoading) return;
        const timer = setTimeout(() => setFadingOut(true), Math.max(0, MIN_PLAY_MS - performance.now()));
        return () => clearTimeout(timer);
    }, [authLoading, done, fadingOut]);

    return (
        <>
            {children}
            {done ? null : (
                <LoadingScreen variant="full" fadingOut={fadingOut} onFadeComplete={() => setDone(true)} />
            )}
        </>
    );
}
