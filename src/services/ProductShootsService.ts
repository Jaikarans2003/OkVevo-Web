/**
 * Product Shoots Service
 *
 * Orchestrates the full product-shoots pipeline:
 *  1. Photography Orchestrator generates 4 master prompts from product image + scenario
 *  2. Product image is uploaded to Firebase Storage
 *  3. Each shot is dispatched to the dedicated Product Shoots SQS queue
 *  4. Poll Firebase Storage for generated shot results
 */

import { storage, db } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL, listAll } from 'firebase/storage';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

// ── Types ───────────────────────────────────────────────────────────

export type ShootJobStatus = 'idle' | 'generating-prompts' | 'uploading' | 'dispatching' | 'polling' | 'complete' | 'error';

export interface ShootPhoto {
    shotIndex: number;
    shotName: string;
    masterPrompt: string;
    jobId: string;
    imageUrl?: string;
    status: 'pending' | 'dispatched' | 'polling' | 'complete' | 'error';
    error?: string;
}

export interface ShootPipelineResult {
    status: ShootJobStatus;
    photos: ShootPhoto[];
    error?: string;
}

export interface ProductShootsJob {
    jobId: string;
    userId: string;
    status: ShootJobStatus;
    masterPrompt: string;
    productImageUrl: string;
    outputUrl?: string;
    outputPath: string;
    shotName: string;
    resolution?: string;
    aspectRatio?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

const COLLECTION = 'productShootsJobs';

// ── Helpers ─────────────────────────────────────────────────────────

const generateShootJobId = (): string => {
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 9);
    return `shoot-${ts}-${rand}`;
};

/**
 * Convert a File to a base64 data-URL string
 */
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * Upload a base64 data-URL image to Firebase Storage.
 * Returns the download URL for the uploaded file.
 */
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
    const downloadUrl = await getDownloadURL(storageRef);

    console.log(`✅ Uploaded to Firebase: ${storagePath}`);
    return downloadUrl;
};

// ── Photography Prompt Generation ───────────────────────────────────

const generatePhotographyPrompts = async (
    productFile: File,
    shootScenario: string
): Promise<{ name: string; masterPrompt: string }[]> => {
    console.log('📸 Photography Orchestrator: Converting product image to base64...');
    const productImageBase64 = await fileToBase64(productFile);

    console.log('📸 Photography Orchestrator: Sending to API...');
    const response = await fetch('/api/product-shoots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productImageBase64, shootScenario }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Photography prompt generation failed');
    }

    console.log(`✅ Photography Orchestrator: ${data.shots.length} shot prompts received`);
    return data.shots;
};

// ── Dispatch a single shot ──────────────────────────────────────────

