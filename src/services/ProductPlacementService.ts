/**
 * Product Placement Service
 *
 * Orchestrates the full product-placement pipeline:
 *  1. Calls Vision Orchestrator (Gemini) to generate a master prompt
 *  2. Dispatches a compositing job to SQS FIFO via the backend API
 *  3. Polls Firebase Storage (MockAIGeneratedPhotos/) for the result image
 */

import { analyzeProductAndScene, refineComposition } from './VisionOrchestratorService';
import { storage } from '../config/firebase';
import { ref, getDownloadURL, listAll } from 'firebase/storage';

export type PlacementJobStatus = 'idle' | 'analyzing' | 'refining' | 'compositing' | 'polling' | 'complete' | 'error';

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
 * Run the full placement pipeline.
 * Accepts two image Files, an onStatusChange callback for live UI updates,
 * and returns the final result.
 */
export const runPlacementPipeline = async (
    heroFile: File,
    sceneFile: File,
    onStatusChange: (status: PlacementJobStatus, detail?: string) => void,
    userPrompt?: string
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

        // ── Step 2: Dispatch compositing job to SQS FIFO ─────────
        onStatusChange('compositing', 'Dispatching composite render job to queue...');

        const dispatchRes = await fetch('/api/product-placement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobId,
                masterPrompt,
                userId: 'demo-user', // In production this would come from auth
            }),
        });

        const dispatchData = await dispatchRes.json();

        if (!dispatchRes.ok || !dispatchData.success) {
            throw new Error(dispatchData.error || 'Failed to dispatch compositing job');
        }

        console.log('📦 Job dispatched:', dispatchData);

        // ── Step 3: Poll Firebase Storage for the result ─────────
        onStatusChange('polling', 'Waiting for composite image from render pipeline...');

        const imageUrl = await pollForCompositeImage(jobId);

        onStatusChange('complete');
        return {
            status: 'complete',
            masterPrompt,
            compositeImageUrl: imageUrl,
        };

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        onStatusChange('error', msg);
        return { status: 'error', error: msg };
    }
};

/**
 * Poll Firebase Storage for the finished composite image.
 *
 * Checks the `MockAIGeneratedPhotos/` folder in Firebase Storage.
 * In production, the Lambda consumer would write the real composite
 * to a dedicated folder; for now we fetch the mock image.
 */
const pollForCompositeImage = async (_jobId: string): Promise<string> => {
    const MAX_ATTEMPTS = 20;
    const INTERVAL_MS = 3000;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        await new Promise(r => setTimeout(r, INTERVAL_MS));

        try {
            // Poll the MockAIGeneratedPhotos folder
            const folderRef = ref(storage, 'MockAIGeneratedPhotos/');
            const res = await listAll(folderRef);

            if (res.items.length > 0) {
                // Return the first available image (mock flow)
                const url = await getDownloadURL(res.items[0]);
                console.log('✅ Composite image found in MockAIGeneratedPhotos:', url);
                return url;
            }

            console.log(`⏳ Poll attempt ${i + 1}/${MAX_ATTEMPTS}: No image yet...`);
        } catch (err) {
            console.warn('Polling error (non-fatal):', err);
        }
    }

    throw new Error('Composite image timed out. Please check your gallery later.');
};

/**
 * Run the refinement pipeline.
 * Takes the current composite image URL + user's change request,
 * generates a new master prompt, dispatches to SQS, and polls for the result.
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

        // ── Step 2: Dispatch compositing job to SQS FIFO ─────────
        onStatusChange('compositing', 'Dispatching refined composite render job...');

        const dispatchRes = await fetch('/api/product-placement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobId,
                masterPrompt,
                userId: 'demo-user',
            }),
        });

        const dispatchData = await dispatchRes.json();

        if (!dispatchRes.ok || !dispatchData.success) {
            throw new Error(dispatchData.error || 'Failed to dispatch refinement job');
        }

        console.log('📦 Refinement job dispatched:', dispatchData);

        // ── Step 3: Poll Firebase Storage for the result ─────────
        onStatusChange('polling', 'Waiting for refined composite image...');

        const imageUrl = await pollForCompositeImage(jobId);

        onStatusChange('complete');
        return {
            status: 'complete',
            masterPrompt,
            compositeImageUrl: imageUrl,
        };

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        onStatusChange('error', msg);
        return { status: 'error', error: msg };
    }
};
