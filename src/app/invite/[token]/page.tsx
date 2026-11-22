'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import PortalShell from '@/components/portal/PortalShell';
import LoadingScreen from '@/components/shared/LoadingScreen';
import { auth } from '@/config/firebase';
import { authedJson } from '@/lib/api/browser';

export default function InviteTokenPage() {
  const params = useParams();
  const token = typeof params.token === 'string' ? params.token : '';
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) router.push(`/login?next=/invite/${encodeURIComponent(token)}`);
      setLoading(false);
    });
    return () => unsub();
  }, [router, token]);

  async function act(kind: 'accept' | 'decline') {
    if (!user || !token) return;
    setBusy(true);
    setMessage('');
    try {
      await authedJson(user, kind === 'accept' ? '/api/invitations/accept' : '/api/invitations/decline', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      setMessage(kind === 'accept' ? 'You joined the organisation.' : 'Invitation declined.');
      router.push('/profile');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingScreen />;

  return (
    <PortalShell>
      <div className="pt-fact" style={{ maxWidth: 480, margin: '40px auto' }}>
        <h1 className="pt-label">Organisation invitation</h1>
        <p className="pt-fine">Accept with your verified sign-in email, or decline to stay out.</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button type="button" className="btn btn--go" disabled={busy} onClick={() => act('accept')}>
            Accept
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => act('decline')}>
            Decline
          </button>
        </div>
        {message ? <p className="pt-fine" style={{ marginTop: 12 }}>{message}</p> : null}
      </div>
    </PortalShell>
  );
}