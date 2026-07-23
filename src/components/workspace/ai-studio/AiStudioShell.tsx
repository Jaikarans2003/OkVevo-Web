'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AiStudioChatBar,
  type PendingAttachment,
} from '@/components/workspace/ai-studio/AiStudioChatBar';
import { AiStudioHeroExtras } from '@/components/workspace/ai-studio/AiStudioHeroExtras';
import { AiStudioProjectLoader } from '@/components/workspace/ai-studio/AiStudioProjectLoader';
import { AiStudioTimeline } from '@/components/workspace/ai-studio/AiStudioTimeline';
import { useAiStudioWorkspace } from '@/components/workspace/ai-studio/AiStudioWorkspaceProvider';
import {
  AI_STUDIO_CHAT_COLUMN,
  HERO_LOGO_SRC,
} from '@/components/workspace/ai-studio/constants';
import { HeroTypewriterHeading } from '@/components/workspace/ai-studio/HeroTypewriterHeading';
import { PipelineStatusBar } from '@/components/workspace/ai-studio/PipelineStatusBar';
import { replaceSessionUrl } from '@/components/workspace/ai-studio/shallowSessionUrl';
import type { CheckpointAnswerPayload } from '@/components/workspace/ai-studio/CheckpointCard';
import { auth, storage } from '@/config/firebase';
import { env } from '@/config/env';
import { useAuth } from '@/hooks/useAuth';
import { usePipelineState } from '@/hooks/usePipelineState';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { type TaggedAsset } from '@/lib/agent/taggedAssets';

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

async function fetchSessionMessages(sessionId: string) {
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

  const data = (await response.json()) as {
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
  }[];

  return data.map((msg, index) => ({
    id: `${sessionId}-${index}`,
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
    },
  }));
}

async function fetchSessionAssets(sessionId: string): Promise<SessionAsset[]> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) return [];
  const response = await fetch(`/api/agent/sessions/${sessionId}/assets`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  });
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

