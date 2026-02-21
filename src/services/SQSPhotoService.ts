/**
 * SQS Director Photo Service
 *
 * Client-side service to dispatch Director shot photo generation jobs
 * to AWS SQS FIFO queue via /api/sqs/director-photos, and poll
 * Firebase Storage (DirectorPhotos/) for results.
 */

import { storage } from '../config/firebase';
import { ref, getDownloadURL, listAll } from 'firebase/storage';
import type { Scene } from './AIService';

// ── Types ───────────────────────────────────────────────────────────

export type PhotoJobStatus = 'pending' | 'dispatched' | 'polling' | 'complete' | 'error';

export interface GeneratedPhoto {
    jobId: string;
    sceneIndex: number;
    shotNumber: number;
    prompt: string;
    imageUrl?: string;
    status: PhotoJobStatus;
    error?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────

const generatePhotoJobId = (): string => {
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 9);
    return `dirphoto-${ts}-${rand}`;
};

// ── Dispatch a single shot ──────────────────────────────────────────

export const dispatchPhotoJob = async (
    shotPrompt: string,
    genre: string,
    sceneContext: string
): Promise<{ success: boolean; jobId: string; error?: string }> => {
    const jobId = generatePhotoJobId();

    // Build the master prompt with full context
    const masterPrompt = [
        `Generate a high-quality, cinematic photograph for this shot.`,
        `Style/Genre: ${genre}`,
        `Scene context: ${sceneContext}`,
        `Shot description: ${shotPrompt}`,
        `Create a photorealistic, detailed image that captures this moment cinematically.`,
    ].join('\n');

    try {
        const res = await fetch('/api/sqs/director-photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobId,
                masterPrompt,
                outputPath: `DirectorPhotos/${jobId}.png`,
            }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Failed to dispatch photo job');
        }

        console.log(`📸 Photo job dispatched: ${jobId}`);
        return { success: true, jobId };

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Photo job dispatch failed:`, msg);
        return { success: false, jobId, error: msg };
    }
};

// ── Dispatch all shots from all scenes ──────────────────────────────

export const dispatchAllShotPhotos = async (
    scenes: Scene[],
    genre: string,
    onPhotoDispatched?: (photo: GeneratedPhoto) => void
): Promise<GeneratedPhoto[]> => {
    const photos: GeneratedPhoto[] = [];

    for (let sceneIdx = 0; sceneIdx < scenes.length; sceneIdx++) {
        const scene = scenes[sceneIdx];
        const shots = scene.shots || [];

        for (const shot of shots) {
            const result = await dispatchPhotoJob(
                shot.description,
                genre,
                `Scene ${sceneIdx + 1}: ${scene.primary_visuals} | Mood: ${scene.emotional_tone}`
            );

            const photo: GeneratedPhoto = {
                jobId: result.jobId,
                sceneIndex: sceneIdx,
                shotNumber: shot.shot_number,
                prompt: shot.description,
                status: result.success ? 'dispatched' : 'error',
                error: result.error,
            };

            photos.push(photo);
            onPhotoDispatched?.(photo);
        }
    }

    return photos;
};

// ── Poll Firebase Storage for a single photo result ─────────────────

export const pollForPhoto = async (
    jobId: string,
    onProgress?: (elapsed: number) => void
): Promise<string> => {
    const MAX_ATTEMPTS = 40;    // 40 × 3s = 2 minutes max
    const INTERVAL_MS = 3000;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        await new Promise(r => setTimeout(r, INTERVAL_MS));

        try {
            const imageRef = ref(storage, `DirectorPhotos/${jobId}.png`);
            const url = await getDownloadURL(imageRef);
            console.log(`✅ Photo found: ${jobId}`);
            return url;
        } catch {
            // Not ready yet
        }

        // Also check for alternate extensions
        try {
            const folderRef = ref(storage, 'DirectorPhotos/');
            const result = await listAll(folderRef);
            const match = result.items.find(item => item.name.startsWith(jobId));
            if (match) {
                const url = await getDownloadURL(match);
                console.log(`✅ Photo found (alt): ${jobId}`);
                return url;
            }
        } catch {
            // Folder may not exist yet
        }

        const elapsed = ((i + 1) * INTERVAL_MS / 1000);
        onProgress?.(elapsed);
        console.log(`⏳ Photo poll ${i + 1}/${MAX_ATTEMPTS}: ${jobId} not ready...`);
    }

    throw new Error(`Photo generation timed out for job ${jobId}`);
};

// ── Poll all photos concurrently ────────────────────────────────────

export const pollAllPhotos = async (
    photos: GeneratedPhoto[],
    onPhotoComplete: (photo: GeneratedPhoto) => void
): Promise<GeneratedPhoto[]> => {
    const dispatched = photos.filter(p => p.status === 'dispatched');

    const results = await Promise.allSettled(
        dispatched.map(async (photo) => {
            try {
                const imageUrl = await pollForPhoto(photo.jobId);
                const completed: GeneratedPhoto = {
                    ...photo,
                    imageUrl,
                    status: 'complete',
                };
                onPhotoComplete(completed);
                return completed;
            } catch (error) {
                const failed: GeneratedPhoto = {
                    ...photo,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Polling failed',
                };
                onPhotoComplete(failed);
                return failed;
            }
        })
    );

    return results.map((r, i) =>
        r.status === 'fulfilled' ? r.value : { ...dispatched[i], status: 'error' as const, error: 'Promise rejected' }
    );
};
