/**
 * Toggle the drama kill switch and write an audit entry in one transaction.
 *
 *   npx tsx scripts/drama-kill-switch.ts --project okvevo-testing --off
 *   npx tsx scripts/drama-kill-switch.ts --project text2video-16cbf --on
 *
 * --off sets opsConfig/drama.disabled=true (generation stopped).
 * --on sets disabled=false.
 * The transaction re-reads the doc, then writes the flag and an opsAdminAudit
 * row: who, when, old -> new. Production stays off until someone runs --on.
 */

import { spawnSync } from 'node:child_process';

import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

import { planKillSwitch } from '../src/lib/fal/dramaSwitches.ts';

const ALLOWED = new Set(['okvevo-testing', 'text2video-16cbf']);

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(file);
    } catch {
      // optional
    }
  }
}

function arg(name: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 ? String(process.argv[i + 1] ?? '').trim() : '';
}

function gcloudAccount(): string {
  const ran = spawnSync('gcloud', ['config', 'get-value', 'account'], { encoding: 'utf8' });
  const value = (ran.stdout || '').trim();
  if (ran.status === 0 && value && value !== '(unset)') return value;
  return '';
}

function serviceAccount(): { projectId: string; clientEmail: string; json: Record<string, unknown> } | null {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FB_SERVICE_ACCOUNT_KEY || '';
  if (!key) return null;
  try {
    const json = JSON.parse(Buffer.from(key, 'base64').toString('utf-8')) as {
      project_id?: unknown;
      client_email?: unknown;
    };
    const projectId = typeof json.project_id === 'string' ? json.project_id : '';
    const clientEmail = typeof json.client_email === 'string' ? json.client_email : '';
    if (!projectId || !clientEmail) return null;
    return { projectId, clientEmail, json: json as Record<string, unknown> };
  } catch {
    return null;
  }
}

async function main() {
  const project = arg('--project');
  const on = process.argv.includes('--on');
  const off = process.argv.includes('--off');
  if (!ALLOWED.has(project) || on === off) {
    console.error(
      'Usage: npx tsx scripts/drama-kill-switch.ts --project okvevo-testing|text2video-16cbf --on|--off'
    );
    process.exit(1);
  }

  loadEnv();
  const sa = serviceAccount();
  const useKey = sa != null && sa.projectId === project;
  if (sa && !useKey) {
    console.error('service account project does not match --project; using application default credentials');
  }
  if (getApps().length === 0) {
    initializeApp(
      useKey && sa
        ? { credential: cert(sa.json), projectId: project }
        : { credential: applicationDefault(), projectId: project }
    );
  }

  const actor = gcloudAccount() || (useKey && sa ? sa.clientEmail : '');
  if (!actor) {
    console.error('cannot record who toggled the kill switch (no gcloud account or service account email)');
    process.exit(1);
  }

  const disabled = off;
  const db = getFirestore();
  const configRef = db.doc('opsConfig/drama');
  const auditRef = db.collection('opsAdminAudit').doc();
  const plan = await db.runTransaction(async (tx) => {
    const fresh = await tx.get(configRef);
    const next = planKillSwitch({
      current: fresh.data(),
      disabled,
      actor,
      atIso: new Date().toISOString(),
    });
    tx.set(
      configRef,
      {
        disabled: next.disabled,
        updatedBy: next.audit.actor,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    tx.set(auditRef, {
      action: next.audit.action,
      actor: next.audit.actor,
      at: FieldValue.serverTimestamp(),
      atIso: next.audit.at,
      old: next.audit.old,
      new: next.audit.new,
    });
    return next;
  });

  console.log(
    JSON.stringify({
      project,
      actor: plan.audit.actor,
      old: plan.audit.old,
      new: plan.audit.new,
      disabled: plan.disabled,
    })
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : 'kill switch failed');
  process.exit(1);
});