function hasAssetMention(text: string, label: string): boolean {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)@${escaped}(?=\\s|$)`).test(text);
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
  } = useAiStudioWorkspace();
  const chatId = activeSessionId ?? draftChatId;
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('anthropic/claude-haiku-4-5');
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);
  const [pipelineMode, setPipelineMode] = useState<'ask' | 'auto'>('ask');
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [availableAssets, setAvailableAssets] = useState<SessionAsset[]>([]);
  const [draftTaggedAssets, setDraftTaggedAssets] = useState<TaggedAsset[]>([]);
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
  const [sessionReady, setSessionReady] = useState(false);
  const wasFirstMessageRef = useRef(false);
  const draftTaggedAssetsRef = useRef<TaggedAsset[]>([]);
  const messagesRef = useRef<UIMessage[]>([]);
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

  const firstName = user?.displayName?.split(' ')[0];

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: AGENT_API,
        headers: async (): Promise<Record<string, string>> => {
          const token = await auth.currentUser?.getIdToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        body: () => {
          const ready = pendingAttachmentsRef.current.filter((a) => a.downloadUrl);
          return {
            model: selectedModelRef.current,
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
      }),
    [chatId]
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport,
    id: chatId,
  });
  // After useChat so we can wake pipeline poll on submitted/streaming (cold idle → render).
  const pipelineState = usePipelineState(
    sessionReady ? activeSessionId : null,
    status
  );
  pipelineSkillIdRef.current = pipelineState?.skillId;
  messagesRef.current = messages;

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
    if (pipelineState?.skillId) {
      setActiveSkill(pipelineState.skillId);
    }
  }, [activeSessionId, pipelineState?.skillId]);

  const sendCheckpointAnswer = (
    checkpointId: string,
    answer: CheckpointAnswerPayload
  ) => {
    if (status !== 'ready') return;

    checkpointAnswerRef.current = { checkpointId, ...answer };
    sendMessage(
      { text: answer.text },
      {
        body: {
          model: selectedModel,
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
        const loaded = await fetchSessionMessages(sessionId);
        if (cancelled) return;
        setMessages(loaded);
        loadedSessionRef.current = sessionId;
        setSessionReady(true);
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
  }, [activeSessionId, status, setMessages]);

  const refreshAssets = useCallback(async (sessionId: string) => {
    const assets = await fetchSessionAssets(sessionId);
    setAvailableAssets(assets);
  }, []);

  useEffect(() => {
    if (!sessionReady || !activeSessionId || status !== 'ready') {
      if (!activeSessionId) setAvailableAssets([]);
      return;
    }
    void refreshAssets(activeSessionId).catch(() => {});
    // ponytail: Fal webhooks land async after stream ends — poll assets until session changes.
    // Ceiling: fixed 3s interval while session open; upgrade to Firestore onSnapshot if noisy.
    const id = setInterval(() => {
      void refreshAssets(activeSessionId).catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, [sessionReady, activeSessionId, status, refreshAssets]);

  // Every rendered video (Manim clips etc.) goes to the Deliverables rail;
  // the final draft video is shown there separately and is the only one in chat.
  useEffect(() => {
    setRenderedVideos(
      availableAssets
        .filter(
          (asset) =>
            asset.type === 'video' &&
            asset.kind !== 'draft_video' &&
            asset.kind !== 'uploaded_video'
        )
        .map(({ id, kind, label, url }) => ({ id, kind, label, url }))
    );
    setDeliverableImages(
      availableAssets
        .filter((asset) => asset.type === 'image')
        .map(({ id, label, url }) => ({ id, label, url }))
    );
  }, [availableAssets, setRenderedVideos, setDeliverableImages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    setPendingAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.objectUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  const persistVideoToSession = async (videoUrl: string, videoName: string) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;

    const response = await fetch(`/api/agent/sessions/${chatId}`, {
      method: 'PATCH',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ videoUrl, videoName }),
    });
    if (!response.ok) throw new Error('Failed to register uploaded video');
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
          if (isVideo) {
            void persistVideoToSession(downloadUrl, file.name);
          }
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
    const messageText =
      input.trim() ||
      (readyMediaUrls.length > 0
        ? activeSkill === 'remove-background'
          ? 'Remove the background from my uploaded video'
          : activeSkill === 'composite-subject'
            ? 'Composite my uploaded cutout and background'
            : 'Process my uploaded media'
        : '');
    if (!messageText || status !== 'ready' || isUploading) return;

    const hasVideo =
      readyMediaUrls.length > 0 || Boolean(pipelineState?.videoUrl);
    if (
      (activeSkill === 'edu-video' || activeSkill === 'remove-background') &&
      !hasVideo
    ) {
      setUploadError(
        activeSkill === 'remove-background'
          ? 'Upload a video before starting Remove Background.'
          : 'Upload a teacher video before starting Edu-Video.'
      );
      return;
    }
    if (activeSkill === 'composite-subject' && readyMediaUrls.length < 2) {
      setUploadError(
        'Upload a cutout and a background (2 files) before compositing.'
      );
      return;
    }

    const sentMediaUrls = [...readyMediaUrls];
    const sentMediaNames = pendingAttachments
      .filter((a) => a.downloadUrl)
      .map((a) => a.name);
    const sentVideoUrl = sentMediaUrls[0];
    const sentVideoName = sentMediaNames[0];
    const taggedAssets = draftTaggedAssets.filter((asset) =>
      hasAssetMention(messageText, asset.label)
    );

    if (messages.length === 0 && activeSessionId === null) {
      try {
        await ensureSessionDoc(chatId);
      } catch (error) {
        console.error('Failed to ensure session before send:', error);
        setUploadError('Could not start session. Please try again.');
        return;
      }
      wasFirstMessageRef.current = true;
      loadedSessionRef.current = chatId;
      setSessionReady(true);
      commitSession(chatId);
      skipFetchRef.current = true;
      replaceSessionUrl(
        `/workspace/ai-studio?session=${encodeURIComponent(chatId)}`
      );
    }

    const pendingCheckpointId = pipelineState?.pendingCheckpointId;
    const checkpointAnswer =
      pendingCheckpointId && input.trim()
        ? {
            checkpointId: pendingCheckpointId,
            type: 'freeform' as const,
            text: input.trim(),
          }
        : undefined;

    sendMessage(
      {
        text: messageText,
        metadata: sentVideoUrl
          ? {
              videoUrl: sentVideoUrl,
              videoName: sentVideoName,
              mediaUrls: sentMediaUrls,
              mediaNames: sentMediaNames,
            }
          : undefined,
      },
      {
        body: {
          model: selectedModel,
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
    // Defer clear so the transport body snapshot cannot race with send.
    queueMicrotask(() => {
      clearPendingAttachments();
      setActiveSkill(null);
      draftTaggedAssetsRef.current = [];
      setDraftTaggedAssets([]);
    });
    setInput('');
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
        text: 'Your educational video is ready.',
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

  const timelineMessages = messages.map((message) => {
    const metadata = message.metadata as
      | {
          createdAt?: string;
          videoUrl?: string;
          videoName?: string;
          imageUrl?: string;
          mediaUrls?: string[];
          mediaNames?: string[];
        }
      | undefined;
    return {
      id: message.id,
      role: message.role as 'user' | 'assistant',
      parts: message.parts,
      createdAt: metadata?.createdAt,
      videoUrl: metadata?.videoUrl,
      videoName: metadata?.videoName,
      imageUrl: metadata?.imageUrl,
      mediaUrls: metadata?.mediaUrls,
      mediaNames: metadata?.mediaNames,
    };
  });

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
        assets={availableAssets}
        onAssetSelect={handleAssetSelect}
        selectedAssets={draftTaggedAssets}
        onAssetRemove={handleAssetRemove}
      />
    </>
  );

  return (
    <>
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
            bottomRef={bottomRef}
            onCheckpointAnswer={sendCheckpointAnswer}
            pendingCheckpointId={pipelineState?.pendingCheckpointId}
          />
          <div className="shrink-0 pb-6 pt-2">
            <div className={AI_STUDIO_CHAT_COLUMN}>
              {error ? (
                <p className="mb-2 text-sm text-red-400">{error.message}</p>
              ) : null}
              {uploadError ? (
                <p className="mb-2 text-sm text-red-400">{uploadError}</p>
              ) : null}
              {chatBar}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
