import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface PipelineState {
  pipelinePhase: number; // 0 = not started, 2-6 = active, 7 = complete
  pipelineStatus: string; // 'running' | 'awaiting_checkpoint' | 'complete' | undefined
  pipelineMode: 'ask' | 'auto';
  skillId?: string | null;
  pendingCheckpointId?: string | null;
  activeRunId?: string | null;
  lastSeq?: number | null;
  videoUrl?: string;
  draftVideoUrl?: string;
  renderStatus?: string;
  renderError?: string;
  pipelineUpdatedAt?: Date;
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  // Must call toDate on the Timestamp itself — unbound extract loses `this`
  // and Firestore throws "Cannot read properties of undefined (reading 'toMillis')".
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    try {
      const d = (value as { toDate: () => Date }).toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : undefined;
    } catch {
      return undefined;
    }
  }
  if (typeof value === 'object' && value !== null) {
    const seconds =
      typeof (value as { seconds?: unknown }).seconds === 'number'
        ? (value as { seconds: number }).seconds
        : typeof (value as { _seconds?: unknown })._seconds === 'number'
          ? (value as { _seconds: number })._seconds
          : null;
    if (seconds != null) {
      const nanos =
        typeof (value as { nanoseconds?: unknown }).nanoseconds === 'number'
          ? (value as { nanoseconds: number }).nanoseconds
          : typeof (value as { _nanoseconds?: unknown })._nanoseconds === 'number'
            ? (value as { _nanoseconds: number })._nanoseconds
            : 0;
      return new Date(seconds * 1000 + nanos / 1e6);
    }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

function mapSessionDoc(
  data: Record<string, unknown>,
  lastSeq: number | null
): PipelineState {
  return {
    pipelinePhase: typeof data.pipelinePhase === 'number' ? data.pipelinePhase : 0,
    pipelineStatus: typeof data.pipelineStatus === 'string' ? data.pipelineStatus : '',
    pipelineMode: data.pipelineMode === 'auto' ? 'auto' : 'ask',
    skillId: typeof data.skillId === 'string' ? data.skillId : null,
    pendingCheckpointId:
      typeof data.pendingCheckpointId === 'string'
        ? data.pendingCheckpointId
        : null,
    activeRunId: typeof data.activeRunId === 'string' ? data.activeRunId : null,
    lastSeq,
    videoUrl: typeof data.videoUrl === 'string' ? data.videoUrl : undefined,
    draftVideoUrl:
      typeof data.draftVideoUrl === 'string' ? data.draftVideoUrl : undefined,
    renderStatus:
      typeof data.renderStatus === 'string' ? data.renderStatus : undefined,
    renderError:
      typeof data.renderError === 'string' ? data.renderError : undefined,
    pipelineUpdatedAt: toDate(data.pipelineUpdatedAt),
  };
}

/** chatStatus kept so callers can pass it; listener stays on while sessionId is set. */
export function usePipelineState(
  sessionId: string | null,
  _chatStatus?: string
): PipelineState | null {
  const [state, setState] = useState<PipelineState | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setState(null);
      return;
    }

    const unsub = onSnapshot(
      doc(db, 'sessions', sessionId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as Record<string, unknown>;
        setState((prev) => mapSessionDoc(data, prev?.lastSeq ?? null));
      },
      (error) => {
        console.error('Pipeline state listener error:', error);
      }
    );

    return () => unsub();
  }, [sessionId]);

  const activeRunId = state?.activeRunId;
  useEffect(() => {
    if (!sessionId || !activeRunId) return;
    const unsub = onSnapshot(
      doc(db, 'sessions', sessionId, 'runs', activeRunId),
      (snap) => {
        const n = snap.data()?.lastSeq;
        setState((prev) =>
          prev ? { ...prev, lastSeq: typeof n === 'number' ? n : 0 } : prev
        );
      },
      (error) => {
        console.error('Pipeline run listener error:', error);
      }
    );
    return () => unsub();
  }, [sessionId, activeRunId]);

  return state;
}
