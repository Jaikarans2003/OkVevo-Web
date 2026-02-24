/**
 * Trend Generation Service
 *
 * Orchestrates the full trend generation pipeline:
 *  1. Upload user's person photo to Firebase Storage
 *  2. Dispatch each image prompt to the dedicated SQS queue
 *  3. Poll Firebase Storage for generated image results
 *  4. Dispatch video generation jobs (Kling) using generated images
 *  5. Poll for video results
 */

import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { TrendDefinition } from '../data/trendDefinitions';

// ── Types ───────────────────────────────────────────────────────────

export type TrendJobStatus =
    | 'idle'
    | 'uploading'
    | 'generating-images'
    | 'generating-videos'
    | 'complete'
    | 'error';

export interface TrendGeneratedItem {
    index: number;
    name: string;
    prompt: string;
    jobId: string;
    type: 'image' | 'video';
    url?: string;
    status: 'pending' | 'dispatched' | 'polling' | 'complete' | 'error';
    error?: string;
}

export interface TrendPipelineResult {
    status: TrendJobStatus;
    images: TrendGeneratedItem[];
    videos: TrendGeneratedItem[];
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

// ── Dispatch a single trend photo job ───────────────────────────────

const dispatchTrendPhotoJob = async (
    jobId: string,
    masterPrompt: string,
    personImageUrl: string,
    outputPath: string,
    shotName: string,
    generateVideo: boolean = false,
    videoPrompt: string = ''
): Promise<{ success: boolean; error?: string }> => {
    try {
        const res = await fetch('/api/sqs/trend-photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobId,
                masterPrompt,
                personImageUrl,
                outputPath,
                shotName,
                generateVideo,
                videoPrompt,
            }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Failed to dispatch trend photo job');
        }

        console.log(`🎬 Trend job dispatched: ${jobId} (${shotName})`);
        return { success: true };

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Trend job dispatch failed:`, msg);
        return { success: false, error: msg };
    }
};

// ── Dispatch a Kling video generation job ───────────────────────────

const dispatchTrendVideoJob = async (
    jobId: string,
    videoPrompt: string,
    sourceImageUrl: string,
    outputPath: string,
    shotName: string,
    duration: number = 5
): Promise<{ success: boolean; error?: string }> => {
    try {
        const res = await fetch('/api/sqs/trend-photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobId,
                masterPrompt: videoPrompt,
                personImageUrl: sourceImageUrl,
                outputPath,
                shotName,
                jobType: 'video',
                videoDuration: duration,
            }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Failed to dispatch trend video job');
        }

        console.log(`🎥 Trend video job dispatched: ${jobId} (${shotName})`);
        return { success: true };

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Trend video job dispatch failed:`, msg);
        return { success: false, error: msg };
    }
};

// ── Poll Firebase Storage for a single result ───────────────────────

const pollForResult = async (
    outputPath: string,
    onProgress?: (elapsed: number) => void
): Promise<string> => {
    const MAX_ATTEMPTS = 60;    // 60 × 3s = 3 minutes max
    const INTERVAL_MS = 3000;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        await new Promise(r => setTimeout(r, INTERVAL_MS));

        try {
            const resultRef = ref(storage, outputPath);
            const url = await getDownloadURL(resultRef);
            console.log(`✅ Result found: ${outputPath}`);
            return url;
        } catch {
            // Not ready yet
        }

        const elapsed = ((i + 1) * INTERVAL_MS / 1000);
        onProgress?.(elapsed);
        console.log(`⏳ Trend poll ${i + 1}/${MAX_ATTEMPTS}: ${outputPath} not ready...`);
    }

    throw new Error(`Trend generation timed out for ${outputPath}`);
};

// ── Main Pipeline ───────────────────────────────────────────────────

