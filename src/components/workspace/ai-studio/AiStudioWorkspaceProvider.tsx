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

export interface AgentSession {
  sessionId: string;
  title: string;
  lastMessageAt: string;
  messageCount: number;
}

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
  sessionsError: string | null;
  refreshSessions: () => Promise<void>;
  deliverablesOpen: boolean;
  setDeliverablesOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  showDeliverablesToggle: boolean;
  setShowDeliverablesToggle: (show: boolean) => void;
  deliverablesCount: number;
  setDeliverablesCount: (count: number) => void;
  draftVideoUrl: string | undefined;
  setDraftVideoUrl: (url: string | undefined) => void;
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
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [deliverablesOpen, setDeliverablesOpen] = useState(false);
  const [showDeliverablesToggle, setShowDeliverablesToggle] = useState(false);
  const [deliverablesCount, setDeliverablesCount] = useState(0);
  const [draftVideoUrl, setDraftVideoUrl] = useState<string | undefined>(undefined);
  const hasLoadedRef = useRef(false);

  const refreshSessions = useCallback(async () => {
    if (!user) return;
    const isInitialLoad = !hasLoadedRef.current;
    if (isInitialLoad) setSessionsLoading(true);
    setSessionsError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/agent/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Could not load projects from agent API');
      const data = (await response.json()) as AgentSession[];
      setSessions(data);
      hasLoadedRef.current = true;
    } catch (loadError) {
      console.error('Failed to load projects', loadError);
      setSessionsError('Could not load projects from agent API');
    } finally {
      if (isInitialLoad) setSessionsLoading(false);
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
        sessionsError,
        refreshSessions,
        deliverablesOpen,
        setDeliverablesOpen,
        showDeliverablesToggle,
        setShowDeliverablesToggle,
        deliverablesCount,
        setDeliverablesCount,
        draftVideoUrl,
        setDraftVideoUrl,
      }}
    >
      {children}
    </AiStudioWorkspaceContext.Provider>
  );
}
