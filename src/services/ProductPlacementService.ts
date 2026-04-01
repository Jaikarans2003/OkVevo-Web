/**
 * Product Placement Service
 *
 * Orchestrates the full product-placement pipeline:
 *  1. Vision Orchestrator generates a master prompt from hero + scene images
 *  2. Hero & scene images are uploaded to Firebase Storage
 *  3. Job is dispatched to SQS FIFO queue via /api/product-placement
 *  4. Lambda consumes the job, calls NANOBANANA PRO, uploads result
 *  5. Frontend polls Firebase Storage for the composite image
 */

import { analyzeProductAndScene, refineComposition, fileToBase64 } from './VisionOrchestratorService';
import { storage, db, auth } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL, listAll } from 'firebase/storage';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { checkRateLimit } from './RateLimitService';
import { checkCredits, deductCredits } from './CreditsService';

export type PlacementJobStatus = 'idle' | 'analyzing' | 'refining' | 'uploading' | 'compositing' | 'polling' | 'complete' | 'error';

export interface PlacementJobResult {
    status: PlacementJobStatus;
    masterPrompt?: string;
    compositeImageUrl?: string;
    error?: string;
}

export interface PlacementJob {
    jobId: string;
    userId: string;
    status: PlacementJobStatus;
    masterPrompt: string;
    heroImageUrl?: string;
    sceneImageUrl?: string;
    outputUrl?: string;
    resolution?: string;
    aspectRatio?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

const COLLECTION = 'placementJobs';

// Track active generations per user to prevent multiple simultaneous generations
const activeGenerations = new Set<string>();

/**
 * Generate a unique placement job ID
 */
const generatePlacementJobId = (): string => {
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 9);
    return `placement-${ts}-${rand}`;
};

/**
 * Upload a base64 data-URL image to Firebase Storage.
 * Returns the download URL for the uploaded file.
 */
const uploadImageToFirebase = async (
    base64DataUrl: string,
    storagePath: string
): Promise<string> => {
    // Strip the data URL prefix to get raw base64
    const base64Data = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // Detect mime type from the data URL
    const mimeMatch = base64DataUrl.match(/^data:(image\/\w+);base64,/);
    const contentType = mimeMatch ? mimeMatch[1] : 'image/png';

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, bytes, { contentType });
    return await getDownloadURL(storageRef);
};

/**
 * Dispatch a placement job to SQS via the backend API route.
 */
const dispatchToSQS = async (
    jobId: string,
    masterPrompt: string,
    heroImageUrl: string,
    sceneImageUrl: string,
    authToken: string,
    resolution: string | undefined,
    aspectRatio: string | undefined
): Promise<void> => {
    // Create Firestore document for history tracking
    const userId = (await auth.currentUser)?.uid;
    if (!userId) {
        throw new Error('Authentication required. Please sign in to generate product placements.');
    }

    const jobDoc: PlacementJob = {
        jobId,
        userId,
        status: 'compositing',
        masterPrompt,
        heroImageUrl: heroImageUrl || undefined,
        sceneImageUrl: sceneImageUrl || undefined,
        resolution,
        aspectRatio,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    };
    await setDoc(doc(db, COLLECTION, jobId), jobDoc);

    const res = await fetch('/api/product-placement', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
            jobId,
            masterPrompt,
            heroImageUrl,
            sceneImageUrl,
            resolution,
            aspectRatio
        }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to dispatch compositing job to SQS');
    }
};

/**
 * Poll Firebase Storage for the composite image result.
 * The Lambda uploads to ProductPlacement/{jobId}.png
 */