export const runTrendPipeline = async (
    personFile: File,
    trend: TrendDefinition,
    onStatusChange: (status: TrendJobStatus, detail?: string) => void,
    onImageUpdate: (images: TrendGeneratedItem[]) => void,
    onVideoUpdate: (videos: TrendGeneratedItem[]) => void
): Promise<TrendPipelineResult> => {
    const baseJobId = generateTrendJobId();

    try {
        // ── Step 1: Upload person's photo to Firebase ──
        onStatusChange('uploading', 'Uploading your photo...');
        const personBase64 = await fileToBase64(personFile);
        const personImageUrl = await uploadImageToFirebase(
            personBase64,
            `TrendPhotos/uploads/${baseJobId}.png`
        );

        // ── Step 2: Dispatch all image prompts to SQS ──
        onStatusChange('generating-images', 'Dispatching image generation jobs...');
        const images: TrendGeneratedItem[] = trend.imagePrompts.map((prompt, idx) => ({
            index: idx,
            name: prompt.name,
            prompt: prompt.prompt,
            jobId: `${baseJobId}-img-${idx}`,
            type: 'image' as const,
            status: 'pending' as const,
        }));

        onImageUpdate([...images]);

        for (const img of images) {
            const outputPath = `TrendPhotos/${img.jobId}.png`;
            const result = await dispatchTrendPhotoJob(
                img.jobId,
                img.prompt,
                personImageUrl,
                outputPath,
                img.name
            );

            img.status = result.success ? 'dispatched' : 'error';
            if (result.error) img.error = result.error;
            onImageUpdate([...images]);
        }

        // ── Step 3: Poll for all image results concurrently ──
        const dispatchedImages = images.filter(i => i.status === 'dispatched');

        await Promise.allSettled(
            dispatchedImages.map(async (img, idx) => {
                const outputPath = `TrendPhotos/${img.jobId}.png`;
                try {
                    img.status = 'polling';
                    onStatusChange('generating-images', `Generating ${img.name} (${idx + 1}/${dispatchedImages.length})...`);
                    onImageUpdate([...images]);

                    const imageUrl = await pollForResult(outputPath);
                    img.url = imageUrl;
                    img.status = 'complete';
                    onImageUpdate([...images]);
                } catch (error) {
                    img.status = 'error';
                    img.error = error instanceof Error ? error.message : 'Polling failed';
                    onImageUpdate([...images]);
                }
            })
        );

        // ── Step 4: Dispatch video generation jobs (if any) ──
        const videos: TrendGeneratedItem[] = [];

        if (trend.videoPrompts.length > 0) {
            onStatusChange('generating-videos', 'Starting video generation...');

            for (let vIdx = 0; vIdx < trend.videoPrompts.length; vIdx++) {
                const vp = trend.videoPrompts[vIdx];
                const sourceImage = images[vp.sourceImageIndex];

                // Only generate video if the source image was successfully generated
                if (sourceImage?.status === 'complete' && sourceImage.url) {
                    const videoItem: TrendGeneratedItem = {
                        index: vIdx,
                        name: vp.name,
                        prompt: vp.prompt,
                        jobId: `${baseJobId}-vid-${vIdx}`,
                        type: 'video',
                        status: 'pending',
                    };
                    videos.push(videoItem);
                }
            }

            onVideoUpdate([...videos]);

            for (const vid of videos) {
                const vp = trend.videoPrompts[vid.index];
                const sourceImage = images[vp.sourceImageIndex];
                const outputPath = `TrendPhotos/${vid.jobId}.mp4`;

                const result = await dispatchTrendVideoJob(
                    vid.jobId,
                    vid.prompt,
                    sourceImage.url!,
                    outputPath,
                    vid.name,
                    vp.duration
                );

                vid.status = result.success ? 'dispatched' : 'error';
                if (result.error) vid.error = result.error;
                onVideoUpdate([...videos]);
            }

            // ── Step 5: Poll for video results ──
            const dispatchedVideos = videos.filter(v => v.status === 'dispatched');

            await Promise.allSettled(
                dispatchedVideos.map(async (vid, idx) => {
                    const outputPath = `TrendPhotos/${vid.jobId}.mp4`;
                    try {
                        vid.status = 'polling';
                        onStatusChange('generating-videos', `Generating ${vid.name} (${idx + 1}/${dispatchedVideos.length})...`);
                        onVideoUpdate([...videos]);

                        const videoUrl = await pollForResult(outputPath);
                        vid.url = videoUrl;
                        vid.status = 'complete';
                        onVideoUpdate([...videos]);
                    } catch (error) {
                        vid.status = 'error';
                        vid.error = error instanceof Error ? error.message : 'Video polling failed';
                        onVideoUpdate([...videos]);
                    }
                })
            );
        }

        // ── Done ──
        const allImagesOk = images.every(i => i.status === 'complete');
        const allVideosOk = videos.length === 0 || videos.every(v => v.status === 'complete');
        const finalStatus = (allImagesOk && allVideosOk) ? 'complete' : 'error';

        onStatusChange(
            finalStatus,
            finalStatus === 'complete'
                ? `All ${images.length} images${videos.length > 0 ? ` and ${videos.length} videos` : ''} generated!`
                : 'Some generations failed'
        );

        return { status: finalStatus, images, videos };

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        onStatusChange('error', msg);
        return { status: 'error', images: [], videos: [], error: msg };
    }
};
