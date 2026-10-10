'use client';

/**
 * Admin dashboard for the Fal drama gateway. Server verifies the admin
 * claim on every API call — a non-admin gets a 404 from the API and this
 * page renders as not-found. All data is pre-aggregated adminRollups +
 * opsAlerts; the only write control is the kill switch.
 */

import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';

import { auth } from '@/config/firebase';

type Rollup = {
  day: string;
  spend: {
    falUsd: number;
    creditsCharged: number;
    marginEstimate: number;
    marginRealized: number | null;
    billedVsLedger: Record<string, { billedUsd: number; ledgerUsd: number; driftUsd: number }>;
    byEndpoint: Record<string, { falUsd: number; creditsCharged: number; jobs: number; marginEstimate: number }>;
    overReserveEvents: number;
  };
  jobs: {
    settled: number;
    released: number;
    successRate: number;
    avgSettleMs: number;
    byEndpoint: Record<string, { settled: number; released: number }>;
  };
  holds: { unknown: number; reservedOld: number; submittedOld: number };
  breaker: { limitUsd: number; usedPct: number };
  topUsers: { uid: string; email: string; creditsCharged: number }[];
  priceHealth?: { endpoint: string; level: string; note: string }[];
  writtenAt?: { toMillis?: () => number };
};

type Data = {
  rollup: Rollup | null;
  killSwitch: { disabled: boolean };
  heartbeat: { checkedAtMs: number | null; stale: boolean };
  highAlerts: { id: string; condition?: string; text?: string; day?: string }[];
  spendToday: { falUsd?: number; creditsCharged?: number; jobs?: number };
  breakerLimitUsd: number;
  voices?: { cloned: number; expiringWithin1Day: number };
};

function fmtUsd(n: number | undefined): string {
  return `$${(n ?? 0).toFixed(2)}`;
}

function bar(pct: number): React.CSSProperties {
  const clamped = Math.max(0, Math.min(100, pct));
  return {
    width: `${clamped}%`,
    height: '100%',
    background: clamped >= 100 ? '#b91c1c' : clamped >= 80 ? '#f59e0b' : '#16a34a',
    borderRadius: 4,
  };
}

