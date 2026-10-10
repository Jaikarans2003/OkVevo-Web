'use client';

import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';

import { auth } from '@/config/firebase';

export default function SignInIsland() {
  const [msg, setMsg] = useState('Checking sign-in…');

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setMsg('Sign in at /login, then open this page again.');
          return;
        }
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/session', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          window.location.reload();
          return;
        }
        setMsg('This page does not exist.');
      }),
    []
  );

  return (
    <main style={{ padding: 48, fontFamily: 'monospace' }}>
      <p>{msg}</p>
    </main>
  );
}
