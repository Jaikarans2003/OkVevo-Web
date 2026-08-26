'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AiStudioChatBar,
  resolveModelApiValue,
  type PendingAttachment,
} from '@/components/workspace/ai-studio/AiStudioChatBar';
import { AiStudioHeroExtras } from '@/components/workspace/ai-studio/AiStudioHeroExtras';
import { AiStudioProjectLoader } from '@/components/workspace/ai-studio/AiStudioProjectLoader';
import { AiStudioTimeline, type TimelineMessage } from '@/components/workspace/ai-studio/AiStudioTimeline';
import { useAiStudioWorkspace } from '@/components/workspace/ai-studio/AiStudioWorkspaceProvider';
import {
  AI_STUDIO_CHAT_COLUMN,
  HERO_LOGO_SRC,
} from '@/components/workspace/ai-studio/constants';
import { HeroTypewriterHeading } from '@/components/workspace/ai-studio/HeroTypewriterHeading';
import { PipelineStatusBar } from '@/components/workspace/ai-studio/PipelineStatusBar';
import { SessionLimitModal } from '@/components/workspace/ai-studio/SessionLimitModal';
import { replaceSessionUrl } from '@/components/workspace/ai-studio/shallowSessionUrl';
import {
  CheckpointFloatingCard,
  type CheckpointAnswerPayload,
  type CheckpointCardData,
} from '@/components/workspace/ai-studio/CheckpointCard';
import { auth, storage } from '@/config/firebase';
import { env } from '@/config/env';
import { useAuth } from '@/hooks/useAuth';
import { usePipelineState } from '@/hooks/usePipelineState';
import { streamRunEventsFromFirestore } from '@/lib/agent/firestoreRunSse';
import { guardSessionLimitResponse } from '@/lib/agent/sessionLimitResponse';
import {
  logAgentPostTtfb,
  logStudioReconnectPath,
  markStudio,
  measureStudio,
  tapUiSseDeltas,
} from '@/lib/agent/studioPerf';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { hasAssetMention, type TaggedAsset } from '@/lib/agent/taggedAssets';
import { skillLabel, skillReadyMessage, skillRequiresUpload } from '@/lib/agent/skillReadyMessage';
import {
  UPLOADED_PHOTO_PREFIX,
  UPLOADED_VIDEO_PREFIX,
  nextUploadLabel,
} from '@/lib/agent/uploadAssetLabel';

type SessionAsset = TaggedAsset & {
  id: string;
  kind: string;
  createdAt: string | null;
};

// ponytail: Hosting buffers SSE through rewrites — temporary Cloud Run origin bypass.
// Ceiling: classic Hosting only. After App Hosting migration, drop NEXT_PUBLIC_AGENT_API_ORIGIN and use same-origin /api/agent.
const AGENT_API_ORIGIN = env.agentApiOrigin;
const AGENT_API = AGENT_API_ORIGIN ? `${AGENT_API_ORIGIN}/api/agent` : '/api/agent';
const MAX_PENDING_ATTACHMENTS = 2;

interface AiStudioShellProps {
  userId: string;
}

type SessionMessageRow = {
  id?: string;
  role: string;
  content: string;
  parts?: Array<{
    type: string;
    text?: string;
    toolName?: string;
    state?: string;
    input?: unknown;
    output?: unknown;
    errorText?: string;
    toolCallId?: string;
  }>;
  createdAt?: string | null;
  videoUrl?: string;
  videoName?: string;
  imageUrl?: string;
  taggedAssets?: TaggedAsset[];
};

type SessionSnapshot = {
  messages: UIMessage[];
  lastSeq: number | null;
  activeRunId: string | null;
};

function mapSessionRows(sessionId: string, rows: SessionMessageRow[]): UIMessage[] {
  return rows.map((msg, index) => ({
    id: typeof msg.id === 'string' && msg.id ? msg.id : `${sessionId}-${index}`,
    role: msg.role as 'user' | 'assistant',
    parts:
      msg.parts && msg.parts.length > 0
        ? (msg.parts as UIMessage['parts'])
        : [{ type: 'text' as const, text: msg.content }],
    metadata: {
      ...(msg.createdAt ? { createdAt: msg.createdAt } : {}),
      ...(msg.videoUrl ? { videoUrl: msg.videoUrl } : {}),
      ...(msg.videoName ? { videoName: msg.videoName } : {}),
      ...(msg.imageUrl ? { imageUrl: msg.imageUrl } : {}),
      ...(msg.taggedAssets?.length ? { taggedAssets: msg.taggedAssets } : {}),
    },
  }));
}

async function fetchSessionSnapshot(sessionId: string): Promise<SessionSnapshot> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/agent/sessions/${sessionId}`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to load session messages');
  }

  const payload = (await response.json()) as
    | SessionMessageRow[]
    | {
        messages: SessionMessageRow[];
        lastSeq?: number | null;
        activeRunId?: string | null;
      };

  const rows = Array.isArray(payload) ? payload : payload.messages;
  return {
    messages: mapSessionRows(sessionId, rows ?? []),
    lastSeq: Array.isArray(payload)
      ? null
      : typeof payload.lastSeq === 'number'
        ? payload.lastSeq
        : null,
    activeRunId: Array.isArray(payload)
      ? null
      : typeof payload.activeRunId === 'string'
        ? payload.activeRunId
        : null,
  };
}

async function fetchSessionMessages(sessionId: string): Promise<UIMessage[]> {
  return (await fetchSessionSnapshot(sessionId)).messages;
}

async function fetchSessionAssets(
  sessionId: string,
  signal?: AbortSignal
): Promise<SessionAsset[]> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) return [];
  const response = await fetch(`/api/agent/sessions/${sessionId}/assets`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error('Failed to load session assets');
  return (await response.json()) as SessionAsset[];
}

async function ensureSessionDoc(sessionId: string): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(`/api/agent/sessions/${sessionId}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to ensure session');
}