const pollForCompositeImage = async (
    jobId: string,
    onStatusChange: (status: PlacementJobStatus, detail?: string) => void
): Promise<string> => {
    const MAX_ATTEMPTS = 40;     // 40 × 3s = 2 minutes max
    const INTERVAL_MS = 3000;    // Poll every 3 seconds

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        await new Promise(r => setTimeout(r, INTERVAL_MS));

        try {
            // Check for the specific job output file
            const imageRef = ref(storage, `ProductPlacement/${jobId}.png`);
            const url = await getDownloadURL(imageRef);

            console.log('✅ Composite image found:', url);
            return url;
        } catch {
            // File doesn't exist yet — keep polling
        }

        // Also check the folder for any file starting with the jobId
        // (in case the Lambda uses a different extension)
        try {
            const folderRef = ref(storage, 'ProductPlacement/');
            const result = await listAll(folderRef);
            const match = result.items.find(item => item.name.startsWith(jobId));

            if (match) {
                const url = await getDownloadURL(match);
                console.log('✅ Composite image found (alt):', url);
                return url;
            }
        } catch {
            // Folder might not exist yet
        }

        const elapsed = ((i + 1) * INTERVAL_MS / 1000).toFixed(0);
        onStatusChange('polling', `Waiting for NANOBANANA PRO render... (${elapsed}s)`);
    }

    throw new Error('Composite image generation timed out. The image may appear in your gallery later.');
};

/**
 * Run the full placement pipeline.
 *
 * Steps:
 *  1. Vision Orchestrator → master prompt
 *  2. Upload hero + scene to Firebase Storage
 *  3. Dispatch to SQS
 *  4. Poll for result
 */
export const runPlacementPipeline = async (
    heroFile: File,
    sceneFile: File,
    onStatusChange: (status: PlacementJobStatus, detail?: string) => void,
    userPrompt: string | undefined,
    resolution: string | undefined,
    aspectRatio: string | undefined,
    userId: string,
    authToken: string
): Promise<PlacementJobResult> => {
    // Require authentication
    if (!userId || !authToken) {
        return { status: 'error', error: 'Authentication required. Please sign in to generate product placements.' };
    }

    // Check if user already has an active generation
    if (activeGenerations.has(userId)) {
        return { 
            status: 'error', 
            error: 'You already have an active product placement generation in progress. Please wait for it to complete before starting a new one.' 
        };
    }

    // Mark user as having an active generation
    activeGenerations.add(userId);

    const jobId = generatePlacementJobId();

    try {
        // Check rate limit
        const rateLimitResult = await checkRateLimit(userId, 'PRODUCT_PLACEMENT');
        if (!rateLimitResult.allowed) {
            return { 
                status: 'error', 
                error: rateLimitResult.error || 'Rate limit exceeded. Please try again later.' 
            };
        }

        // Check credits (30 for Product Placement)
        const creditCheck = await checkCredits(userId, 'PRODUCT_PLACEMENT');
        if (!creditCheck.allowed) {
            return { status: 'error', error: creditCheck.error || 'Insufficient credits. Please upgrade your plan.' };
        }

        // Deduct credits
        try {
            await deductCredits(userId, 30, 'PRODUCT_PLACEMENT', jobId, 'Product placement generation');
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to deduct credits';
            return { status: 'error', error: msg };
        }

        // ── Step 1: Vision Orchestrator ──────────────────────────
        onStatusChange('analyzing', 'Analyzing hero product & scene lighting...');

        const orchestratorResult = await analyzeProductAndScene(heroFile, sceneFile, authToken, userPrompt);

        if (!orchestratorResult.success || !orchestratorResult.masterPrompt) {
            throw new Error(orchestratorResult.error || 'Failed to generate master prompt');
        }

        const masterPrompt = orchestratorResult.masterPrompt;

        // ── Step 2: Upload reference images to Firebase ─────────
        onStatusChange('uploading', 'Uploading reference images...');

        const [heroBase64, sceneBase64] = await Promise.all([
            fileToBase64(heroFile),
            fileToBase64(sceneFile),
        ]);

        const [heroImageUrl, sceneImageUrl] = await Promise.all([
            uploadImageToFirebase(heroBase64, `ProductPlacement/inputs/${jobId}/hero.png`),
            uploadImageToFirebase(sceneBase64, `ProductPlacement/inputs/${jobId}/scene.png`),
        ]);

        // ── Step 3: Dispatch job to SQS ─────────────────────────
        onStatusChange('compositing', 'Dispatching composite render job...');

        await dispatchToSQS(jobId, masterPrompt, heroImageUrl, sceneImageUrl, authToken, resolution, aspectRatio);

        // ── Step 4: Poll for the result ─────────────────────────
        onStatusChange('polling', 'Waiting for NANOBANANA PRO render...');

        const compositeImageUrl = await pollForCompositeImage(jobId, onStatusChange);

        // Update Firestore document with result
        try {
            await setDoc(doc(db, COLLECTION, jobId), {
                status: 'complete',
                outputUrl: compositeImageUrl,
                updatedAt: Timestamp.now(),
            }, { merge: true });
        } catch (e) {
            console.warn('Failed to update Firestore doc:', e);
        }

        onStatusChange('complete');
        return {
            status: 'complete',
            masterPrompt,
            compositeImageUrl,
        };

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        onStatusChange('error', msg);
        
        // Update Firestore document with error
        try {
            await setDoc(doc(db, COLLECTION, jobId), {
                status: 'error',
                error: msg,
                updatedAt: Timestamp.now(),
            }, { merge: true });
        } catch (e) {
            console.warn('Failed to update Firestore doc:', e);
        }
        
        return { status: 'error', error: msg };
    } finally {
        // Remove user from active generations when done
        activeGenerations.delete(userId);
    }
};

