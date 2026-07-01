import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';

import { Clock, Plus } from 'lucide-react';

interface AgentSession {
    sessionId: string;
    title: string;
    lastMessageAt: string;
    messageCount: number;
}

function timeAgo(date: any) {
    if (!date) return '';
    const now = new Date();
    const past = new Date(date.toDate ? date.toDate() : date);
    const diffMs = now.getTime() - past.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return past.toLocaleDateString();
}

export default function ChatHistorySidebar({
    isOpen,
    onClose,
    onSessionSelect,
    onNewChat,
    activeSessionId,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSessionSelect: (sessionId: string) => void;
    onNewChat?: () => void;
    activeSessionId?: string;
}) {
    const { user } = useAuth();
    const [sessions, setSessions] = useState<AgentSession[]>([]);
    const [loading, setLoading] = useState(false);
    const hasLoadedRef = useRef(false);

    const loadSessions = useCallback(async () => {
        if (!user) return;
        const isInitialLoad = !hasLoadedRef.current;
        if (isInitialLoad) {
            setLoading(true);
        }
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/agent/sessions', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) {
                throw new Error('Failed to fetch sessions');
            }
            const data = (await response.json()) as AgentSession[];
            setSessions(data);
            hasLoadedRef.current = true;
        } catch (error) {
            console.error('Failed to load sessions', error);
        } finally {
            if (isInitialLoad) {
                setLoading(false);
            }
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        loadSessions();
        const interval = setInterval(loadSessions, 30_000);
        return () => clearInterval(interval);
    }, [user, loadSessions]);

    const handleSelectSession = (sessionId: string) => {
        onSessionSelect(sessionId);
        onClose();
    };

    const handleNewChat = () => {
        if (onNewChat) {
            onNewChat();
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-80 bg-black/60 backdrop-blur-2xl border-l border-white/10 shadow-2xl z-50 transform transition-transform duration-300">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-white font-bold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-accent-orange" /> History
                </h2>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white"
                >
                    ✕
                </button>
            </div>

            <div className="p-4">
                <button
                    onClick={handleNewChat}
                    className="w-full py-3 bg-accent-orange/10 hover:bg-accent-orange/20 text-accent-orange font-bold rounded-xl mb-4 flex items-center justify-center gap-2 transition-colors border border-accent-orange/20"
                >
                    <Plus className="w-4 h-4" /> New Chat
                </button>

                <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-180px)] scrollbar-thin scrollbar-thumb-white/10">
                    {loading ? (
                        <div className="text-center text-gray-500 py-4">Loading history...</div>
                    ) : sessions.length === 0 ? (
                        <div className="text-center text-gray-500 py-4">No history yet</div>
                    ) : (
                        sessions.map((session) => (
                            <button
                                key={session.sessionId}
                                onClick={() => handleSelectSession(session.sessionId)}
                                className={`w-full text-left p-3 rounded-xl transition-all border ${activeSessionId === session.sessionId
                                    ? 'bg-accent-orange/10 border-accent-orange/30'
                                    : 'bg-white/5 border-transparent hover:bg-white/10'
                                    }`}
                            >
                                <div className="font-medium text-gray-200 text-sm truncate mb-1">
                                    {session.title || 'Untitled Chat'}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-2">
                                    <span>
                                        {session.lastMessageAt
                                            ? timeAgo(session.lastMessageAt)
                                            : 'Just now'
                                        }
                                    </span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
