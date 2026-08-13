'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import LoadingScreen from '@/components/LoadingScreen';

export function AppLoadingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading: authLoading } = useAuth();

  const [overlayActive, setOverlayActive] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const prevPathname = useRef(pathname);

  useLayoutEffect(() => {
    if (authLoading) {
      setOverlayActive(true);
      setFadingOut(false);
    }
  }, [authLoading]);

  useLayoutEffect(() => {
    if (prevPathname.current === pathname) return;
    prevPathname.current = pathname;
    setOverlayActive(true);
    setFadingOut(false);
  }, [pathname]);

  useEffect(() => {
    if (authLoading || !overlayActive || fadingOut) return;
    // Double rAF so destination page can paint its LoadingScreen underneath before fade.
    let innerId = 0;
    const outerId = requestAnimationFrame(() => {
      innerId = requestAnimationFrame(() => setFadingOut(true));
    });
    return () => {
      cancelAnimationFrame(outerId);
      cancelAnimationFrame(innerId);
    };
  }, [authLoading, overlayActive, fadingOut, pathname]);

  const showOverlay = authLoading || overlayActive;

  return (
    <>
      {children}
      {showOverlay ? (
        <LoadingScreen
          loadKey={pathname}
          fadingOut={fadingOut && !authLoading}
          onFadeComplete={() => {
            setOverlayActive(false);
            setFadingOut(false);
          }}
        />
      ) : null}
    </>
  );
}
