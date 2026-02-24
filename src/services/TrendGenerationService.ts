/**
 * Trend Generation Service
 *
 * Orchestrates a single-output trend pipeline:
 *  1. Upload user's person photo to Firebase Storage
 *  2. Dispatch ONE image generation job to SQS
 *  3. Poll for the generated image
 *  4. (If video trend) Dispatch ONE video generation job
 *  5. Poll for the generated video
 */

import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { TrendDefinition } from '../data/trendDefinitions';

// ── Types ───────────────────────────────────────────────────────────

export type TrendJobStatus =
    | 'idle'
    | 'uploading'
    | 'generating-image'
    | 'generating-video'
    | 'complete'
    | 'error';

export interface TrendPipelineResult {
    status: TrendJobStatus;
    imageUrl?: string;
    videoUrl?: string;
    error?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────

const generateTrendJobId = (): string => {
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
    const downloadUrl = await getDownloadURL(storageRef);

    console.log(`✅ Uploaded to Firebase: ${storagePath}`);
    return downloadUrl;
};

// ── Dispatch helpers ────────────────────────────────────────────────

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

// ── Poll Firebase for a result ──────────────────────────────────────

const pollForResult = async (outputPath: string): Promise<string> => {
    const MAX_ATTEMPTS = 60;
    const INTERVAL_MS = 3000;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        await new Promise(r => setTimeout(r, INTERVAL_MS));
        try {
            const resultRef = ref(storage, outputPath);
            return await getDownloadURL(resultRef);
        } catch {
            // Not ready yet
        }
    }
    throw new Error(`Generation timed out for ${outputPath}`);
};

// ── Main Pipeline ───────────────────────────────────────────────────

export const runTrendPipeline = async (
    personFile: File,
    trend: TrendDefinition,
    onStatusChange: (status: TrendJobStatus, detail?: string) => void,
): Promise<TrendPipelineResult> => {
    const jobId = generateTrendJobId();

    try {
        // ── Step 1: Upload person's photo ──
        onStatusChange('uploading', 'Uploading your photo...');
        const personBase64 = await fileToBase64(personFile);
        const personImageUrl = await uploadImageToFirebase(
            personBase64,
            `TrendPhotos/uploads/${jobId}.png`
        );

        // ── Step 2: Generate image ──
        onStatusChange('generating-image', 'Generating your image...');
        const imgOutputPath = `TrendPhotos/${jobId}.png`;
        const imgResult = await dispatchJob({
            jobId,
            masterPrompt: trend.imagePrompt,
            personImageUrl,
            outputPath: imgOutputPath,
            shotName: trend.title,
        });

        if (!imgResult.success) throw new Error(imgResult.error);

        const imageUrl = await pollForResult(imgOutputPath);

        // ── Step 3: Generate video (if applicable) ──
        let videoUrl: string | undefined;

        if (trend.videoPrompt) {
            onStatusChange('generating-video', 'Generating your video...');
            const vidJobId = `${jobId}-vid`;
            const vidOutputPath = `TrendPhotos/${vidJobId}.mp4`;

            const vidResult = await dispatchJob({
                jobId: vidJobId,
                masterPrompt: trend.videoPrompt,
                personImageUrl: imageUrl,
                outputPath: vidOutputPath,
                shotName: trend.title,
                jobType: 'video',
                videoDuration: trend.videoDuration || 5,
            });

            if (vidResult.success) {
                videoUrl = await pollForResult(vidOutputPath);
            }
        }

        // ── Done ──
        onStatusChange('complete', 'Done!');
        return { status: 'complete', imageUrl, videoUrl };

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        onStatusChange('error', msg);
        return { status: 'error', error: msg };
    }
};
