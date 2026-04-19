import { db } from '../config/firebase';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type WorkspaceFeature = 'director' | 'ai-influencer' | 'product-studio';

export interface WorkspaceMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface WorkspaceSession {
    id: string;
    userId: string;
    userEmail?: string;
    proOrgId?: string;
    feature: WorkspaceFeature;
    title: string;
    preview: string;
    createdAt: any;
    updatedAt: any;
    /** Arbitrary state snapshot — each feature stores its own shape here */
    state: Record<string, any>;
    /** Conversation messages */
    messages: WorkspaceMessage[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Firestore helpers
// ─────────────────────────────────────────────────────────────────────────────

const USERS_COLLECTION = 'users';
const SESSIONS_SUBCOLLECTION = 'workspace_sessions';

/** Generate a quick unique ID */
function newId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
}

/** Convert a raw Firestore Timestamp (or null) to a JS Date */
export function toDate(ts: any): Date | null {
    if (!ts) return null;
    if (ts instanceof Timestamp) return ts.toDate();
    if (ts?.seconds) return new Date(ts.seconds * 1000);
    if (ts instanceof Date) return ts;
    return null;
}

/** Format a session date for display */
export function formatSessionDate(ts: any): string {
    const d = toDate(ts);
    if (!d) return '';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a brand-new workspace session.
 * @param userId  Authenticated user UID
 * @param feature  Which workspace tool this session belongs to
 * @param title    Short human-readable title (e.g., first message snippet)
 * @param initialState  Initial feature-specific state to persist
 * @param initialMessages  Initial messages to include
 */
export async function createWorkspaceSession(
    userId: string,
    feature: WorkspaceFeature,
    title: string,
    initialState: Record<string, any> = {},
    initialMessages: WorkspaceMessage[] = [],
): Promise<string> {
    const id = newId(feature);
    const ref = doc(db, USERS_COLLECTION, userId, SESSIONS_SUBCOLLECTION, id);

    const data: Omit<WorkspaceSession, 'id'> = {
        userId,
        feature,
        title: title.substring(0, 80),
        preview: title.substring(0, 120),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        state: initialState,
        messages: initialMessages,
    };

    await setDoc(ref, { ...data, id });
    return id;
}

/**
 * Upsert state for an existing session (merges into existing state).
 */
export async function updateWorkspaceSession(
    sessionId: string,
    patch: {
        title?: string;
        preview?: string;
        state?: Record<string, any>;
        messages?: WorkspaceMessage[];
    },
    userId?: string,
): Promise<void> {
    // Extract userId from sessionId if not provided (backward compatibility)
    if (!userId) {
        console.warn('updateWorkspaceSession: userId not provided, this may cause issues');
        // Try to extract from sessionId pattern: feature_timestamp_random
        // This is a fallback and should be avoided
        throw new Error('userId is required for updateWorkspaceSession');
    }
    const ref = doc(db, USERS_COLLECTION, userId, SESSIONS_SUBCOLLECTION, sessionId);
    const updateData: Record<string, any> = {
        updatedAt: serverTimestamp(),
    };
    if (patch.title !== undefined) updateData.title = patch.title.substring(0, 80);
    if (patch.preview !== undefined) updateData.preview = patch.preview.substring(0, 120);
    
    // Filter out undefined values from state to prevent Firestore errors
    if (patch.state !== undefined) {
        const cleanedState: Record<string, any> = {};
        Object.entries(patch.state).forEach(([key, value]) => {
            if (value !== undefined) {
                cleanedState[key] = value;
            }
        });
        updateData.state = cleanedState;
    }
    
    if (patch.messages !== undefined) updateData.messages = patch.messages;

    await updateDoc(ref, updateData);
}

/**
 * Fetch a single session by ID.
 */
export async function getWorkspaceSession(sessionId: string, userId: string): Promise<WorkspaceSession | null> {
    try {
        const snap = await getDoc(doc(db, USERS_COLLECTION, userId, SESSIONS_SUBCOLLECTION, sessionId));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as WorkspaceSession;
    } catch {
        return null;
    }
}

/**
 * List all sessions for a user+feature, sorted by creation date (oldest first, newest at bottom).
 */
export async function getUserWorkspaceSessions(
    userId: string,
    feature: WorkspaceFeature,
): Promise<WorkspaceSession[]> {
    try {
        const q = query(
            collection(db, USERS_COLLECTION, userId, SESSIONS_SUBCOLLECTION),
            where('feature', '==', feature),
            orderBy('createdAt', 'asc'),
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }) as WorkspaceSession);
    } catch (err) {
        console.error('Error fetching workspace sessions:', err);
        return [];
    }
}

