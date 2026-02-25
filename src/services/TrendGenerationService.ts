/**
 * Trend Generation Service — Fire-and-Forget with Firestore
 *
 * 1. Upload user's photo to Firebase Storage
 * 2. Create a Firestore doc in `trendGenerations`
 * 3. Dispatch SQS jobs (image + optional video)
 * 4. Return immediately — no polling
 *
 * The Lambda updates the Firestore doc when done.
 */

import { storage, db } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    Timestamp,
    type Unsubscribe,
} from 'firebase/firestore';
import type { TrendDefinition } from '../data/trendDefinitions';

// ── Types ───────────────────────────────────────────────────────────

export interface TrendGeneration {
    jobId: string;
    userId: string;
    trendId: string;
    trendTitle: string;
    trendType: 'image' | 'video';
    imageOutputPath: string;
    videoOutputPath?: string;
    imageUrl?: string;
    videoUrl?: string;
    status: 'pending' | 'complete' | 'error';
    errorMessage?: string;
    createdAt: Timestamp;
}

const COLLECTION = 'trendGenerations';

// ── Helpers ─────────────────────────────────────────────────────────

const generateJobId = (): string => {
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 9);
    return `trend-${ts}-${rand}`;
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const uploadImageToFirebase = async (
    base64DataUrl: string,
    storagePath: string
): Promise<string> => {
    const base64Data = base64DataUrl.split(',')[1];
    const mimeMatch = base64DataUrl.match(/data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
};

const dispatchJob = async (payload: Record<string, unknown>): Promise<{ success: boolean; error?: string }> => {
    try {
        const res = await fetch('/api/sqs/trend-photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Dispatch failed');
        return { success: true };
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: msg };
    }
};

// ── Submit (fire-and-forget) ────────────────────────────────────────

export const submitTrendJob = async (
    personFile: File,
    trend: TrendDefinition,
    userId: string,
): Promise<{ success: boolean; jobId?: string; error?: string }> => {
    const jobId = generateJobId();

    try {
        // 1. Upload person photo
        const personBase64 = await fileToBase64(personFile);
        const personImageUrl = await uploadImageToFirebase(
            personBase64,
            `TrendPhotos/uploads/${jobId}.png`
        );

        // 2. Prepare paths
        const imageOutputPath = `TrendPhotos/${jobId}.png`;
        const videoOutputPath = trend.videoPrompt ? `TrendPhotos/${jobId}-vid.mp4` : undefined;

        // 3. Create Firestore doc
        const genDoc: TrendGeneration = {
            jobId,
            userId,
            trendId: trend.id,
            trendTitle: trend.title,
            trendType: trend.type,
            imageOutputPath,
            videoOutputPath,
            status: 'pending',
            createdAt: Timestamp.now(),
        };
        await setDoc(doc(db, COLLECTION, jobId), genDoc);

        // 4. Dispatch image job
        const imgResult = await dispatchJob({
            jobId,
            masterPrompt: trend.imagePrompt,
            personImageUrl,
            outputPath: imageOutputPath,
            shotName: trend.title,
            userId,
        });
        if (!imgResult.success) throw new Error(imgResult.error);

        // 5. Dispatch video job (if applicable)
        if (trend.videoPrompt && videoOutputPath) {
            await dispatchJob({
                jobId: `${jobId}-vid`,
                masterPrompt: trend.videoPrompt,
                personImageUrl,
                outputPath: videoOutputPath,
                shotName: trend.title,
                userId,
                jobType: 'video',
                videoDuration: trend.videoDuration || 5,
            });
        }

        console.log(`✅ Trend job submitted: ${jobId}`);
        return { success: true, jobId };

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Trend job failed: ${msg}`);
        return { success: false, error: msg };
    }
};

// ── Real-time listener ──────────────────────────────────────────────

export const subscribeToGenerations = (
    userId: string,
    onUpdate: (generations: TrendGeneration[]) => void,
): Unsubscribe => {
    const q = query(
        collection(db, COLLECTION),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
    );

    return onSnapshot(q, (snapshot) => {
        const generations = snapshot.docs.map((d) => d.data() as TrendGeneration);
        onUpdate(generations);
    });
};

// ── Delete a generation ─────────────────────────────────────────────

export const deleteGeneration = async (jobId: string): Promise<void> => {
    await deleteDoc(doc(db, COLLECTION, jobId));
};