export default function AdminDramaClient() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [data, setData] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/drama', { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 404) {
        setMissing(true);
        return;
      }
      setData((await res.json()) as Data);
    })();
  }, [user]);

  async function toggleKillSwitch() {
    if (!user || !data) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/drama/kill-switch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled: !data.killSwitch.disabled }),
      });
      if (res.ok) {
        const body = (await res.json()) as { disabled: boolean };
        setData({ ...data, killSwitch: { disabled: body.disabled } });
      }
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (missing || user === null) {
    return (
      <main style={{ padding: 48, fontFamily: 'monospace' }}>
        <h1>404</h1>
        <p>This page does not exist.</p>
      </main>
    );
  }
  if (!user || !data) {
    return <main style={{ padding: 48, fontFamily: 'monospace' }}>Loading…</main>;
  }

  const r = data.rollup;
  const spend = r?.spend;
  const usedPct = data.breakerLimitUsd > 0 ? (100 * (data.spendToday.falUsd ?? 0)) / data.breakerLimitUsd : 0;

  return (
    <main style={{ padding: 32, fontFamily: 'monospace', maxWidth: 960, margin: '0 auto' }}>
      <h1>Drama / Fal gateway — admin</h1>

      <p>
        Heartbeat:{' '}
        {data.heartbeat.checkedAtMs ? new Date(data.heartbeat.checkedAtMs).toLocaleString() : 'never'}{' '}
        {data.heartbeat.stale && (
          <strong style={{ color: '#b91c1c' }}>STALE (older than 26 h — check the cron)</strong>
        )}
      </p>

      {data.highAlerts.length > 0 && (
        <div style={{ background: '#fee2e2', border: '1px solid #b91c1c', padding: 12, marginBottom: 16 }}>
          <strong>HIGH alerts ({data.highAlerts.length})</strong>
          <ul>
            {data.highAlerts.map((a) => (
              <li key={a.id}>
                [{a.condition}] {a.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section style={{ marginBottom: 24 }}>
        <h2>Kill switch {data.killSwitch.disabled && <span style={{ color: '#b91c1c' }}>(ON — drama submits blocked)</span>}</h2>
        {confirming ? (
          <span>
            Really {data.killSwitch.disabled ? 'enable' : 'disable'} all drama submits?{' '}
            <button disabled={busy} onClick={() => void toggleKillSwitch()}>
              Confirm
            </button>{' '}
            <button disabled={busy} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button onClick={() => setConfirming(true)}>
            {data.killSwitch.disabled ? 'Disable kill switch' : 'Enable kill switch'}
          </button>
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Cloned voices</h2>
        <p>
          Cloned: <strong>{data.voices?.cloned ?? 0}</strong>
          {' · '}Expiring within 1 day (unused, Fal 7-day window):{' '}
          <strong>{data.voices?.expiringWithin1Day ?? 0}</strong>
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Spend today ({r?.day ?? '—'})</h2>
        <p>
          Fal raw (ledger): <strong>{fmtUsd(data.spendToday.falUsd)}</strong> · Credits charged:{' '}
          <strong>{data.spendToday.creditsCharged ?? 0}</strong> · Est. margin:{' '}
          <strong>{spend?.marginEstimate != null ? (spend.marginEstimate * 100).toFixed(1) + '%' : '—'}</strong>
          {' · '}Realized margin:{' '}
          <strong>{spend?.marginRealized != null ? (spend.marginRealized * 100).toFixed(1) + '%' : 'waiting on capture'}</strong>
          {' · '}Fal &gt; reserve events: <strong>{spend?.overReserveEvents ?? 0}</strong>
        </p>
        <div style={{ background: '#e5e7eb', borderRadius: 4, height: 12, width: '100%' }}>
          <div style={bar(usedPct)} />
        </div>
        <p>
          Circuit breaker: {usedPct.toFixed(1)}% of ${data.breakerLimitUsd}/day
          {usedPct >= 100 ? ' — HARD STOP' : usedPct >= 80 ? ' — HIGH (80%)' : ''}
        </p>
        {spend && Object.keys(spend.byEndpoint).length > 0 && (
          <table border={1} cellPadding={6} style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Jobs</th>
                <th>Fal USD</th>
                <th>Credits</th>
                <th>Est. margin</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(spend.byEndpoint).map(([ep, v]) => (
                <tr key={ep}>
                  <td>{ep}</td>
                  <td>{v.jobs}</td>
                  <td>{fmtUsd(v.falUsd)}</td>
                  <td>{v.creditsCharged}</td>
                  <td>{fmtUsd(v.marginEstimate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {spend && spend.billedVsLedger && Object.keys(spend.billedVsLedger).length > 0 && (
          <table border={1} cellPadding={6} style={{ borderCollapse: 'collapse', width: '100%', marginTop: 12 }}>
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Fal billed</th>
                <th>Ledger (formula)</th>
                <th>Drift</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(spend.billedVsLedger).map(([ep, v]) => (
                <tr key={ep}>
                  <td>{ep}</td>
                  <td>{fmtUsd(v.billedUsd)}</td>
                  <td>{fmtUsd(v.ledgerUsd)}</td>
                  <td>{fmtUsd(v.driftUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {r && (
        <section style={{ marginBottom: 24 }}>
          <h2>Jobs today</h2>
          <p>
            Settled {r.jobs.settled} · Released {r.jobs.released} · Success{' '}
            {(100 * r.jobs.successRate).toFixed(0)}% · Avg settle{' '}
            {(r.jobs.avgSettleMs / 1000).toFixed(0)}s
          </p>
          <p>
            Holds: unknown {r.holds.unknown} · reserved &gt; 30 min {r.holds.reservedOld} · submitted
            &gt; 6 h {r.holds.submittedOld}
          </p>
        </section>
      )}

      {r?.priceHealth && r.priceHealth.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2>Price health</h2>
          <ul>
            {r.priceHealth.map((p) => (
              <li key={p.endpoint} style={{ color: p.level === 'high' ? '#b91c1c' : undefined }}>
                [{p.level.toUpperCase()}] {p.endpoint}: {p.note}
              </li>
            ))}
          </ul>
        </section>
      )}

      {r && r.topUsers.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2>Top users today</h2>
          <table border={1} cellPadding={6} style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Email</th>
                <th>UID</th>
                <th>Credits charged</th>
              </tr>
            </thead>
            <tbody>
              {r.topUsers.map((u) => (
                <tr key={u.uid}>
                  <td>{u.email || '—'}</td>
                  <td style={{ fontSize: 11 }}>{u.uid}</td>
                  <td>{u.creditsCharged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
