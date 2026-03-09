'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Plus, Trash2, ChevronRight, Clock, X, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import {
    getUserWorkspaceSessions,
    deleteWorkspaceSession,
    formatSessionDate,
    WorkspaceSession,
    WorkspaceFeature,
} from '@/services/WorkspaceSessionService';

// ─────────────────────────────────────────────────────────────────────────────
// Types & props
// ─────────────────────────────────────────────────────────────────────────────

interface SessionHistorySidebarProps {
    userId: string | null;
    feature: WorkspaceFeature;
    currentSessionId: string | null;
    onSelectSession: (session: WorkspaceSession) => void;
    onNewSession: () => void;
    /** Accent colour class for the active highlight, e.g. "purple" | "orange" | "cyan" */
    accentColor?: 'purple' | 'orange' | 'cyan' | 'pink';
}

// ─────────────────────────────────────────────────────────────────────────────
// Accent colour maps
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    purple: {
        bg: 'bg-purple-500/10',
        text: 'text-purple-400',
        border: 'border-purple-500/30',
        dot: 'bg-purple-500',
    },
    orange: {
        bg: 'bg-orange-500/10',
        text: 'text-orange-400',
        border: 'border-orange-500/30',
        dot: 'bg-orange-500',
    },
    cyan: {
        bg: 'bg-cyan-500/10',
        text: 'text-cyan-400',
        border: 'border-cyan-500/30',
        dot: 'bg-cyan-500',
    },
    pink: {
        bg: 'bg-pink-500/10',
        text: 'text-pink-400',
        border: 'border-pink-500/30',
        dot: 'bg-pink-500',
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SessionHistorySidebar({
    userId,
    feature,
    currentSessionId,
    onSelectSession,
    onNewSession,
    accentColor = 'purple',
}: SessionHistorySidebarProps) {
    const [sessions, setSessions] = useState<WorkspaceSession[]>([]);
    const [loading, setLoading] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const accent = ACCENT[accentColor] ?? ACCENT.purple;

    const loadSessions = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const result = await getUserWorkspaceSessions(userId, feature);
            setSessions(result);
        } finally {
            setLoading(false);
        }
    }, [userId, feature]);

    useEffect(() => {
        loadSessions();
    }, [loadSessions, currentSessionId]); // Refresh when session changes

    const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        setDeletingId(sessionId);
        try {
            await deleteWorkspaceSession(sessionId);
            setSessions(prev => prev.filter(s => s.id !== sessionId));
        } finally {
            setDeletingId(null);
        }
    };

    // ── Collapsed pill ────────────────────────────────────────────────────────
    if (collapsed) {
        return (
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col items-center gap-3 w-12 py-4 px-1 bg-[#0A0A0A] border-r border-white/5 h-full"
            >
                <button
                    onClick={() => setCollapsed(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                    title="Expand history"
                >
                    <PanelLeftOpen size={16} className="text-white/40" />
                </button>
                <button
                    onClick={onNewSession}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                    title="New session"
                >
                    <Plus size={16} className="text-white/40" />
                </button>
                {sessions.slice(0, 6).map(s => (
                    <button
                        key={s.id}
                        onClick={() => onSelectSession(s)}
                        title={s.title}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${s.id === currentSessionId
                            ? `${accent.bg} ${accent.text}`
                            : 'hover:bg-white/10 text-white/30'
                            }`}
                    >
                        <div className={`w-2 h-2 rounded-full ${s.id === currentSessionId ? accent.dot : 'bg-white/20'}`} />
                    </button>
                ))}
            </motion.div>
        );
    }

    // ── Expanded sidebar ──────────────────────────────────────────────────────
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-64 flex-shrink-0 flex flex-col bg-[#080808] border-r border-white/5 h-full overflow-hidden"
        >
            {/* Header */}
            <div className="px-4 py-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <History size={14} className={accent.text} />
                    <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/50">
                        History
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onNewSession}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                        title="New session"
                    >
                        <Plus size={13} className="text-white/50 hover:text-white transition-colors" />
                    </button>
                    <button
                        onClick={() => setCollapsed(true)}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                        title="Collapse"
                    >
                        <PanelLeftClose size={13} className="text-white/50 hover:text-white transition-colors" />
                    </button>
                </div>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto py-2 space-y-0.5 custom-scrollbar" data-lenis-prevent>
                {loading ? (
                    <div className="flex flex-col gap-2 p-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
                        <div className={`w-10 h-10 rounded-xl ${accent.bg} border ${accent.border} flex items-center justify-center`}>
                            <Clock size={18} className={accent.text} />
                        </div>
                        <p className="text-[10px] text-white/30 leading-relaxed">
                            No saved sessions yet.<br />Start creating to build your history.
                        </p>
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {sessions.map(session => {
                            const isActive = session.id === currentSessionId;
                            return (
                                <motion.div
                                    key={session.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <div
                                        onClick={() => onSelectSession(session)}
                                        className={`w-full text-left px-4 py-3 flex items-start gap-3 group relative transition-colors cursor-pointer ${isActive
                                            ? `${accent.bg} border-r-2 ${accent.border.replace('border', 'border-r')}`
                                            : 'hover:bg-white/5 border-r-2 border-r-transparent'
                                            }`}
                                    >
                                        {/* Accent dot */}
                                        <div className="mt-1 flex-shrink-0">
                                            <div className={`w-1.5 h-1.5 rounded-full transition-colors ${isActive ? accent.dot : 'bg-white/20'}`} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[11px] font-medium truncate leading-tight ${isActive ? 'text-white' : 'text-white/60 group-hover:text-white/80'} transition-colors`}>
                                                {session.title || 'Untitled Session'}
                                            </p>
                                            <p className="text-[9px] text-white/25 mt-0.5">
                                                {formatSessionDate(session.updatedAt)}
                                            </p>
                                        </div>

                                        {/* Delete button on hover */}
                                        <button
                                            onClick={e => handleDelete(e, session.id)}
                                            disabled={deletingId === session.id}
                                            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20 hover:text-red-400 text-white/30"
                                            title="Delete session"
                                        >
                                            {deletingId === session.id ? (
                                                <div className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
                                            ) : (
                                                <Trash2 size={10} />
                                            )}
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>

            {/* Footer — new session shortcut */}
            <div className="px-4 py-3 border-t border-white/5">
                <button
                    onClick={onNewSession}
                    className={`w-full py-2.5 rounded-xl text-[9px] uppercase tracking-widest font-bold transition-all border flex items-center justify-center gap-2 ${accent.bg} ${accent.text} ${accent.border} hover:brightness-110`}
                >
                    <Plus size={11} />
                    New Session
                </button>
            </div>
        </motion.div>
    );
}