/**
 * Delete a session.
 */
export async function deleteWorkspaceSession(sessionId: string, userId: string): Promise<void> {
    await deleteDoc(doc(db, USERS_COLLECTION, userId, SESSIONS_SUBCOLLECTION, sessionId));
}

// ─────────────────────────────────────────────────────────────────────────────
// Pro Organisation shared session CRUD
// ─────────────────────────────────────────────────────────────────────────────

const PRO_ORGS_COLLECTION = 'proOrganisations';

export async function createProOrgWorkspaceSession(
    proOrgId: string,
    userId: string,
    userEmail: string,
    feature: WorkspaceFeature,
    title: string,
    initialState: Record<string, any> = {},
    initialMessages: WorkspaceMessage[] = [],
): Promise<string> {
    const id = newId(feature);
    const ref = doc(db, PRO_ORGS_COLLECTION, proOrgId, SESSIONS_SUBCOLLECTION, id);
    await setDoc(ref, {
        id,
        userId,
        userEmail,
        proOrgId,
        feature,
        title: title.substring(0, 80),
        preview: title.substring(0, 120),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        state: initialState,
        messages: initialMessages,
    });
    return id;
}

export async function updateProOrgWorkspaceSession(
    proOrgId: string,
    sessionId: string,
    patch: {
        title?: string;
        preview?: string;
        state?: Record<string, any>;
        messages?: WorkspaceMessage[];
    },
): Promise<void> {
    const ref = doc(db, PRO_ORGS_COLLECTION, proOrgId, SESSIONS_SUBCOLLECTION, sessionId);
    const updateData: Record<string, any> = { updatedAt: serverTimestamp() };
    if (patch.title !== undefined) updateData.title = patch.title.substring(0, 80);
    if (patch.preview !== undefined) updateData.preview = patch.preview.substring(0, 120);
    if (patch.state !== undefined) {
        const cleaned: Record<string, any> = {};
        Object.entries(patch.state).forEach(([k, v]) => { if (v !== undefined) cleaned[k] = v; });
        updateData.state = cleaned;
    }
    if (patch.messages !== undefined) updateData.messages = patch.messages;
    await updateDoc(ref, updateData);
}

export async function getProOrgWorkspaceSession(
    proOrgId: string,
    sessionId: string,
): Promise<WorkspaceSession | null> {
    try {
        const snap = await getDoc(doc(db, PRO_ORGS_COLLECTION, proOrgId, SESSIONS_SUBCOLLECTION, sessionId));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as WorkspaceSession;
    } catch {
        return null;
    }
}

export async function getProOrgWorkspaceSessions(
    proOrgId: string,
    feature: WorkspaceFeature,
): Promise<WorkspaceSession[]> {
    try {
        const q = query(
            collection(db, PRO_ORGS_COLLECTION, proOrgId, SESSIONS_SUBCOLLECTION),
            where('feature', '==', feature),
            orderBy('createdAt', 'asc'),
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }) as WorkspaceSession);
    } catch (err) {
        console.error('Error fetching pro org workspace sessions:', err);
        return [];
    }
}

export async function deleteProOrgWorkspaceSession(
    proOrgId: string,
    sessionId: string,
): Promise<void> {
    await deleteDoc(doc(db, PRO_ORGS_COLLECTION, proOrgId, SESSIONS_SUBCOLLECTION, sessionId));
}
