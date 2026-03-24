/**
 * AI Influencer Service
 *
 * Client-side service for dispatching AI Influencer jobs and polling for results.
 */

import { db } from '../config/firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { checkRateLimit } from './RateLimitService';
import { checkCredits, deductCredits } from './CreditsService';

export interface AIInfluencerJobRequest {
    jobId: string;
    userId: string;
    topic: string;
    script?: string;
    duration: 15 | 30 | 60;
    gender: 'male' | 'female';
    photoUrl?: string;
    avatarUrl: string;
    ttsPacing?: 'calm' | 'fast';
}

export interface AIInfluencerJobResponse {
    success: boolean;
    jobId: string;
    messageId?: string;
    message?: string;
    mock?: boolean;
    error?: string;
}

export interface AIInfluencerJobStatus {
    jobId: string;
    status: 'pending' | 'generating-script' | 'generating-audio' | 'generating-lipsync' | 'complete' | 'error';
    topic: string;
    duration: number;
    gender: string;
    ttsPacing?: 'calm' | 'fast';
    generatedScript?: string;
    audioUrl?: string;
    lipsyncVideoUrl?: string;
    finalVideoUrl?: string;
    errorMessage?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface AIInfluencerJob {
    jobId: string;
    userId: string;
    status: 'pending' | 'generating-script' | 'generating-audio' | 'generating-lipsync' | 'complete' | 'error';
    topic: string;
    duration: number;
    gender: 'male' | 'female';
    script?: string;
    avatarUrl: string;
    photoUrl?: string;
    ttsPacing?: 'calm' | 'fast';
    finalVideoUrl?: string;
    errorMessage?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

const COLLECTION = 'aiInfluencerJobs';

// Track active generations per user to prevent multiple simultaneous generations
const activeGenerations = new Set<string>();

/**
 * Generate a unique job ID
 */
export const generateJobId = (): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `ai-influencer-${timestamp}-${random}`;
};

/**
 * Dispatch an AI Influencer video generation job to SQS
 */
export const dispatchAIInfluencerJob = async (
    request: AIInfluencerJobRequest
): Promise<AIInfluencerJobResponse> => {
    try {
        // Validate required fields
        if (!request.jobId || !request.topic || !request.duration || !request.gender || !request.avatarUrl) {
            throw new Error('Missing required fields: jobId, topic, duration, gender, avatarUrl');
        }

        // Require authentication
        if (!request.userId) {
            throw new Error('Authentication required. Please sign in to generate AI influencer videos.');
        }

        // Check if user already has an active generation
        if (activeGenerations.has(request.userId)) {
            return {
                success: false,
                jobId: request.jobId,
                error: 'You already have an active AI Influencer generation in progress. Please wait for it to complete before starting a new one.',
            };
        }

        // Mark user as having an active generation
        activeGenerations.add(request.userId);

        // Check credits
        const creditCheck = await checkCredits(request.userId, 'AI_INFLUENCER');
        if (!creditCheck.allowed) {
            activeGenerations.delete(request.userId);
            return {
                success: false,
                jobId: request.jobId,
                error: creditCheck.error || 'Insufficient credits. Please upgrade your plan.',
            };
        }

        // Deduct credits (70 for AI Influencer)
        try {
            await deductCredits(request.userId, 70, 'AI_INFLUENCER', request.jobId, 'AI Influencer video generation');
        } catch (error) {
            activeGenerations.delete(request.userId);
            const msg = error instanceof Error ? error.message : 'Failed to deduct credits';
            return {
                success: false,
                jobId: request.jobId,
                error: msg,
            };
        }

        // Create Firestore document for history tracking
        const jobDoc: AIInfluencerJob = {
            jobId: request.jobId,
            userId: request.userId,
            status: 'pending',
            topic: request.topic,
            duration: request.duration,
            gender: request.gender,
            script: request.script,
            avatarUrl: request.avatarUrl,
            photoUrl: request.photoUrl,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };
        await setDoc(doc(db, COLLECTION, request.jobId), jobDoc);
        console.log(`📝 Firestore doc created: ${COLLECTION}/${request.jobId}`);

        console.log('🎬 Dispatching AI Influencer job:', {
            jobId: request.jobId,
            topic: request.topic.substring(0, 50),
            duration: request.duration,
            gender: request.gender,
            hasScript: !!request.script,
        });

        const response = await fetch('/api/sqs/ai-influencer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to dispatch job');
        }

        console.log('✅ AI Influencer job dispatched:', data);
        return data;

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('AI Influencer job dispatch failed:', msg);
        return {
            success: false,
            jobId: request.jobId,
            error: msg,
        };
    } finally {
        // Remove user from active generations when done
        activeGenerations.delete(request.userId);
    }
};

/**
 * Poll for job status from Firestore
 * This is a placeholder - actual implementation uses Firestore onSnapshot
 */
export const pollJobStatus = async (jobId: string): Promise<AIInfluencerJobStatus | null> => {
    try {
        // In a real implementation, this would query Firestore
        // For now, return null - use Firestore real-time listeners in UI
        console.log(`Polling for job: ${jobId} - Use Firestore onSnapshot instead`);
        return null;
    } catch (error) {
        console.error('Error polling job status:', error);
        return null;
    }
};

/**
 * Check if AI Influencer service is configured
 */
export const isAIInfluencerConfigured = (): boolean => {
    // Check if required env vars are available
    // This is client-side, so we can't check server env vars directly
    // Return true to assume configured, errors will show in actual API calls
    return true;
};
