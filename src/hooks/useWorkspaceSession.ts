import { useState, useCallback, useRef } from 'react';
import {
    createWorkspaceSession,
    updateWorkspaceSession,
    getWorkspaceSession,
    createProOrgWorkspaceSession,
    updateProOrgWorkspaceSession,
    getProOrgWorkspaceSession,
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
 * When proOrgId is supplied all session data is stored in the shared
 * proOrganisations/{proOrgId}/workspace_sessions subcollection so every
 * Pro Team member sees the same history.
 *
 * Usage:
 *   const { sessionId, initSession, saveSession, restoreSession, resetSession } =
 *       useWorkspaceSession('ai-influencer', userId, proOrgId, userEmail);
 */
export function useWorkspaceSession(
    feature: WorkspaceFeature,
    userId: string | null,
    proOrgId?: string | null,
    userEmail?: string | null,
) {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const saveTimer = useRef<NodeJS.Timeout | null>(null);

    const isProTeam = !!(proOrgId && userId);

    /**
     * Create a new session and return its ID.
     */
    const initSession = useCallback(async (
        title: string,
        initialState: Record<string, any> = {},
        initialMessages: WorkspaceMessage[] = [],
    ): Promise<string | null> => {
        if (!userId) return null;
        try {
            const id = isProTeam
                ? await createProOrgWorkspaceSession(proOrgId!, userId, userEmail || '', feature, title, initialState, initialMessages)
                : await createWorkspaceSession(userId, feature, title, initialState, initialMessages);
            setSessionId(id);
            return id;
        } catch (err) {
            console.error('[useWorkspaceSession] initSession error:', err);
            return null;
        }
    }, [feature, userId, proOrgId, userEmail, isProTeam]);

    /**
     * Save (debounced) current state + messages to the active session.
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
                const patch = {
                    state,
                    messages,
                    ...(title ? { title: title.substring(0, 80), preview: title.substring(0, 120) } : {}),
                };
                if (isProTeam) {
                    await updateProOrgWorkspaceSession(proOrgId!, sessionId, patch);
                } else {
                    await updateWorkspaceSession(sessionId, patch, userId);
                }
            } catch (err) {
                console.error('[useWorkspaceSession] saveSession error:', err);
            } finally {
                setIsSaving(false);
            }
        }, debounceMs);
    }, [sessionId, userId, proOrgId, isProTeam]);

    /**
     * Immediately flush any pending save.
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
            const patch = {
                state,
                messages,
                ...(title ? { title: title.substring(0, 80), preview: title.substring(0, 120) } : {}),
            };
            if (isProTeam) {
                await updateProOrgWorkspaceSession(proOrgId!, sessionId, patch);
            } else {
                await updateWorkspaceSession(sessionId, patch, userId);
            }
        } catch (err) {
            console.error('[useWorkspaceSession] flushSave error:', err);
        } finally {
            setIsSaving(false);
        }
    }, [sessionId, userId, proOrgId, isProTeam]);

    /**
     * Load a session from Firestore and return its data.
     */
    const restoreSession = useCallback(async (id: string): Promise<WorkspaceSession | null> => {
        if (!userId) return null;
        try {
            const session = isProTeam
                ? await getProOrgWorkspaceSession(proOrgId!, id)
                : await getWorkspaceSession(id, userId);
            if (session) setSessionId(id);
            return session;
        } catch (err) {
            console.error('[useWorkspaceSession] restoreSession error:', err);
            return null;
        }
    }, [userId, proOrgId, isProTeam]);

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
