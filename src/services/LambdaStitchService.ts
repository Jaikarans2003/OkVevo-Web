/**
 * AWS Lambda Video Stitching Service
 * 
 * This service triggers an AWS Lambda function to stitch 3 videos together
 * using FFmpeg and upload the final result to Firebase Storage.
 */

export interface StitchRequest {
    videoUrls: string[];  // Firebase Storage URLs
    sessionId?: string;
}

export interface StitchResponse {
    success: boolean;
    videoUrl?: string;
    error?: string;
    message?: string;
}

/**
 * Triggers AWS Lambda to stitch videos from Firebase Storage
 * @param request - Contains videoIds and optional sessionId
 * @returns Promise with stitched video URL or error
 */
export const stitchVideosWithLambda = async (
    request: StitchRequest
): Promise<StitchResponse> => {
    try {
        // Use Next.js API route proxy (API Gateway - 30s timeout but works)
        const proxyUrl = '/api/stitch';

        console.log('Triggering Lambda video stitching via proxy:', request);

        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        });

        const data = await response.json();

        if (!data.success) {
            console.error('Lambda reported error:', data);

            // Handle API Gateway Timeout (29s) gracefully
            if (data.error && data.error.includes('timed out')) {
                console.log('⚠️ API Gateway timed out, but Lambda is likely still running. Starting polling...');
                return await pollForStitchedVideo(request.sessionId || '');
            }

            throw new Error(data.error || 'Video stitching failed');
        }

        console.log('Lambda stitching successful:', data);
        return data;
    } catch (error) {
        console.error('Error calling Lambda stitch function:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

        return {
            success: false,
            error: errorMessage
        };
    }
};

async function pollForStitchedVideo(sessionId: string): Promise<StitchResponse> {
    if (!sessionId) return { success: false, error: 'Cannot poll without sessionId' };

    console.log(`Polling for stitched video with session ID: ${sessionId}...`);
    const { fetchVideosFromStorage } = await import('./StorageService');
    const MAX_ATTEMPTS = 30; // 30 attempts * 5 seconds = 2.5 minutes

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s

        try {
            const videos = await fetchVideosFromStorage();
            // Look for a video URL containing the session ID
            const match = videos.find(url => url.includes(sessionId));

            if (match) {
                console.log('✅ Found stitched video via polling:', match);
                return {
                    success: true,
                    videoUrl: match,
                    message: 'Video stitched successfully (recovered from timeout)'
                };
            }
            console.log(`Attempt ${i + 1}/${MAX_ATTEMPTS}: Video not found yet...`);
        } catch (err) {
            console.warn('Polling error (ignoring):', err);
        }
    }

    return {
        success: false,
        error: 'Stitching timed out. The video might appear in your library later.'
    };

};


/**
     * Check if Lambda service is configured
     */
export const isLambdaConfigured = (): boolean => {
    return !!process.env.NEXT_PUBLIC_LAMBDA_STITCH_URL;
};
