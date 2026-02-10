import { db } from '../config/firebase';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    Timestamp,
    addDoc
} from 'firebase/firestore';
import type { ChatFlowState } from '../hooks/useChatFlow';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    type?: 'greeting' | 'enhancement' | 'scenes' | 'scene_review';
    createdAt: any; // Firestore Timestamp or Date
}

export interface ChatSession {
    id: string;
    userId: string;
    title: string;
    createdAt: any;
    updatedAt: any;
    currentState: ChatFlowState;
    preview: string;
    metadata?: {
        pendingStory?: string;
        targetDuration?: number;
        narrationResult?: any;
        audioUrl?: string;
        videoUrls?: string[];
    };
}

const CHAT_SESSIONS_COLLECTION = 'chat_sessions';
const MESSAGES_SUBCOLLECTION = 'messages';

/**
 * Create a new chat session
 */
export async function createChatSession(userId: string, initialMessage: string): Promise<string> {
    try {
        const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const sessionRef = doc(db, CHAT_SESSIONS_COLLECTION, sessionId);

        const sessionData = {
            id: sessionId,
            userId,
            title: initialMessage.substring(0, 50) + (initialMessage.length > 50 ? '...' : ''),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            currentState: 'awaiting_story' as ChatFlowState,
            preview: initialMessage.substring(0, 100),
            metadata: {}
        };

        await setDoc(sessionRef, sessionData);

        // Add initial message
        await addMessage(sessionId, {
            role: 'user',
            content: initialMessage
        });

        return sessionId;
    } catch (error) {
        console.error('Error creating chat session:', error);
        throw error;
    }
}

/**
 * Add a message to a session
 */
export async function addMessage(sessionId: string, message: Omit<ChatMessage, 'createdAt'>): Promise<void> {
    try {
        const messagesRef = collection(db, CHAT_SESSIONS_COLLECTION, sessionId, MESSAGES_SUBCOLLECTION);
        const messageData: any = {
            role: message.role,
            content: message.content,
            createdAt: serverTimestamp()
        };
        if (message.type) {
            messageData.type = message.type;
        }

        await addDoc(messagesRef, messageData);

        // Update session preview and timestamp
        const sessionRef = doc(db, CHAT_SESSIONS_COLLECTION, sessionId);
        await updateDoc(sessionRef, {
            updatedAt: serverTimestamp(),
            preview: message.content.substring(0, 100)
        });
    } catch (error) {
        console.error('Error adding message:', error);
        throw error;
    }
}

/**
 * Update session state
 */
export async function updateSessionState(sessionId: string, state: ChatFlowState): Promise<void> {
    try {
        const sessionRef = doc(db, CHAT_SESSIONS_COLLECTION, sessionId);
        await updateDoc(sessionRef, {
            currentState: state,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Error updating session state:', error);
        throw error;
    }
}

/**
 * Get user's chat sessions
 */
export async function getUserChatSessions(userId: string): Promise<ChatSession[]> {
    try {
        const q = query(
            collection(db, CHAT_SESSIONS_COLLECTION),
            where('userId', '==', userId),
            orderBy('updatedAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                // Convert Timestamps to dates/strings if needed, but keeping raw for now
                createdAt: data.createdAt,
                updatedAt: data.updatedAt
            } as ChatSession;
        });
    } catch (error) {
        console.error('Error fetching chat sessions:', error);
        return [];
    }
}

/**
 * Get messages for a session
 */
export async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    try {
        const q = query(
            collection(db, CHAT_SESSIONS_COLLECTION, sessionId, MESSAGES_SUBCOLLECTION),
            orderBy('createdAt', 'asc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as ChatMessage);
    } catch (error) {
        console.error('Error fetching session messages:', error);
        return [];
    }
}

/**
 * Get single session metadata
 */
export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
    try {
        const docRef = doc(db, CHAT_SESSIONS_COLLECTION, sessionId);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
            return snapshot.data() as ChatSession;
        }
        return null;
    } catch (error) {
        console.error('Error fetching chat session:', error);
        return null;
    }
}

/**
 * Update session metadata
 */
export async function updateSessionMetadata(sessionId: string, metadata: Partial<ChatSession['metadata']>): Promise<void> {
    try {
        const sessionRef = doc(db, CHAT_SESSIONS_COLLECTION, sessionId);
        await setDoc(sessionRef, { metadata }, { merge: true });
    } catch (error) {
        console.error('Error updating session metadata:', error);
        throw error;
    }
}
