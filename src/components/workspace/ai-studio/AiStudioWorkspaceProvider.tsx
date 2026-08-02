'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/hooks/useAuth';
import { SESSIONS_PAGE_SIZE } from '@/lib/agent/sessionsPage';

export interface AgentSession {
  sessionId: string;
  title: string;
  lastMessageAt: string;
  messageCount: number;
}

export interface DeliverableVideo {
  id: string;
  kind: string;
  label: string;
  url: string;
}

export interface DeliverableImage {
  id: string;
  label: string;
  url: string;
  kind?: string;
}

type SessionsPageResponse = {
  sessions: AgentSession[];
  nextCursor: string | null;
};

interface AiStudioWorkspaceContextValue {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  activeSessionId: string | null;
  draftChatId: string;
  setActiveSessionId: (id: string | null) => void;
  commitSession: (sessionId: string) => void;
  startNewProject: () => boolean;
  sessions: AgentSession[];
  sessionsLoading: boolean;
  sessionsLoadingMore: boolean;
  sessionsHasMore: boolean;
  sessionsError: string | null;
  refreshSessions: () => Promise<void>;
  loadMoreSessions: () => Promise<void>;
  deliverablesOpen: boolean;
  setDeliverablesOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  showDeliverablesToggle: boolean;
  setShowDeliverablesToggle: (show: boolean) => void;
  draftVideoUrl: string | undefined;
  setDraftVideoUrl: (url: string | undefined) => void;
  renderedVideos: DeliverableVideo[];
  setRenderedVideos: (videos: DeliverableVideo[]) => void;
  deliverableImages: DeliverableImage[];
  setDeliverableImages: (images: DeliverableImage[]) => void;
}

const AiStudioWorkspaceContext = createContext<AiStudioWorkspaceContextValue | null>(null);

export function useAiStudioWorkspace() {
  const ctx = useContext(AiStudioWorkspaceContext);
  if (!ctx) {
    throw new Error('useAiStudioWorkspace must be used within AiStudioWorkspaceProvider');
  }
  return ctx;
}

export function AiStudioWorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [draftChatId, setDraftChatId] = useState(() => crypto.randomUUID());
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsLoadingMore, setSessionsLoadingMore] = useState(false);
  const [sessionsHasMore, setSessionsHasMore] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [deliverablesOpen, setDeliverablesOpen] = useState(false);
  const [showDeliverablesToggle, setShowDeliverablesToggle] = useState(false);
  const [draftVideoUrl, setDraftVideoUrl] = useState<string | undefined>(undefined);
  const [renderedVideos, setRenderedVideos] = useState<DeliverableVideo[]>([]);
  const [deliverableImages, setDeliverableImages] = useState<DeliverableImage[]>([]);
  const hasLoadedRef = useRef(false);
  const nextCursorRef = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);

  const refreshSessions = useCallback(async () => {
    if (!user) return;
    const isInitialLoad = !hasLoadedRef.current;
    if (isInitialLoad) setSessionsLoading(true);
    setSessionsError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/agent/sessions?limit=${SESSIONS_PAGE_SIZE}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) throw new Error('Could not load projects from agent API');
      const data = (await response.json()) as SessionsPageResponse;
      setSessions(data.sessions);
      nextCursorRef.current = data.nextCursor;
      setSessionsHasMore(data.nextCursor != null);
      hasLoadedRef.current = true;
    } catch (loadError) {
      console.error('Failed to load projects', loadError);
      setSessionsError('Could not load projects from agent API');
    } finally {
      if (isInitialLoad) setSessionsLoading(false);
    }
  }, [user]);

  const loadMoreSessions = useCallback(async () => {
    if (!user || !nextCursorRef.current || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setSessionsLoadingMore(true);
    try {
      const token = await user.getIdToken();
      const cursor = encodeURIComponent(nextCursorRef.current);
      const response = await fetch(
        `/api/agent/sessions?limit=${SESSIONS_PAGE_SIZE}&before=${cursor}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) throw new Error('Could not load more projects');
      const data = (await response.json()) as SessionsPageResponse;
      setSessions((prev) => {
        const seen = new Set(prev.map((s) => s.sessionId));
        const appended = data.sessions.filter((s) => !seen.has(s.sessionId));
        return [...prev, ...appended];
      });
      nextCursorRef.current = data.nextCursor;
      setSessionsHasMore(data.nextCursor != null);
    } catch (loadError) {
      console.error('Failed to load more projects', loadError);
    } finally {
      loadingMoreRef.current = false;
      setSessionsLoadingMore(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refreshSessions();
    const interval = setInterval(refreshSessions, 30_000);
    return () => clearInterval(interval);
  }, [user, refreshSessions]);

  const commitSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
  }, []);

  const startNewProject = useCallback((): boolean => {
    if (activeSessionId === null) {
      return false;
    }
    setActiveSessionId(null);
    setDraftChatId(crypto.randomUUID());
    setDraftVideoUrl(undefined);
    setRenderedVideos([]);
    setDeliverableImages([]);
    return true;
  }, [activeSessionId]);

  return (
    <AiStudioWorkspaceContext.Provider
      value={{
        sidebarCollapsed,
        setSidebarCollapsed,
        activeSessionId,
        draftChatId,
        setActiveSessionId,
        commitSession,
        startNewProject,
        sessions,
        sessionsLoading,
        sessionsLoadingMore,
        sessionsHasMore,
        sessionsError,
        refreshSessions,
        loadMoreSessions,
        deliverablesOpen,
        setDeliverablesOpen,
        showDeliverablesToggle,
        setShowDeliverablesToggle,
        draftVideoUrl,
        setDraftVideoUrl,
        renderedVideos,
        setRenderedVideos,
        deliverableImages,
        setDeliverableImages,
      }}
    >
      {children}
    </AiStudioWorkspaceContext.Provider>
  );
}
