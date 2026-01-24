/**
 * SQS Stitching Service
 * 
 * Client-side service to dispatch video stitching jobs to AWS SQS FIFO queue
 * via the backend API proxy.
 */

export interface StitchingJobRequest {
    jobId: string;
    videoUrls: string[];
    audioUrl?: string;  // Optional: TTS narration audio URL from Firebase Storage
}

export interface StitchingJobResponse {
    success: boolean;
    jobId?: string;
    messageId?: string;
    message?: string;
    error?: string;
}

/**
 * Generate a unique job ID for tracking
 */
export const generateJobId = (): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `stitch-${timestamp}-${random}`;
};

/**
 * Dispatch a stitching job to the SQS queue
 * @param videoUrls - Array of 3 video URLs from Firebase Storage
 * @param audioUrl - Optional TTS narration audio URL from Firebase Storage
 * @returns Promise with job tracking information
 */
export const dispatchStitchingJob = async (
    videoUrls: string[],
    audioUrl?: string
): Promise<StitchingJobResponse> => {
    try {
        // Validate input
        if (!videoUrls || videoUrls.length !== 3) {
            throw new Error('Exactly 3 video URLs are required for stitching');
        }

        // Generate unique job ID
        const jobId = generateJobId();

        console.log('🚀 Dispatching stitching job to SQS:', {
            jobId,
            videoCount: videoUrls.length,
            audioUrl: audioUrl || 'NONE - will use video audio'
        });

        // Call backend API to send message to SQS
        const response = await fetch('/api/sqs/stitch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jobId,
                videoUrls,
                audioUrl,  // Include audio URL in SQS message
            }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            console.error('SQS dispatch failed:', data);
            throw new Error(data.error || 'Failed to dispatch stitching job');
        }

        console.log('✅ Stitching job dispatched successfully:', data);
        return data;

    } catch (error) {
        console.error('Error dispatching stitching job:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
    }
};

/**
 * Check if SQS stitching is configured
 */
export const isSQSStitchingEnabled = (): boolean => {
    return process.env.NEXT_PUBLIC_USE_SQS_STITCHING === 'true';
};
