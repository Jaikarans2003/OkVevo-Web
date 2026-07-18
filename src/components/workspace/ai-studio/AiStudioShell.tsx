'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AiStudioChatBar } from '@/components/workspace/ai-studio/AiStudioChatBar';
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
import { auth, storage } from '@/config/firebase';
import { useAuth } from '@/hooks/useAuth';
import { usePipelineApproval } from '@/hooks/usePipelineApproval';
import { usePipelineState } from '@/hooks/usePipelineState';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';

// ponytail: Hosting buffers SSE through rewrites — temporary Cloud Run origin bypass.
// Ceiling: classic Hosting only. After App Hosting migration, drop NEXT_PUBLIC_AGENT_API_ORIGIN and use same-origin /api/agent.
const AGENT_API_ORIGIN = (process.env.NEXT_PUBLIC_AGENT_API_ORIGIN ?? '').replace(/\/$/, '');
const AGENT_API = AGENT_API_ORIGIN ? `${AGENT_API_ORIGIN}/api/agent` : '/api/agent';

interface AiStudioShellProps {
  userId: string;
}

async function fetchSessionMessages(sessionId: string) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/agent/sessions/${sessionId}`, {
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
    },
  }));
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
  } = useAiStudioWorkspace();
  const chatId = activeSessionId ?? draftChatId;
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('anthropic/claude-haiku-4-5');
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [pendingVideoUrl, setPendingVideoUrl] = useState<string | null>(null);
  const [pendingVideoName, setPendingVideoName] = useState<string | null>(null);
  const [pendingVideoObjectUrl, setPendingVideoObjectUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [pipelineMode, setPipelineMode] = useState<'ask' | 'auto'>('ask');
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const pipelineState = usePipelineState(activeSessionId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingVideoObjectUrlRef = useRef<string | null>(null);
  const selectedModelRef = useRef(selectedModel);
  const userIdRef = useRef(userId);
  const pendingVideoUrlRef = useRef<string | null>(null);
  const pendingVideoNameRef = useRef<string | null>(null);
  const activeSkillRef = useRef<string | null>(null);
  const pipelineModeRef = useRef(pipelineMode);
  const chatIdRef = useRef(chatId);
  const skipFetchRef = useRef(false);
  const loadedSessionRef = useRef<string | null>(null);
  const wasFirstMessageRef = useRef(false);
  selectedModelRef.current = selectedModel;
  userIdRef.current = userId;
  pendingVideoUrlRef.current = pendingVideoUrl;
  pendingVideoNameRef.current = pendingVideoName;
  activeSkillRef.current = activeSkill;
  pipelineModeRef.current = pipelineMode;
  chatIdRef.current = chatId;

  const firstName = user?.displayName?.split(' ')[0];

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: AGENT_API,
        headers: async (): Promise<Record<string, string>> => {
          const token = await auth.currentUser?.getIdToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        body: () => ({
          model: selectedModelRef.current,
          sessionId: chatIdRef.current,
          // Server derives userId from Bearer token; kept for local-agent attribution only.
          userId: userIdRef.current,
          videoUrl: pendingVideoUrlRef.current ?? undefined,
          videoName: pendingVideoNameRef.current ?? undefined,
          pipelineMode: pipelineModeRef.current,
          skillId: activeSkillRef.current ?? undefined,
        }),
      }),
    [chatId]
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport,
    id: chatId,
  });
  const { approve } = usePipelineApproval(activeSessionId, sendMessage);

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
      } catch {
        if (cancelled) return;
        setMessages([]);
        loadedSessionRef.current = sessionId;
      } finally {
        if (!cancelled) setMessagesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSessionId, status, setMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    pendingVideoObjectUrlRef.current = pendingVideoObjectUrl;
  }, [pendingVideoObjectUrl]);

  useEffect(() => {
    return () => {
      if (pendingVideoObjectUrlRef.current) {
        URL.revokeObjectURL(pendingVideoObjectUrlRef.current);
      }
    };
  }, []);

  const revokePendingVideoObjectUrl = () => {
    if (pendingVideoObjectUrl) {
      URL.revokeObjectURL(pendingVideoObjectUrl);
    }
    setPendingVideoObjectUrl(null);
  };

  const clearPendingVideo = () => {
    revokePendingVideoObjectUrl();
    setPendingVideoUrl(null);
    setPendingVideoName(null);
    setUploadProgress(null);
  };

  const persistVideoToSession = async (videoUrl: string, videoName: string) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;

    await fetch(`/api/agent/sessions/${chatId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ videoUrl, videoName }),
    });
  };

  const handleVideoSelect = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setUploadError('Please select a valid video file.');
      return;
    }
    if (file.size > 2 * 1024 ** 3) {
      setUploadError('Video must be under 2GB.');
      return;
    }

    setUploadError(null);
    revokePendingVideoObjectUrl();
    const objectUrl = URL.createObjectURL(file);
    setPendingVideoObjectUrl(objectUrl);
    setPendingVideoUrl(null);
    setPendingVideoName(null);
    setUploadProgress(0);

    const storageRef = ref(storage, `uploads/${userId}/${chatId}/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        setUploadProgress(progress);
      },
      () => {
        setUploadError('Failed to upload video. Please try again.');
        setUploadProgress(null);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          setPendingVideoUrl(downloadUrl);
          setPendingVideoName(file.name);
          setUploadProgress(null);
          void persistVideoToSession(downloadUrl, file.name);
        } catch {
          setUploadError('Failed to get video URL. Please try again.');
          setUploadProgress(null);
        }
      }
    );
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleVideoSelect(file);
    }
    e.target.value = '';
  };

  const handleSubmit = () => {
    const messageText =
      input.trim() || (pendingVideoUrl ? 'Process my uploaded teacher video' : '');
    if (!messageText || status !== 'ready' || uploadProgress !== null) return;

    const hasVideo = pendingVideoUrl ?? pipelineState?.videoUrl;
    if (activeSkill === 'edu-video' && !hasVideo) {
      setUploadError('Upload a teacher video before starting Edu-Video.');
      return;
    }

    const sentVideoUrl = pendingVideoUrl ?? undefined;
    const sentVideoName = pendingVideoName ?? undefined;

    if (messages.length === 0 && activeSessionId === null) {
      wasFirstMessageRef.current = true;
      commitSession(chatId);
      skipFetchRef.current = true;
      loadedSessionRef.current = chatId;
      replaceSessionUrl(
        `/workspace/ai-studio?session=${encodeURIComponent(chatId)}`
      );
    }

    sendMessage(
      {
        text: messageText,
        metadata: sentVideoUrl
          ? { videoUrl: sentVideoUrl, videoName: sentVideoName }
          : undefined,
      },
      {
        body: {
          model: selectedModel,
          sessionId: chatId,
          userId,
          videoUrl: sentVideoUrl,
          videoName: sentVideoName,
          pipelineMode,
          skillId: activeSkill ?? undefined,
        },
      }
    );
    revokePendingVideoObjectUrl();
    setPendingVideoUrl(null);
    setPendingVideoName(null);
    setActiveSkill(null);
    setInput('');
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

  // When draft video lands (webhook / Check Now), open deliverables and refresh
  // chat so a finalize-posted assistant message (or pipeline fallback) appears.
  const draftVideoUrl = pipelineState?.draftVideoUrl;
  const seenDraftUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (!draftVideoUrl || !activeSessionId) return;
    if (seenDraftUrlRef.current === draftVideoUrl) return;
    seenDraftUrlRef.current = draftVideoUrl;
    setDeliverablesOpen(true);
    setShowDeliverablesToggle(true);

    let cancelled = false;
    void (async () => {
      try {
        const loaded = await fetchSessionMessages(activeSessionId);
        if (cancelled) return;
        const hasVideoMsg = loaded.some((m) => {
          const meta = m.metadata as { videoUrl?: string } | undefined;
          return meta?.videoUrl === draftVideoUrl;
        });
        if (hasVideoMsg) {
          setMessages(loaded);
          return;
        }
        // Older finalizes didn't write a chat row — inject a client-side card.
        setMessages([
          ...loaded,
          {
            id: `${activeSessionId}-draft-video`,
            role: 'assistant' as const,
            parts: [
              {
                type: 'text' as const,
                text: 'Your educational video is ready.',
              },
            ],
            metadata: { videoUrl: draftVideoUrl },
          },
        ]);
      } catch {
        // keep existing messages
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    draftVideoUrl,
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
      | { createdAt?: string; videoUrl?: string; videoName?: string }
      | undefined;
    return {
      id: message.id,
      role: message.role as 'user' | 'assistant',
      parts: message.parts,
      createdAt: metadata?.createdAt,
      videoUrl: metadata?.videoUrl,
      videoName: metadata?.videoName,
    };
  });

  const chatBar = (
    <>
      <input
        type="file"
        accept="video/*"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileInputChange}
      />
      <PipelineStatusBar
        pipelineState={pipelineState}
        onApprove={approve}
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
        pendingVideoObjectUrl={pendingVideoObjectUrl}
        uploadProgress={uploadProgress}
        pendingVideoUrl={pendingVideoUrl}
        pendingVideoName={pendingVideoName}
        activeSkill={activeSkill}
        onClearVideo={clearPendingVideo}
        pipelineMode={pipelineMode}
        setPipelineMode={setPipelineMode}
        onSkillSelect={handleSkillSelect}
        inputRef={inputRef}
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
