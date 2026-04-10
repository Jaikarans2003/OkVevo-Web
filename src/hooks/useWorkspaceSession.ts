import { useState, useCallback, useRef } from 'react';
import {
    createWorkspaceSession,
    updateWorkspaceSession,
    getWorkspaceSession,
    WorkspaceSession,
    WorkspaceFeature,
    WorkspaceMessage,
} from '../services/WorkspaceSessionService';

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useWorkspaceSession
 *
 * A thin wrapper around WorkspaceSessionService that gives any feature page
 * create / restore / autosave capabilities.
 *
 * Usage:
 *   const { sessionId, initSession, saveSession, restoreSession, resetSession } =
 *       useWorkspaceSession('director', userId);
 */
export function useWorkspaceSession(feature: WorkspaceFeature, userId: string | null) {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    // Debounce timer ref so we don't hammer Firestore on every keystroke
    const saveTimer = useRef<NodeJS.Timeout | null>(null);

    /**
     * Create a new session and return its ID.
     * Call this when the user submits their first meaningful input.
     */
    const initSession = useCallback(async (
        title: string,
        initialState: Record<string, any> = {},
        initialMessages: WorkspaceMessage[] = [],
    ): Promise<string | null> => {
        if (!userId) return null;
        try {
            const id = await createWorkspaceSession(userId, feature, title, initialState, initialMessages);
            setSessionId(id);
            return id;
        } catch (err) {
            console.error('[useWorkspaceSession] initSession error:', err);
            return null;
        }
    }, [feature, userId]);

    /**
     * Save (debounced) current state + messages to the active session.
     * Call whenever important state changes.
     */
    const saveSession = useCallback((
        state: Record<string, any>,
        messages: WorkspaceMessage[],
        title?: string,
        debounceMs = 1500,
    ) => {
        if (!sessionId || !userId) return;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            setIsSaving(true);
            try {
                await updateWorkspaceSession(sessionId, {
                    state,
                    messages,
                    ...(title ? { title: title.substring(0, 80), preview: title.substring(0, 120) } : {}),
                }, userId);
            } catch (err) {
                console.error('[useWorkspaceSession] saveSession error:', err);
            } finally {
                setIsSaving(false);
            }
        }, debounceMs);
    }, [sessionId, userId]);

    /**
     * Immediately flush any pending save (e.g., on unmount or step change).
     */
    const flushSave = useCallback(async (
        state: Record<string, any>,
        messages: WorkspaceMessage[],
        title?: string,
    ) => {
        if (!sessionId || !userId) return;
        if (saveTimer.current) {
            clearTimeout(saveTimer.current);
            saveTimer.current = null;
        }
        setIsSaving(true);
        try {
            await updateWorkspaceSession(sessionId, {
                state,
                messages,
                ...(title ? { title: title.substring(0, 80), preview: title.substring(0, 120) } : {}),
            }, userId);
        } catch (err) {
            console.error('[useWorkspaceSession] flushSave error:', err);
        } finally {
            setIsSaving(false);
        }
    }, [sessionId, userId]);

    /**
     * Load a session from Firestore and return its data.
     * The caller is responsible for restoring local state from the returned session.
     */
    const restoreSession = useCallback(async (id: string): Promise<WorkspaceSession | null> => {
        if (!userId) return null;
        try {
            const session = await getWorkspaceSession(id, userId);
            if (session) {
                setSessionId(id);
            }
            return session;
        } catch (err) {
            console.error('[useWorkspaceSession] restoreSession error:', err);
            return null;
        }
    }, [userId]);

    /**
     * Reset — clear the session ID so the next meaningful input creates a new session.
     */
    const resetSession = useCallback(() => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        setSessionId(null);
    }, []);

    return {
        sessionId,
        isSaving,
        initSession,
        saveSession,
        flushSave,
        restoreSession,
        resetSession,
    };
}