/**
 * Run the refinement pipeline.
 *
 * Steps:
 *  1. Vision Orchestrator (refinement mode) → refined master prompt
 *  2. Dispatch to SQS (no reference images — prompt-only generation)
 *  3. Poll for result
 */
export const runRefinementPipeline = async (
    compositeImageUrl: string,
    refinementPrompt: string,
    onStatusChange: (status: PlacementJobStatus, detail?: string) => void,
    userId: string,
    authToken: string
): Promise<PlacementJobResult> => {
    // Require authentication
    if (!userId || !authToken) {
        return { status: 'error', error: 'Authentication required. Please sign in to refine compositions.' };
    }

    // Check if user already has an active generation
    if (activeGenerations.has(userId)) {
        return { 
            status: 'error', 
            error: 'You already have an active product placement generation in progress. Please wait for it to complete before starting a new one.' 
        };
    }

    // Mark user as having an active generation
    activeGenerations.add(userId);

    const jobId = generatePlacementJobId();

    try {
        // ── Step 1: Vision Orchestrator (Refinement Mode) ────────
        onStatusChange('refining', 'Analyzing current image & generating refined prompt...');

        const orchestratorResult = await refineComposition(compositeImageUrl, refinementPrompt, authToken);

        if (!orchestratorResult.success || !orchestratorResult.masterPrompt) {
            throw new Error(orchestratorResult.error || 'Failed to generate refined master prompt');
        }

        const masterPrompt = orchestratorResult.masterPrompt;

        // ── Step 2: Dispatch to SQS (prompt-only) ───────────────
        onStatusChange('compositing', 'Dispatching refined render job...');

        // No reference images for refinement — the prompt is self-contained
        await dispatchToSQS(jobId, masterPrompt, '', '', authToken, undefined, undefined);

        // ── Step 3: Poll for the result ─────────────────────────
        onStatusChange('polling', 'Waiting for NANOBANANA PRO render...');

        const newCompositeUrl = await pollForCompositeImage(jobId, onStatusChange);

        onStatusChange('complete');
        return {
            status: 'complete',
            masterPrompt,
            compositeImageUrl: newCompositeUrl,
        };

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        onStatusChange('error', msg);
        return { status: 'error', error: msg };
    } finally {
        // Remove user from active generations when done
        activeGenerations.delete(userId);
    }
};