const dispatchShootJob = async (
    jobId: string,
    masterPrompt: string,
    productImageUrl: string,
    outputPath: string,
    shotName: string,
    resolution: string | undefined,
    aspectRatio: string | undefined,
    userId: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        // Require authentication
        if (!userId) {
            throw new Error('Authentication required. Please sign in to generate product shoots.');
        }

        // Create Firestore document for history tracking
        const jobDoc: ProductShootsJob = {
            jobId,
            userId,
            status: 'dispatching',
            masterPrompt,
            productImageUrl,
            outputPath,
            shotName,
            resolution,
            aspectRatio,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };
        await setDoc(doc(db, COLLECTION, jobId), jobDoc);
        console.log(`📝 Firestore doc created: ${COLLECTION}/${jobId}`);

        const res = await fetch('/api/sqs/product-shoots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobId,
                masterPrompt,
                productImageUrl,
                outputPath,
                shotName,
                resolution,
                aspectRatio,
                userId
            }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Failed to dispatch shoot job');
        }

        console.log(`📸 Shoot job dispatched: ${jobId} (${shotName})`);
        return { success: true };

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Shoot job dispatch failed:`, msg);
        return { success: false, error: msg };
    }
};

// ── Poll Firebase Storage for a single photo result ─────────────────

const pollForShootPhoto = async (
    outputPath: string,
    onProgress?: (elapsed: number) => void
): Promise<string> => {
    const MAX_ATTEMPTS = 40;    // 40 × 3s = 2 minutes max
    const INTERVAL_MS = 3000;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        await new Promise(r => setTimeout(r, INTERVAL_MS));

        try {
            const imageRef = ref(storage, outputPath);
            const url = await getDownloadURL(imageRef);
            console.log(`✅ Shoot photo found: ${outputPath}`);
            return url;
        } catch {
            // Not ready yet
        }

        const elapsed = ((i + 1) * INTERVAL_MS / 1000);
        onProgress?.(elapsed);
        console.log(`⏳ Shoot poll ${i + 1}/${MAX_ATTEMPTS}: ${outputPath} not ready...`);
    }

    throw new Error(`Shoot photo generation timed out for ${outputPath}`);
};

// ── Main Pipeline ───────────────────────────────────────────────────

export const runShootsPipeline = async (
    productFile: File,
    shootScenario: string,
    onStatusChange: (status: ShootJobStatus, detail?: string) => void,
    onPhotoUpdate: (photos: ShootPhoto[]) => void,
    resolution: string | undefined,
    aspectRatio: string | undefined,
    userId: string
): Promise<ShootPipelineResult> => {
    // Require authentication
    if (!userId) {
        return { status: 'error', photos: [], error: 'Authentication required. Please sign in to generate product shoots.' };
    }

    const baseJobId = generateShootJobId();

    try {
        // ── Step 1: Generate photography master prompts ──
        onStatusChange('generating-prompts', 'Analyzing product and generating photography prompts...');
        const shotPrompts = await generatePhotographyPrompts(productFile, shootScenario);

        // ── Step 2: Upload product image to Firebase ──
        onStatusChange('uploading', 'Uploading product image...');
        const productBase64 = await fileToBase64(productFile);
        const productImageUrl = await uploadImageToFirebase(
            productBase64,
            `ProductShoots/uploads/${baseJobId}.png`
        );

        // ── Step 3: Dispatch all shots to SQS ──
        onStatusChange('dispatching', 'Dispatching shots to generation queue...');
        const photos: ShootPhoto[] = shotPrompts.map((shot, idx) => ({
            shotIndex: idx,
            shotName: shot.name,
            masterPrompt: shot.masterPrompt,
            jobId: `${baseJobId}-shot-${idx}`,
            status: 'pending' as const,
        }));

        onPhotoUpdate([...photos]);

        for (const photo of photos) {
            const outputPath = `ProductShoots/${photo.jobId}.png`;
            const result = await dispatchShootJob(
                photo.jobId,
                photo.masterPrompt,
                productImageUrl,
                outputPath,
                photo.shotName,
                resolution,
                aspectRatio,
                userId
            );

            photo.status = result.success ? 'dispatched' : 'error';
            if (result.error) photo.error = result.error;
            onPhotoUpdate([...photos]);
        }

        // ── Step 4: Poll for all shot results concurrently ──
        onStatusChange('polling', 'Waiting for shots to generate...');

        const dispatched = photos.filter(p => p.status === 'dispatched');

        await Promise.allSettled(
            dispatched.map(async (photo) => {
                const outputPath = `ProductShoots/${photo.jobId}.png`;
                try {
                    photo.status = 'polling';
                    onPhotoUpdate([...photos]);

                    const imageUrl = await pollForShootPhoto(outputPath);
                    photo.imageUrl = imageUrl;
                    photo.status = 'complete';
                    onPhotoUpdate([...photos]);

                    // Update Firestore document with result
                    try {
                        await setDoc(doc(db, COLLECTION, photo.jobId), {
                            status: 'complete',
                            outputUrl: imageUrl,
                            updatedAt: Timestamp.now(),
                        }, { merge: true });
                    } catch (e) {
                        console.warn('Failed to update Firestore doc:', e);
                    }
                } catch (error) {
                    photo.status = 'error';
                    photo.error = error instanceof Error ? error.message : 'Polling failed';
                    onPhotoUpdate([...photos]);

                    // Update Firestore document with error
                    try {
                        await setDoc(doc(db, COLLECTION, photo.jobId), {
                            status: 'error',
                            error: photo.error,
                            updatedAt: Timestamp.now(),
                        }, { merge: true });
                    } catch (e) {
                        console.warn('Failed to update Firestore doc:', e);
                    }
                }
            })
        );

        const allComplete = photos.every(p => p.status === 'complete');
        onStatusChange(allComplete ? 'complete' : 'error', allComplete ? 'All shots generated!' : 'Some shots failed');

        return { status: allComplete ? 'complete' : 'error', photos };

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        onStatusChange('error', msg);
        return { status: 'error', photos: [], error: msg };
    }
};
