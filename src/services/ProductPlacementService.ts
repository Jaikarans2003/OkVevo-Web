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
import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL, listAll } from 'firebase/storage';

export type PlacementJobStatus = 'idle' | 'analyzing' | 'refining' | 'uploading' | 'compositing' | 'polling' | 'complete' | 'error';

export interface PlacementJobResult {
    status: PlacementJobStatus;
    masterPrompt?: string;
    compositeImageUrl?: string;
    error?: string;
}

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
    userId: string = 'demo-user',
    resolution?: string,
    aspectRatio?: string
): Promise<void> => {
    const res = await fetch('/api/product-placement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jobId,
            masterPrompt,
            heroImageUrl,
            sceneImageUrl,
            userId,
            resolution,
            aspectRatio
        }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to dispatch compositing job to SQS');
    }

    console.log('📦 Job dispatched to SQS:', data);
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
        console.log(`⏳ Poll attempt ${i + 1}/${MAX_ATTEMPTS}: No result yet...`);
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
    userPrompt?: string,
    resolution?: string,
    aspectRatio?: string
): Promise<PlacementJobResult> => {
    const jobId = generatePlacementJobId();

    try {
        // ── Step 1: Vision Orchestrator ──────────────────────────
        onStatusChange('analyzing', 'Analyzing hero product & scene lighting...');

        const orchestratorResult = await analyzeProductAndScene(heroFile, sceneFile, userPrompt);

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

        console.log('📤 Reference images uploaded:', { heroImageUrl, sceneImageUrl });

        // ── Step 3: Dispatch job to SQS ─────────────────────────
        onStatusChange('compositing', 'Dispatching composite render job...');

        await dispatchToSQS(jobId, masterPrompt, heroImageUrl, sceneImageUrl, 'demo-user', resolution, aspectRatio);

        // ── Step 4: Poll for the result ─────────────────────────
        onStatusChange('polling', 'Waiting for NANOBANANA PRO render...');

        const compositeImageUrl = await pollForCompositeImage(jobId, onStatusChange);

        onStatusChange('complete');
        return {
            status: 'complete',
            masterPrompt,
            compositeImageUrl,
        };

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        onStatusChange('error', msg);
        return { status: 'error', error: msg };
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
    onStatusChange: (status: PlacementJobStatus, detail?: string) => void
): Promise<PlacementJobResult> => {
    const jobId = generatePlacementJobId();

    try {
        // ── Step 1: Vision Orchestrator (Refinement Mode) ────────
        onStatusChange('refining', 'Analyzing current image & generating refined prompt...');

        const orchestratorResult = await refineComposition(compositeImageUrl, refinementPrompt);

        if (!orchestratorResult.success || !orchestratorResult.masterPrompt) {
            throw new Error(orchestratorResult.error || 'Failed to generate refined master prompt');
        }

        const masterPrompt = orchestratorResult.masterPrompt;

        // ── Step 2: Dispatch to SQS (prompt-only) ───────────────
        onStatusChange('compositing', 'Dispatching refined render job...');

        // No reference images for refinement — the prompt is self-contained
        await dispatchToSQS(jobId, masterPrompt, '', '');

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
    }
};
