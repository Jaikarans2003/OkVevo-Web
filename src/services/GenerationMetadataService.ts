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
    limit,
    Timestamp,
    serverTimestamp
} from 'firebase/firestore';
import type { GenerationFiles } from './GenerationStorageService';

export type GenerationStatus = 'processing' | 'completed' | 'failed';

export interface GenerationMetadata {
    id: string;
    userId: string;
    organisationId?: string;
    sessionId: string;
    title: string;
    description: string;
    status: GenerationStatus;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    duration: number;
    files: GenerationFiles;
}

const GENERATIONS_COLLECTION = 'generations';

/**
 * Create a new generation record
 */
export async function createGeneration(
    userId: string,
    sessionId: string,
    title: string,
    description: string,
    organisationId?: string
): Promise<string> {
    try {
        const generationId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const generationRef = doc(db, GENERATIONS_COLLECTION, generationId);

        const generationData: Omit<GenerationMetadata, 'id' | 'createdAt' | 'updatedAt'> = {
            userId,
            organisationId,
            sessionId,
            title,
            description,
            status: 'processing',
            duration: 0,
            files: {
                videos: []
            }
        };

        await setDoc(generationRef, {
            ...generationData,
            id: generationId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        console.log('✅ Generation record created:', generationId);
        return generationId;
    } catch (error) {
        console.error('❌ Failed to create generation record:', error);
        throw new Error('Failed to create generation record');
    }
}

/**
 * Update generation status
 */
export async function updateGenerationStatus(
    generationId: string,
    status: GenerationStatus
): Promise<void> {
    try {
        const generationRef = doc(db, GENERATIONS_COLLECTION, generationId);
        await updateDoc(generationRef, {
            status,
            updatedAt: serverTimestamp()
        });

        console.log(`✅ Generation ${generationId} status updated to ${status}`);
    } catch (error) {
        console.error('❌ Failed to update generation status:', error);
        throw new Error('Failed to update generation status');
    }
}

/**
 * Update generation files
 */
export async function updateGenerationFiles(
    generationId: string,
    files: Partial<GenerationFiles>
): Promise<void> {
    try {
        const generationRef = doc(db, GENERATIONS_COLLECTION, generationId);
        const generationDoc = await getDoc(generationRef);

        if (!generationDoc.exists()) {
            throw new Error('Generation not found');
        }

        const currentFiles = generationDoc.data().files || { videos: [] };
        const updatedFiles = { ...currentFiles, ...files };

        await updateDoc(generationRef, {
            files: updatedFiles,
            updatedAt: serverTimestamp()
        });

        console.log(`✅ Generation ${generationId} files updated`);
    } catch (error) {
        console.error('❌ Failed to update generation files:', error);
        throw new Error('Failed to update generation files');
    }
}

/**
 * Update generation duration
 */
export async function updateGenerationDuration(
    generationId: string,
    duration: number
): Promise<void> {
    try {
        const generationRef = doc(db, GENERATIONS_COLLECTION, generationId);
        await updateDoc(generationRef, {
            duration,
            updatedAt: serverTimestamp()
        });

        console.log(`✅ Generation ${generationId} duration updated to ${duration}s`);
    } catch (error) {
        console.error('❌ Failed to update generation duration:', error);
        throw new Error('Failed to update generation duration');
    }
}

/**
 * Update generation title and description
 */
export async function updateGenerationInfo(
    generationId: string,
    title?: string,
    description?: string
): Promise<void> {
    try {
        const generationRef = doc(db, GENERATIONS_COLLECTION, generationId);
        const updates: any = {
            updatedAt: serverTimestamp()
        };

        if (title) updates.title = title;
        if (description) updates.description = description;

        await updateDoc(generationRef, updates);

        console.log(`✅ Generation ${generationId} info updated`);
    } catch (error) {
        console.error('❌ Failed to update generation info:', error);
        throw new Error('Failed to update generation info');
    }
}

/**
 * Get a single generation by ID
 */
export async function getGeneration(generationId: string): Promise<GenerationMetadata | null> {
    try {
        const generationRef = doc(db, GENERATIONS_COLLECTION, generationId);
        const generationDoc = await getDoc(generationRef);

        if (generationDoc.exists()) {
            return generationDoc.data() as GenerationMetadata;
        }
        return null;
    } catch (error) {
        console.error('❌ Failed to get generation:', error);
        return null;
    }
}

/**
 * Get all generations for a user
 */
export async function getUserGenerations(
    userId: string,
    maxResults: number = 50
): Promise<GenerationMetadata[]> {
    try {
        const generationsRef = collection(db, GENERATIONS_COLLECTION);
        const q = query(
            generationsRef,
            where('userId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(maxResults)
        );

        const querySnapshot = await getDocs(q);
        const generations: GenerationMetadata[] = [];

        querySnapshot.forEach((doc) => {
            generations.push(doc.data() as GenerationMetadata);
        });

        console.log(`✅ Retrieved ${generations.length} generations for user ${userId}`);
        return generations;
    } catch (error) {
        console.error('❌ Failed to get user generations:', error);
        return [];
    }
}

/**
 * Get all generations for an organisation
 */
export async function getOrganisationGenerations(
    organisationId: string,
    maxResults: number = 50
): Promise<GenerationMetadata[]> {
    try {
        const generationsRef = collection(db, GENERATIONS_COLLECTION);
        const q = query(
            generationsRef,
            where('organisationId', '==', organisationId),
            orderBy('createdAt', 'desc'),
            limit(maxResults)
        );

        const querySnapshot = await getDocs(q);
        const generations: GenerationMetadata[] = [];

        querySnapshot.forEach((doc) => {
            generations.push(doc.data() as GenerationMetadata);
        });

        console.log(`✅ Retrieved ${generations.length} generations for organisation ${organisationId}`);
        return generations;
    } catch (error) {
        console.error('❌ Failed to get organisation generations:', error);
        return [];
    }
}

/**
 * Get generations by status
 */
export async function getGenerationsByStatus(
    userId: string,
    status: GenerationStatus,
    maxResults: number = 50
): Promise<GenerationMetadata[]> {
    try {
        const generationsRef = collection(db, GENERATIONS_COLLECTION);
        const q = query(
            generationsRef,
            where('userId', '==', userId),
            where('status', '==', status),
            orderBy('createdAt', 'desc'),
            limit(maxResults)
        );

        const querySnapshot = await getDocs(q);
        const generations: GenerationMetadata[] = [];

        querySnapshot.forEach((doc) => {
            generations.push(doc.data() as GenerationMetadata);
        });

        console.log(`✅ Retrieved ${generations.length} ${status} generations for user ${userId}`);
        return generations;
    } catch (error) {
        console.error('❌ Failed to get generations by status:', error);
        return [];
    }
}

/**
 * Delete a generation record
 */
export async function deleteGenerationMetadata(generationId: string): Promise<void> {
    try {
        const generationRef = doc(db, GENERATIONS_COLLECTION, generationId);
        await deleteDoc(generationRef);

        console.log(`✅ Generation ${generationId} metadata deleted`);
    } catch (error) {
        console.error('❌ Failed to delete generation metadata:', error);
        throw new Error('Failed to delete generation metadata');
    }
}

/**
 * Delete generation completely (metadata + files)
 * This should be called from a service that handles both
 */
export async function deleteGenerationComplete(
    generationId: string,
    userId: string,
    sessionId: string
): Promise<void> {
    try {
        // Delete files from storage
        const { deleteGeneration } = await import('./GenerationStorageService');
        await deleteGeneration(userId, sessionId);

        // Delete metadata
        await deleteGenerationMetadata(generationId);

        console.log(`✅ Generation ${generationId} completely deleted`);
    } catch (error) {
        console.error('❌ Failed to delete generation completely:', error);
        throw new Error('Failed to delete generation completely');
    }
}
