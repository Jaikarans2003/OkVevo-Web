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

const COLLECTION = 'workspace_sessions';

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
    const ref = doc(db, COLLECTION, id);

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
): Promise<void> {
    const ref = doc(db, COLLECTION, sessionId);
    const updateData: Record<string, any> = {
        updatedAt: serverTimestamp(),
    };
    if (patch.title !== undefined) updateData.title = patch.title.substring(0, 80);
    if (patch.preview !== undefined) updateData.preview = patch.preview.substring(0, 120);
    if (patch.state !== undefined) updateData.state = patch.state;
    if (patch.messages !== undefined) updateData.messages = patch.messages;

    await updateDoc(ref, updateData);
}

/**
 * Fetch a single session by ID.
 */
export async function getWorkspaceSession(sessionId: string): Promise<WorkspaceSession | null> {
    try {
        const snap = await getDoc(doc(db, COLLECTION, sessionId));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as WorkspaceSession;
    } catch {
        return null;
    }
}

/**
 * List all sessions for a user+feature, newest first.
 */
export async function getUserWorkspaceSessions(
    userId: string,
    feature: WorkspaceFeature,
): Promise<WorkspaceSession[]> {
    try {
        const q = query(
            collection(db, COLLECTION),
            where('userId', '==', userId),
            where('feature', '==', feature),
            orderBy('updatedAt', 'desc'),
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
export async function deleteWorkspaceSession(sessionId: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, sessionId));
}