function triggerBlobDownload(blob: Blob, label: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = label || 'download';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

/** Download whole-session zip; returns exportToken from response header. */
async function downloadSessionExport(sessionId: string): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(`/api/agent/sessions/${sessionId}/export`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Export failed: ${response.status}`);
  }
  const exportToken = response.headers.get('x-okvevo-export-token');
  if (!exportToken) throw new Error('Export missing confirmation token');
  triggerBlobDownload(
    await response.blob(),
    `session-${sessionId}.zip`
  );
  return exportToken;
}

async function purgeSession(
  sessionId: string,
  exportToken: string
): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(`/api/agent/sessions/${sessionId}/purge`, {
    method: 'DELETE',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ confirm: true, exportToken }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Purge failed: ${response.status}`);
  }
}

function messageHasMediaUrl(
  list: Array<{ metadata?: unknown }>,
  url: string,
  kind: 'image' | 'video'
): boolean {
  return list.some((m) => {
    const meta = m.metadata as { imageUrl?: string; videoUrl?: string } | undefined;
    return kind === 'image' ? meta?.imageUrl === url : meta?.videoUrl === url;
  });
}

export default function AiStudioShell({ userId }: AiStudioShellProps) {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const {
    activeSessionId,
    draftChatId,
    commitSession,
    setActiveSessionId,
    refreshSessions,
    setDeliverablesOpen,
    setShowDeliverablesToggle,
    setDraftVideoUrl,
    setRenderedVideos,
    setDeliverableImages,
    startNewProject,
  } = useAiStudioWorkspace();
  const chatId = activeSessionId ?? draftChatId;
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('minimax/minimax-m3');
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [pipelineMode, setPipelineMode] = useState<'ask' | 'auto'>('ask');
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [availableAssets, setAvailableAssets] = useState<SessionAsset[]>([]);
  const [draftTaggedAssets, setDraftTaggedAssets] = useState<TaggedAsset[]>([]);
  const [sessionLimitOpen, setSessionLimitOpen] = useState(false);
  const [sessionLimitTokens, setSessionLimitTokens] = useState<number | null>(
    null
  );
  const [sessionTokenWarning, setSessionTokenWarning] = useState<number | null>(
    null
  );
  const [exportBusy, setExportBusy] = useState(false);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [pendingExportToken, setPendingExportToken] = useState<string | null>(
    null
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([]);
  const selectedModelRef = useRef(selectedModel);
  const userIdRef = useRef(userId);
  const activeSkillRef = useRef<string | null>(null);
  const pipelineModeRef = useRef(pipelineMode);
  const pipelineSkillIdRef = useRef<string | null | undefined>(null);
  const checkpointAnswerRef = useRef<{
    checkpointId: string;
    type: CheckpointAnswerPayload['type'];
    text: string;
    choiceId?: string;
  } | null>(null);
  const chatIdRef = useRef(chatId);
  const skipFetchRef = useRef(false);
  const loadedSessionRef = useRef<string | null>(null);
  const streamCursorRef = useRef<number>(0);
  const resumeKeyRef = useRef<string | null>(null);
  const resumeBackoffRef = useRef(0);
  const activeRunIdRef = useRef<string | null>(null);
  const [resumeNonce, setResumeNonce] = useState(0);
  const [sessionReady, setSessionReady] = useState(false);
  const wasFirstMessageRef = useRef(false);
  const draftTaggedAssetsRef = useRef<TaggedAsset[]>([]);
  const messagesRef = useRef<UIMessage[]>([]);
  const submittingRef = useRef(false);
  const [isPreparingSend, setIsPreparingSend] = useState(false);
  selectedModelRef.current = selectedModel;
  userIdRef.current = userId;
  pendingAttachmentsRef.current = pendingAttachments;
  activeSkillRef.current = activeSkill;
  pipelineModeRef.current = pipelineMode;
  chatIdRef.current = chatId;
  draftTaggedAssetsRef.current = draftTaggedAssets;

  const readyMediaUrls = pendingAttachments
    .filter((a) => a.downloadUrl)
    .map((a) => a.downloadUrl as string);
  const isUploading = pendingAttachments.some((a) => a.progress !== null);

  // Ready pendings share nextUploadLabel + kind filter with PATCH registerUpload.
  const mentionableAssets = useMemo(() => {
    const registeredUrls = new Set(availableAssets.map((a) => a.url));
    const videoLabels = availableAssets
      .filter((a) => a.kind === 'uploaded_video')
      .map((a) => a.label);
    const photoLabels = availableAssets
      .filter((a) => a.kind === 'uploaded_image')
      .map((a) => a.label);
    const provisional: TaggedAsset[] = [];
    for (const pending of pendingAttachments) {
      if (!pending.downloadUrl || registeredUrls.has(pending.downloadUrl)) continue;
      const isVideo = pending.kind === 'video';
      const prefix = isVideo ? UPLOADED_VIDEO_PREFIX : UPLOADED_PHOTO_PREFIX;
      const minted = provisional
        .filter((a) => a.type === pending.kind)
        .map((a) => a.label);
      const label = nextUploadLabel(
        [...(isVideo ? videoLabels : photoLabels), ...minted],
        prefix
      );
      provisional.push({
        label,
        url: pending.downloadUrl,
        type: pending.kind,
      });
    }
    return [...availableAssets, ...provisional];
  }, [availableAssets, pendingAttachments]);

  const firstName = user?.displayName?.split(' ')[0];

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: AGENT_API,
        // Durable replay is a Next/Firestore route — always same-origin. Cloud Run
        // AGENT_API_ORIGIN is only for chat POST (Hosting SSE buffering).
        prepareReconnectToStreamRequest: ({ id, headers }) => {
          const after = streamCursorRef.current;
          const qs =
            typeof after === 'number' && Number.isFinite(after)
              ? `?after=${after}`
              : '';
          return {
            api: `/api/agent/sessions/${id}/stream${qs}`,
            headers,
          };
        },
        headers: async (): Promise<Record<string, string>> => {
          const token = await auth.currentUser?.getIdToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        body: () => {
          const ready = pendingAttachmentsRef.current.filter((a) => a.downloadUrl);
          return {
            model: resolveModelApiValue(selectedModelRef.current),
            sessionId: chatIdRef.current,
            // Server derives userId from Bearer token; kept for local-agent attribution only.
            userId: userIdRef.current,
            videoUrl: ready[0]?.downloadUrl ?? undefined,
            videoName: ready[0]?.name ?? undefined,
            mediaUrls: ready.map((a) => a.downloadUrl as string),
            mediaNames: ready.map((a) => a.name),
            taggedAssets: draftTaggedAssetsRef.current,
            pipelineMode: pipelineModeRef.current,
            skillId:
              activeSkillRef.current ?? pipelineSkillIdRef.current ?? undefined,
            ...(checkpointAnswerRef.current
              ? { checkpointAnswer: checkpointAnswerRef.current }
              : {}),
          };
        },
        fetch: async (input, init) => {
          const url =
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : input.url;
          if (url.includes('/stream') && activeRunIdRef.current) {
            try {
              const afterRaw = new URL(url, 'http://local').searchParams.get('after');
              const afterSeq = Number.parseInt(afterRaw ?? '0', 10);
              logStudioReconnectPath('firestore');
              return streamRunEventsFromFirestore({
                sessionId: chatIdRef.current,
                runId: activeRunIdRef.current,
                afterSeq: Number.isFinite(afterSeq) ? afterSeq : 0,
                signal: init?.signal ?? undefined,
              });
            } catch (err) {
              console.error('[agent] firestore stream failed, using /stream', err);
            }
          }
          const response = await globalThis.fetch(input, init);
          const bodyText =
            typeof init?.body === 'string' ? init.body : '';
          const isWarmup = bodyText.includes('"action":"warmup"');
          if (!isWarmup) {
            logAgentPostTtfb(url);
          }
          const isChatPost =
            !isWarmup &&
            url.includes('/api/agent') &&
            !url.includes('/sessions');
          const guarded =
            response.status === 413 || isChatPost
              ? await guardSessionLimitResponse(response)
              : { limit: null, response };
          if (guarded.limit) {
            setSessionLimitTokens(guarded.limit.estimatedTokens);
            setSessionLimitOpen(true);
            return guarded.response;
          }
          const live = guarded.response;
          const warn = live.headers.get('x-okvevo-session-token-warning');
          if (warn === '1') {
            const n = Number(live.headers.get('x-okvevo-estimated-tokens'));
            if (Number.isFinite(n)) setSessionTokenWarning(n);
          }
          if (url.includes('/stream')) {
            logStudioReconnectPath('poll');
            return tapUiSseDeltas(live, 'reconnect-poll');
          }
          if (isChatPost) {
            return tapUiSseDeltas(live, 'live-post');
          }
          return live;
        },
      }),
    [chatId]
  );

  const { messages, sendMessage, status, error, setMessages, resumeStream, clearError, stop } =
    useChat({
      transport,
      id: chatId,
    });
  // After useChat so we can wake pipeline poll on submitted/streaming (cold idle → render).
  const pipelineState = usePipelineState(activeSessionId, status);
  pipelineSkillIdRef.current = pipelineState?.skillId;
  activeRunIdRef.current = pipelineState?.activeRunId ?? null;
  messagesRef.current = messages;

  const stopRef = useRef(stop);
  stopRef.current = stop;

  useEffect(() => {
    resumeKeyRef.current = null;
    streamCursorRef.current = 0;
    resumeBackoffRef.current = 0;
    loadedSessionRef.current = null;
    const stopThis = stopRef.current;
    return () => {
      void stopThis();
    };
  }, [chatId]);

  useEffect(() => {
    void (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        void fetch('/api/agent', {
          method: 'POST',
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'warmup' }),
        }).catch(() => {});
      } catch {
        // ignore
      }
    })();
  }, [userId]);

  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (status === 'submitted') {
      markStudio('useChat-submitted');
      measureStudio('click-to-submitted', 'send-click', 'useChat-submitted');
    } else if (status === 'streaming') {
      markStudio('useChat-streaming');
      measureStudio('click-to-streaming', 'send-click', 'useChat-streaming');
    }
    if (
      (prev === 'streaming' || prev === 'submitted') &&
      (status === 'ready' || status === 'error')
    ) {
      resumeKeyRef.current = null;
    }
  }, [status]);

  useEffect(() => {
    if (!sessionReady || !activeSessionId) return;
    if (status === 'submitted' || status === 'streaming') return;
    const runId = pipelineState?.activeRunId;
    if (typeof runId !== 'string' || !runId) return;
    const key = `${activeSessionId}:${runId}`;
    if (resumeKeyRef.current === key) return;
    if (status === 'error') clearError();
    resumeKeyRef.current = key;
    const lastSeqFallback =
      typeof pipelineState?.lastSeq === 'number' ? pipelineState.lastSeq : 0;
    void (async () => {
      try {
        markStudio('reconnect-snapshot-start');
        const snap = await fetchSessionSnapshot(activeSessionId);
        markStudio('reconnect-snapshot-bytes');
        if (chatIdRef.current !== activeSessionId) return;
        setMessages(snap.messages);
        markStudio('reconnect-ui-painted');
        if (snap.activeRunId !== runId) return;
        streamCursorRef.current = snap.lastSeq ?? lastSeqFallback;
        await resumeStream();
        markStudio('reconnect-stream-attached');
        measureStudio(
          'reconnect-snapshot',
          'reconnect-snapshot-start',
          'reconnect-snapshot-bytes'
        );
        measureStudio(
          'reconnect-paint',
          'reconnect-snapshot-bytes',
          'reconnect-ui-painted'
        );
        measureStudio(
          'reconnect-attach',
          'reconnect-ui-painted',
          'reconnect-stream-attached'
        );
        resumeBackoffRef.current = 0;
      } catch {
        if (chatIdRef.current !== activeSessionId) return;
        resumeKeyRef.current = null;
        const delay = Math.min(1000 * 2 ** resumeBackoffRef.current, 8000);
        resumeBackoffRef.current += 1;
        window.setTimeout(() => setResumeNonce((n) => n + 1), delay);
      }
    })();
  }, [
    sessionReady,
    activeSessionId,
    pipelineState?.activeRunId,
    status,
    resumeStream,
    clearError,
    setMessages,
    resumeNonce,
  ]);

  // Soft-ask haltTurn can leave useChat in error after a transport blip even though
  // the checkpoint part already rendered — unlock the card without resume looping.
  useEffect(() => {
    if (status !== 'error') return;
    if (!pipelineState?.pendingCheckpointId) return;
    clearError();
  }, [status, pipelineState?.pendingCheckpointId, clearError]);

  // Webhook Fal STT wake writes data-checkpoint to Firestore; useChat won't see it
  // until reload. Refetch when pipeline reports a pending id missing from local parts.
  useEffect(() => {
    const sessionId = activeSessionId;
    const pendingId = pipelineState?.pendingCheckpointId;
    if (!sessionId || !pendingId || status !== 'ready') return;

    const hasPart = messagesRef.current.some((msg) =>
      (msg.parts ?? []).some((part) => {
        if (part.type !== 'data-checkpoint') return false;
        const data = (part as { data?: { checkpointId?: string } }).data;
        return data?.checkpointId === pendingId;
      })
    );
    if (hasPart) return;

    let cancelled = false;
    void fetchSessionMessages(sessionId)
      .then((loaded) => {
        if (!cancelled) setMessages(loaded);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [
    activeSessionId,
    pipelineState?.pendingCheckpointId,
    status,
    setMessages,
  ]);

  useEffect(() => {
    if (pipelineState?.pipelineMode) {
      setPipelineMode(pipelineState.pipelineMode);
    }
  }, [activeSessionId, pipelineState?.pipelineMode]);

  useEffect(() => {
    draftTaggedAssetsRef.current = [];
    setDraftTaggedAssets([]);
  }, [chatId]);

  useEffect(() => {
    setSessionTokenWarning(null);
    setSessionLimitOpen(false);
    setSessionLimitTokens(null);
  }, [chatId]);

  useEffect(() => {
    for (const msg of messages) {
      for (const part of msg.parts ?? []) {
        if (
          part.type === 'data-session-token-warning' &&
          part.data &&
          typeof part.data === 'object' &&
          'estimatedTokens' in part.data &&
          typeof (part.data as { estimatedTokens: unknown }).estimatedTokens ===
            'number'
        ) {
          setSessionTokenWarning(
            (part.data as { estimatedTokens: number }).estimatedTokens
          );
        }
      }
    }
  }, [messages]);

  useEffect(() => {
    if (!error) return;
    const msg = error.message ?? '';
    if (
      msg.includes('session_limit_reached') ||
      msg.includes('Session context limit reached')
    ) {
      setSessionLimitOpen(true);
    }
  }, [error]);

  useEffect(() => {
    setDraftTaggedAssets((current) =>
      current.filter((asset) => hasAssetMention(input, asset.label))
    );
  }, [input]);

  useEffect(() => {
    if (pipelineState?.skillId) {
      setActiveSkill(pipelineState.skillId);
    }
  }, [activeSessionId, pipelineState?.skillId]);

  const patchCheckpointAnswer = (
    checkpointId: string,
    answer: CheckpointAnswerPayload
  ) => {
    setMessages((prev) =>
      prev.map((msg) => ({
        ...msg,
        parts: (msg.parts ?? []).map((part) => {
          if (part.type !== 'data-checkpoint') return part;
          const data = (part as { data?: CheckpointCardData }).data;
          if (!data || data.checkpointId !== checkpointId) return part;
          return {
            ...part,
            data: {
              ...data,
              status: 'answered' as const,
              answer: {
                type: answer.type,
                text: answer.text,
                ...(answer.choiceId ? { choiceId: answer.choiceId } : {}),
              },
            },
          };
        }),
      }))
    );
  };

  const sendCheckpointAnswer = (
    checkpointId: string,
    answer: CheckpointAnswerPayload
  ) => {
    if (status !== 'ready') return;

    patchCheckpointAnswer(checkpointId, answer);
    checkpointAnswerRef.current = { checkpointId, ...answer };
    sendMessage(
      { text: answer.text },
      {
        body: {
          model: resolveModelApiValue(selectedModel),
          sessionId: chatId,
          userId,
          pipelineMode,
          skillId: activeSkill ?? pipelineState?.skillId ?? undefined,
          checkpointAnswer: { checkpointId, ...answer },
        },
      }
    );
    checkpointAnswerRef.current = null;
  };

  useEffect(() => {
    setDraftVideoUrl(pipelineState?.draftVideoUrl);
  }, [pipelineState?.draftVideoUrl, setDraftVideoUrl]);

  useEffect(() => {
    if (wasFirstMessageRef.current && status === 'ready') {
      wasFirstMessageRef.current = false;
      void refreshSessions();
    }
  }, [status, refreshSessions]);

  useEffect(() => {
    if (status === 'ready') return;
    submittingRef.current = false;
    setIsPreparingSend(false);
  }, [status]);

  useEffect(() => {
    const sessionFromUrl = searchParams.get('session');
    if (sessionFromUrl) {
      setActiveSessionId(sessionFromUrl);
    }
  }, [searchParams, setActiveSessionId]);

  useEffect(() => {
    if (activeSessionId === null && !searchParams.get('session')) {
      loadedSessionRef.current = null;
    }
  }, [activeSessionId, searchParams]);

  useEffect(() => {
    setAvailableAssets([]);
    if (!activeSessionId) {
      setSessionReady(false);
      return;
    }
    // First-message path marks loaded before commit — keep ready so polls start.
    if (loadedSessionRef.current === activeSessionId) {
      setSessionReady(true);
      return;
    }
    setSessionReady(false);
  }, [activeSessionId]);

  useEffect(() => {
    if (skipFetchRef.current) {
      skipFetchRef.current = false;
      return;
    }

    const sessionId = activeSessionId;
    if (!sessionId) {
      setMessagesLoading(false);
      return;
    }

    if (status !== 'ready') {
      return;
    }

    // Only skip after a successful load — setting this before fetch + Strict Mode
    // cleanup left messagesLoading=true forever ("Warming up…").
    if (loadedSessionRef.current === sessionId) {
      setMessagesLoading(false);
      setSessionReady(true);
      return;
    }

    let cancelled = false;
    setMessagesLoading(true);

    (async () => {
      try {
        markStudio('session-load-start');
        const snap = await fetchSessionSnapshot(sessionId);
        markStudio('session-load-bytes');
        if (cancelled) return;
        setMessages(snap.messages);
        markStudio('session-load-painted');
        measureStudio(
          'session-load-snapshot',
          'session-load-start',
          'session-load-bytes'
        );
        measureStudio(
          'session-load-paint',
          'session-load-bytes',
          'session-load-painted'
        );
        if (snap.messages.some((m) => m.role === 'user')) {
          markStudio('reload-user-bubble');
          measureStudio(
            'reload-to-user-bubble',
            'session-load-start',
            'reload-user-bubble'
          );
        }
        if (typeof snap.lastSeq === 'number') {
          streamCursorRef.current = snap.lastSeq;
        }
        if (snap.activeRunId) {
          resumeKeyRef.current = `${sessionId}:${snap.activeRunId}`;
        }
        loadedSessionRef.current = sessionId;
        setSessionReady(true);
        if (snap.activeRunId) {
          try {
            markStudio('resume-stream-start');
            await resumeStream();
            if (cancelled) return;
            markStudio('resume-stream-end');
            measureStudio(
              'resume-stream',
              'resume-stream-start',
              'resume-stream-end'
            );
          } catch {
            if (!cancelled) resumeKeyRef.current = null;
          }
        }
      } catch {
        if (cancelled) return;
        setMessages([]);
        // Do not mark loaded on failure — allow retry; polls stay gated off.
      } finally {
        if (!cancelled) setMessagesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSessionId, status, setMessages, resumeStream]);

  const refreshAssets = useCallback(
    async (sessionId: string, signal?: AbortSignal) => {
      const assets = await fetchSessionAssets(sessionId, signal);
      setAvailableAssets(assets);
    },
    []
  );

  useEffect(() => {
    if (!sessionReady || !activeSessionId) {
      if (!activeSessionId) setAvailableAssets([]);
      return;
    }
    if (status === 'submitted' || status === 'streaming') return;

    const sessionAc = new AbortController();
    const timeout = window.setTimeout(() => sessionAc.abort(), 10_000);
    void refreshAssets(activeSessionId, sessionAc.signal).catch(() => {});
    return () => {
      sessionAc.abort();
      window.clearTimeout(timeout);
    };
  }, [
    sessionReady,
    activeSessionId,
    status,
    refreshAssets,
    pipelineState?.activeRunId,
    pipelineState?.videoUrl,
    pipelineState?.draftVideoUrl,
    pipelineState?.renderStatus,
  ]);

  // Every session video/image (incl. uploads) goes to the Deliverables rail;
  // the final draft video is shown there separately and is the only one in chat.
  useEffect(() => {
    setRenderedVideos(
      availableAssets
        .filter((asset) => asset.type === 'video')
        .map(({ id, kind, label, url }) => ({ id, kind, label, url }))
    );
    setDeliverableImages(
      availableAssets
        .filter((asset) => asset.type === 'image')
        .map(({ id, kind, label, url }) => ({ id, kind, label, url }))
    );
  }, [availableAssets, setRenderedVideos, setDeliverableImages]);

  useEffect(() => {
    return () => {
      for (const item of pendingAttachmentsRef.current) {
        URL.revokeObjectURL(item.objectUrl);
      }
    };
  }, []);

  const clearPendingAttachments = () => {
    for (const item of pendingAttachments) {
      URL.revokeObjectURL(item.objectUrl);
    }
    setPendingAttachments([]);
  };

  const clearPendingAttachment = (id: string) => {
    const target = pendingAttachments.find((a) => a.id === id);
    if (!target) return;
    if (target.downloadUrl) {
      const url = target.downloadUrl;
      const labels = new Set(
        draftTaggedAssets.filter((a) => a.url === url).map((a) => a.label)
      );
      const provisional = mentionableAssets.find((a) => a.url === url);
      if (provisional) labels.add(provisional.label);
      if (labels.size > 0) {
        let next = input;
        for (const label of labels) {
          const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          next = next.replace(
            new RegExp(`(^|\\s)@${escaped}(?=\\s|$)`, 'g'),
            '$1'
          );
        }
        setInput(next.trimStart());
      }
      setDraftTaggedAssets((current) => current.filter((a) => a.url !== url));
    }
    URL.revokeObjectURL(target.objectUrl);
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const persistUploadsToSession = async (
    attachments: Array<{ downloadUrl: string; name: string; kind: 'video' | 'image' }>
  ) => {
    if (attachments.length === 0) return;
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;

    const response = await fetch(`/api/agent/sessions/${chatId}`, {
      method: 'PATCH',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        uploads: attachments.map((a) => ({
          url: a.downloadUrl,
          mediaKind: a.kind,
          originalName: a.name,
        })),
      }),
    });
    if (!response.ok) throw new Error('Failed to register uploaded media');
  };

  const handleMediaSelect = async (file: File) => {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      setUploadError('Please select a video or image file.');
      return;
    }
    if (file.size > 2 * 1024 ** 3) {
      setUploadError('File must be under 2GB.');
      return;
    }
    if (pendingAttachments.length >= MAX_PENDING_ATTACHMENTS) {
      setUploadError(
        `You can attach up to ${MAX_PENDING_ATTACHMENTS} files. Remove one to add another.`
      );
      return;
    }

    setUploadError(null);
    const id = crypto.randomUUID();
    const objectUrl = URL.createObjectURL(file);
    const attachment: PendingAttachment = {
      id,
      objectUrl,
      downloadUrl: null,
      name: file.name,
      kind: isVideo ? 'video' : 'image',
      progress: 0,
    };
    setPendingAttachments((prev) => [...prev, attachment]);

    const storageRef = ref(storage, `uploads/${userId}/${chatId}/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        setPendingAttachments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, progress } : a))
        );
      },
      () => {
        setUploadError('Failed to upload file. Please try again.');
        setPendingAttachments((prev) => {
          const target = prev.find((a) => a.id === id);
          if (target) URL.revokeObjectURL(target.objectUrl);
          return prev.filter((a) => a.id !== id);
        });
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          setPendingAttachments((prev) =>
            prev.map((a) =>
              a.id === id ? { ...a, downloadUrl, progress: null } : a
            )
          );
        } catch {
          setUploadError('Failed to get file URL. Please try again.');
          setPendingAttachments((prev) => {
            const target = prev.find((a) => a.id === id);
            if (target) URL.revokeObjectURL(target.objectUrl);
            return prev.filter((a) => a.id !== id);
          });
        }
      }
    );
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    const remaining = MAX_PENDING_ATTACHMENTS - pendingAttachments.length;
    if (remaining <= 0) {
      setUploadError(
        `You can attach up to ${MAX_PENDING_ATTACHMENTS} files. Remove one to add another.`
      );
      return;
    }

    const toUpload = files.slice(0, remaining);
    if (files.length > remaining) {
      setUploadError(
        `Only ${remaining} more file${remaining === 1 ? '' : 's'} can be attached (max ${MAX_PENDING_ATTACHMENTS}).`
      );
    }
    for (const file of toUpload) {
      void handleMediaSelect(file);
    }
  };

  const handleSubmit = async () => {
    const originalInput = input.trim();
    const messageText =
      originalInput ||
      (readyMediaUrls.length > 0 ? 'Process my uploaded media' : '');
    if (
      !messageText ||
      status !== 'ready' ||
      isUploading ||
      submittingRef.current ||
      isPreparingSend ||
      pipelineState?.activeRunId
    ) {
      return;
    }

    const hasVideo =
      readyMediaUrls.length > 0 || Boolean(pipelineState?.videoUrl);
    if (activeSkill && skillRequiresUpload(activeSkill) && !hasVideo) {
      setUploadError(`Upload a video before starting ${skillLabel(activeSkill)}.`);
      return;
    }

    submittingRef.current = true;
    setIsPreparingSend(true);
    markStudio('send-click');

    const sentMediaUrls = [...readyMediaUrls];
    const readyAttachments = pendingAttachments.filter(
      (a): a is PendingAttachment & { downloadUrl: string } =>
        Boolean(a.downloadUrl)
    );
    const sentMediaNames = readyAttachments.map((a) => a.name);
    const sentVideoUrl = readyAttachments.find((a) => a.kind === 'video')
      ?.downloadUrl;
    const sentVideoName = readyAttachments.find((a) => a.kind === 'video')?.name;
    const taggedAssets = draftTaggedAssets.filter((asset) =>
      hasAssetMention(messageText, asset.label)
    );
    const pendingCheckpointId = pipelineState?.pendingCheckpointId;
    const checkpointAnswer =
      pendingCheckpointId && originalInput
        ? {
            checkpointId: pendingCheckpointId,
            type: 'freeform' as const,
            text: originalInput,
          }
        : undefined;

    // Instant feedback: lock + clear composer before any network wait.
    setInput('');
    clearPendingAttachments();

    const unlockPrepare = () => {
      submittingRef.current = false;
      setIsPreparingSend(false);
    };

    const clientMessageId = crypto.randomUUID();
    const messageMetadata = {
      ...(sentMediaUrls.length > 0
        ? {
            ...(sentVideoUrl
              ? { videoUrl: sentVideoUrl, videoName: sentVideoName }
              : {}),
            mediaUrls: sentMediaUrls,
            mediaNames: sentMediaNames,
          }
        : {}),
      ...(taggedAssets.length > 0 ? { taggedAssets } : {}),
    };

    // Optimistic user bubble via SDK messageId replace (no content-match dedup).
    setMessages((prev) => [
      ...prev,
      {
        id: clientMessageId,
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: messageText }],
        ...(Object.keys(messageMetadata).length > 0
          ? { metadata: messageMetadata }
          : {}),
      },
    ]);
    markStudio('optimistic-bubble');
    measureStudio('click-to-bubble', 'send-click', 'optimistic-bubble');

    if (checkpointAnswer) {
      patchCheckpointAnswer(checkpointAnswer.checkpointId, checkpointAnswer);
    }

    if (messages.length === 0 && activeSessionId === null) {
      // Leave hero immediately; ensure doc after bubble is visible.
      wasFirstMessageRef.current = true;
      loadedSessionRef.current = chatId;
      setSessionReady(true);
      commitSession(chatId);
      skipFetchRef.current = true;
      replaceSessionUrl(
        `/workspace/ai-studio?session=${encodeURIComponent(chatId)}`
      );
      try {
        markStudio('ensure-session-start');
        await ensureSessionDoc(chatId);
        markStudio('ensure-session-end');
        measureStudio(
          'ensure-session',
          'ensure-session-start',
          'ensure-session-end'
        );
      } catch (error) {
        console.error('Failed to ensure session before send:', error);
        setUploadError('Could not start session. Please try again.');
        setInput(originalInput);
        setMessages((prev) => prev.filter((m) => m.id !== clientMessageId));
        unlockPrepare();
        return;
      }
    }

    try {
      markStudio('sendMessage-called');
      measureStudio('click-to-sendMessage', 'send-click', 'sendMessage-called');
      sendMessage(
        {
          text: messageText,
          messageId: clientMessageId,
          ...(Object.keys(messageMetadata).length > 0
            ? { metadata: messageMetadata }
            : {}),
        },
        {
          body: {
            model: resolveModelApiValue(selectedModel),
            sessionId: chatId,
            userId,
            videoUrl: sentVideoUrl,
            videoName: sentVideoName,
            taggedAssets,
            mediaUrls: sentMediaUrls,
            mediaNames: sentMediaNames,
            pipelineMode,
            skillId: activeSkill ?? pipelineState?.skillId ?? undefined,
            ...(checkpointAnswer ? { checkpointAnswer } : {}),
          },
        }
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      setUploadError('Could not send message. Please try again.');
      setInput(originalInput);
      setMessages((prev) => prev.filter((m) => m.id !== clientMessageId));
      unlockPrepare();
      return;
    }
    // Keep isPreparingSend until useChat status leaves 'ready' (effect below).

    // Register uploads after stream starts — mediaUrls already go in the request body.
    if (readyAttachments.length > 0) {
      void persistUploadsToSession(readyAttachments)
        .then(() => refreshAssets(chatId).catch(() => {}))
        .catch((error) => {
          console.error('Failed to register uploads after send:', error);
          setUploadError(
            'Could not register uploaded media. Please try again.'
          );
        });
    }

    // Tagged-asset draft is independent of the thumbnail strip.
    queueMicrotask(() => {
      setActiveSkill(null);
      draftTaggedAssetsRef.current = [];
      setDraftTaggedAssets([]);
    });
  };

  const sameTaggedAsset = (a: TaggedAsset, b: TaggedAsset) =>
    a.id && b.id ? a.id === b.id : a.url === b.url;

  const handleAssetSelect = (asset: TaggedAsset) => {
    setDraftTaggedAssets((current) =>
      current.some((selected) => sameTaggedAsset(selected, asset))
        ? current
        : [...current, asset]
    );
  };

  const handleAssetRemove = (asset: TaggedAsset) => {
    setDraftTaggedAssets((current) =>
      current.filter((selected) => !sameTaggedAsset(selected, asset))
    );
    const escaped = asset.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    setInput(
      input.replace(new RegExp(`(^|\\s)@${escaped}(?=\\s|$)`, 'g'), '$1').trimStart()
    );
  };

  const handleSkillSelect = (skillId: string) => {
    setActiveSkill(skillId);
    setInput(`/${skillId} `);
    inputRef.current?.focus();
  };

  const heroView =
    messages.length === 0 &&
    !messagesLoading &&
    status === 'ready' &&
    activeSessionId === null;

  useEffect(() => {
    setShowDeliverablesToggle(!heroView);
    if (heroView) setDeliverablesOpen(false);
  }, [heroView, setShowDeliverablesToggle, setDeliverablesOpen]);

  // Draft / Fal image / Fal video → open deliverables + refresh chat.
  // Gate on messages containing the URL (no seen*Ref — that raced with cancelled fetches).
  const draftVideoUrl = pipelineState?.draftVideoUrl;
  useEffect(() => {
    if (!activeSessionId) return;

    type SyncTarget = {
      url: string;
      kind: 'image' | 'video';
      injectId: string;
      text: string;
    };
    const targets: SyncTarget[] = [];
    if (draftVideoUrl) {
      targets.push({
        url: draftVideoUrl,
        kind: 'video',
        injectId: `${activeSessionId}-draft-video`,
        text: skillReadyMessage(pipelineState?.skillId),
      });
    }
    for (const asset of availableAssets) {
      if (asset.kind === 'background_image') {
        targets.push({
          url: asset.url,
          kind: 'image',
          injectId: `${activeSessionId}-${asset.id}`,
          text: 'Your background image is ready.',
        });
      } else if (asset.kind === 'background_video') {
        targets.push({
          url: asset.url,
          kind: 'video',
          injectId: `${activeSessionId}-${asset.id}`,
          text: 'Your background video is ready.',
        });
      }
    }

    const missing = targets.filter(
      (t) => !messageHasMediaUrl(messagesRef.current, t.url, t.kind)
    );
    if (missing.length === 0) return;

    setDeliverablesOpen(true);
    setShowDeliverablesToggle(true);

    let cancelled = false;
    void (async () => {
      try {
        const loaded = await fetchSessionMessages(activeSessionId);
        if (cancelled) return;
        let next = loaded;
        for (const t of missing) {
          if (messageHasMediaUrl(next, t.url, t.kind)) continue;
          next = [
            ...next,
            {
              id: t.injectId,
              role: 'assistant' as const,
              parts: [{ type: 'text' as const, text: t.text }],
              metadata:
                t.kind === 'image'
                  ? { imageUrl: t.url }
                  : { videoUrl: t.url },
            },
          ];
        }
        setMessages(next);
      } catch {
        // keep existing messages
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    draftVideoUrl,
    availableAssets,
    activeSessionId,
    pipelineState?.skillId,
    setMessages,
    setDeliverablesOpen,
    setShowDeliverablesToggle,
  ]);

  const lastAssistantIndex = messages.reduce(
    (last, message, index) => (message.role === 'assistant' ? index : last),
    -1
  );
  const streamingAssistantId =
    status === 'streaming' && lastAssistantIndex >= 0
      ? messages[lastAssistantIndex]?.id
      : null;
  const isPendingTurn = status === 'submitted' || status === 'streaming';

  const timelineMessages = messages.map((message) => {
    const metadata = message.metadata as
      | {
          createdAt?: string;
          videoUrl?: string;
          videoName?: string;
          imageUrl?: string;
          mediaUrls?: string[];
          mediaNames?: string[];
          taggedAssets?: TaggedAsset[];
        }
      | undefined;
    return {
      id: message.id,
      role: message.role as 'user' | 'assistant',
      parts: message.parts as TimelineMessage['parts'],
      createdAt: metadata?.createdAt,
      videoUrl: metadata?.videoUrl,
      videoName: metadata?.videoName,
      imageUrl: metadata?.imageUrl,
      mediaUrls: metadata?.mediaUrls,
      mediaNames: metadata?.mediaNames,
      taggedAssets: metadata?.taggedAssets,
    };
  });

  const pendingFloatingCheckpoint = useMemo(() => {
    const id = pipelineState?.pendingCheckpointId;
    if (!id) return null;
    for (const msg of messages) {
      for (const part of msg.parts ?? []) {
        if (part.type !== 'data-checkpoint') continue;
        const data = (part as { data?: CheckpointCardData }).data;
        if (data?.checkpointId === id && data.status !== 'answered' && !data.answer) {
          return data;
        }
      }
    }
    return null;
  }, [messages, pipelineState?.pendingCheckpointId]);

  const durableLive = Boolean(pipelineState?.activeRunId);
  const chatBar = (
    <>
      <input
        type="file"
        accept="video/*,image/*"
        multiple
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileInputChange}
      />
      <PipelineStatusBar
        pipelineState={pipelineState}
        sessionId={activeSessionId}
      />
      <AiStudioChatBar
        variant={heroView ? 'hero' : 'default'}
        input={input}
        setInput={setInput}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        status={status}
        isPreparingSend={isPreparingSend}
        durableLive={durableLive}
        onSubmit={handleSubmit}
        onPlusClick={() => fileInputRef.current?.click()}
        pendingAttachments={pendingAttachments}
        maxAttachments={MAX_PENDING_ATTACHMENTS}
        activeSkill={activeSkill}
        onClearAttachment={clearPendingAttachment}
        pipelineMode={pipelineMode}
        setPipelineMode={setPipelineMode}
        onSkillSelect={handleSkillSelect}
        inputRef={inputRef}
        assets={mentionableAssets}
        onAssetSelect={handleAssetSelect}
        selectedAssets={draftTaggedAssets}
        onAssetRemove={handleAssetRemove}
      />
    </>
  );

  const handleDownloadProject = useCallback(async () => {
    if (!activeSessionId) return;
    setExportBusy(true);
    setUploadError(null);
    try {
      await downloadSessionExport(activeSessionId);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setExportBusy(false);
    }
  }, [activeSessionId]);

  const handleDownloadAndDelete = useCallback(async () => {
    if (!activeSessionId) return;
    setPurgeBusy(true);
    setUploadError(null);
    try {
      const exportToken = await downloadSessionExport(activeSessionId);
      setPendingExportToken(exportToken);
      setPurgeConfirmOpen(true);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setPurgeBusy(false);
    }
  }, [activeSessionId]);

  const confirmPurge = useCallback(async () => {
    if (!activeSessionId || !pendingExportToken) return;
    setPurgeBusy(true);
    setUploadError(null);
    try {
      await purgeSession(activeSessionId, pendingExportToken);
      setPurgeConfirmOpen(false);
      setPendingExportToken(null);
      setSessionLimitOpen(false);
      startNewProject();
      await refreshSessions();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setPurgeBusy(false);
    }
  }, [activeSessionId, pendingExportToken, refreshSessions, startNewProject]);

  return (
    <>
      <SessionLimitModal
        open={sessionLimitOpen}
        estimatedTokens={sessionLimitTokens}
        onClose={() => setSessionLimitOpen(false)}
        onStartNewChat={() => {
          setSessionLimitOpen(false);
          startNewProject();
        }}
        downloadEnabled={Boolean(activeSessionId)}
        deleteEnabled={Boolean(activeSessionId)}
        downloadBusy={exportBusy}
        deleteBusy={purgeBusy}
        onDownloadProject={() => void handleDownloadProject()}
        onDownloadAndDelete={() => void handleDownloadAndDelete()}
      />
      {purgeConfirmOpen ? (
        <PurgeConfirmDialog
          busy={purgeBusy}
          onCancel={() => {
            setPurgeConfirmOpen(false);
            setPendingExportToken(null);
          }}
          onConfirm={() => void confirmPurge()}
        />
      ) : null}
      {messagesLoading ? (
        <AiStudioProjectLoader loadKey={chatId} />
      ) : heroView ? (
        <div className="custom-scrollbar flex h-full min-h-0 flex-col items-center justify-center overflow-y-auto px-4 py-8 sm:px-6">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center">
            <div className="mb-8 flex w-full flex-col items-center text-center">
              <div className="mb-7 h-24 w-24 sm:h-28 sm:w-28">
                <div className="h-full w-full overflow-hidden rounded-[1.25rem] shadow-[0_0_40px_-8px_rgba(249,115,22,0.45)] ring-1 ring-orange-500/20">
                  <Image
                    src={HERO_LOGO_SRC}
                    alt="OKVEVO"
                    width={112}
                    height={112}
                    className="h-full w-full object-cover"
                    priority
                  />
                </div>
              </div>
              <HeroTypewriterHeading firstName={firstName} ready={!authLoading} />
            </div>
            <div className="w-full">
              {uploadError ? (
                <p className="mb-2 text-sm text-red-400">{uploadError}</p>
              ) : null}
              {chatBar}
            </div>
            <AiStudioHeroExtras onPickPrompt={setInput} />
          </div>
        </div>
      ) : (
        <div className="relative flex h-full min-h-0 flex-col">
          <AiStudioTimeline
            messages={timelineMessages}
            streamingAssistantId={streamingAssistantId}
            isPendingTurn={isPendingTurn}
            isPreparingSend={isPreparingSend}
            durableLive={durableLive}
            chatStatus={status}
            bottomRef={bottomRef}
            pendingCheckpointId={pipelineState?.pendingCheckpointId}
          />
          <div className="shrink-0 pb-1 pt-0">
            <div className="mx-auto w-full max-w-3xl px-2">
              {sessionTokenWarning != null ? (
                <div className="mb-2 flex items-start justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
                  <p>
                    This chat is getting large (~
                    {Math.round(sessionTokenWarning / 1000)}k tokens). Consider
                    starting a new chat soon.
                  </p>
                  <button
                    type="button"
                    className="shrink-0 text-amber-200/70 hover:text-amber-100"
                    onClick={() => setSessionTokenWarning(null)}
                    aria-label="Dismiss warning"
                  >
                    Dismiss
                  </button>
                </div>
              ) : null}
              {error && !sessionLimitOpen && !isSessionLimitError(error) ? (
                <p className="mb-2 text-sm text-red-400">{error.message}</p>
              ) : null}
              {uploadError ? (
                <p className="mb-2 text-sm text-red-400">{uploadError}</p>
              ) : null}
              {pendingFloatingCheckpoint ? (
                <CheckpointFloatingCard
                  data={pendingFloatingCheckpoint}
                  disabled={status !== 'ready'}
                  onSubmit={sendCheckpointAnswer}
                />
              ) : null}
              {chatBar}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function isSessionLimitError(error: { message?: string } | null | undefined) {
  const msg = error?.message ?? '';
  return (
    msg.includes('session_limit_reached') ||
    msg.includes('Session context limit reached')
  );
}

function PurgeConfirmDialog({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center px-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        aria-label="Cancel delete"
        onClick={onCancel}
        disabled={busy}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="purge-confirm-title"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#141414] p-5 shadow-[0_8px_48px_rgba(0,0,0,0.55)]"
      >
        <h2
          id="purge-confirm-title"
          className="text-lg font-semibold text-white/90"
        >
          Delete permanently?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/65">
          This cannot be undone. The project download already started — continue
          only if you are sure you want every cloud copy removed.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-40"
          >
            {busy ? 'Deleting…' : 'Yes, delete permanently'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
