import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebase';
import type { FalTaskId } from './falQueue';

export type PendingFalJob = {
  taskId: FalTaskId;
  requestId: string;
  resumeOnCompletion: boolean;
};

export async function persistPendingFalJob(
  sessionId: string,
  job: PendingFalJob
): Promise<void> {
  await db.collection('sessions').doc(sessionId).set({ pendingFalJob: job }, { merge: true });
}

export async function readPendingFalJob(
  sessionId: string
): Promise<PendingFalJob | null> {
  const snap = await db.collection('sessions').doc(sessionId).get();
  const raw = snap.data()?.pendingFalJob;
  if (!raw || typeof raw !== 'object') return null;
  const j = raw as PendingFalJob;
  if (typeof j.requestId !== 'string' || typeof j.taskId !== 'string') return null;
  return {
    taskId: j.taskId,
    requestId: j.requestId,
    resumeOnCompletion: j.resumeOnCompletion === true,
  };
}

export async function clearPendingFalJob(sessionId: string): Promise<void> {
  await db
    .collection('sessions')
    .doc(sessionId)
    .set({ pendingFalJob: FieldValue.delete() }, { merge: true });
}
