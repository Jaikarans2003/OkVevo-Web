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
import { checkRateLimit } from './RateLimitService';
import { checkCredits, deductCredits } from './CreditsService';

// ── Types ───────────────────────────────────────────────────────────

export type ShootJobStatus = 'idle' | 'generating-prompts' | 'uploading' | 'dispatching' | 'queued' | 'complete' | 'error';

export interface ShootPhoto {
    shotIndex: number;
    shotName: string;
    masterPrompt: string;
    jobId: string;
    imageUrl?: string;
    status: 'pending' | 'dispatched' | 'polling' | 'queued' | 'complete' | 'error';
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

// Track active generations per user to prevent multiple simultaneous generations
const activeGenerations = new Set<string>();

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
    const MAX_ATTEMPTS = 60;    // 60 × 5s = 5 minutes max
    const INTERVAL_MS = 5000;

    // Construct public URL directly (Lambda makes files public)
    const bucketName = 'text2video-16cbf.firebasestorage.app';
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${outputPath}`;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        await new Promise(r => setTimeout(r, INTERVAL_MS));

        try {
            // Try to fetch the image directly to verify it exists
            const response = await fetch(publicUrl, { method: 'HEAD', mode: 'no-cors' });
            // If no exception thrown and we get here, file likely exists
            console.log(`✅ Shoot photo found: ${outputPath}`);
            return publicUrl;
        } catch {
            // Not ready yet or network error
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

    // Check if user already has an active generation
    if (activeGenerations.has(userId)) {
        return { 
            status: 'error', 
            photos: [], 
            error: 'You already have an active product shoot generation in progress. Please wait for it to complete before starting a new one.' 
        };
    }

    // Mark user as having an active generation
    activeGenerations.add(userId);

    try {
        // Check rate limit
        const rateLimitResult = await checkRateLimit(userId, 'PRODUCT_SHOOTS');
        if (!rateLimitResult.allowed) {
            return { 
                status: 'error', 
                photos: [], 
                error: rateLimitResult.error || 'Rate limit exceeded. Please try again later.' 
            };
        }

        // Check credits (50 credits per shot, 4 shots = 200 total)
        const creditCheck = await checkCredits(userId, 'PRODUCT_SHOOTS');
        if (!creditCheck.allowed) {
            return { 
                status: 'error', 
                photos: [], 
                error: creditCheck.error || 'Insufficient credits. Please upgrade your plan.' 
            };
        }

        const baseJobId = generateShootJobId();

        // Deduct credits for 4 shots (50 each = 200 total)
        try {
            await deductCredits(userId, 200, 'PRODUCT_SHOOTS', baseJobId, 'Product shoots generation (4 shots)');
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to deduct credits';
            return { status: 'error', photos: [], error: msg };
        }

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

        // ── Step 4: Background Polling for results (Fire & Forget) ──
        onStatusChange('queued', 'All shots queued! Check History for results.');
        
        photos.forEach(async (photo) => {
            if (photo.status !== 'dispatched') return;
            
            try {
                // Shift to polling state for UI feedback
                photo.status = 'polling';
                onPhotoUpdate([...photos]);
                
                const outputPath = `ProductShoots/${photo.jobId}.png`;
                const imageUrl = await pollForShootPhoto(outputPath);
                
                photo.status = 'complete';
                photo.imageUrl = imageUrl;
                onPhotoUpdate([...photos]);
            } catch (error) {
                console.error(`Error polling for photo ${photo.jobId}:`, error);
                photo.status = 'error';
                photo.error = error instanceof Error ? error.message : 'Generation timed out';
                onPhotoUpdate([...photos]);
            }
        });

        // Return immediately - don't wait for generation
        const allDispatched = photos.every(p => p.status === 'dispatched' || p.status === 'polling' || p.status === 'complete');
        return { status: allDispatched ? 'queued' : 'error', photos };

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        onStatusChange('error', msg);
        return { status: 'error', photos: [], error: msg };
    } finally {
        // Remove user from active generations when done (success or error)
        activeGenerations.delete(userId);
    }
};
