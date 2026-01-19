/**
 * Fetches stitched videos from Firebase Storage 'videos/' folder
 * Returns signed URLs for stitched videos
 */
export const fetchStitchedVideos = async (): Promise<string[]> => {
    try {
        // For now, use a simple approach - fetch all videos from storage
        // and filter for stitched ones
        const cloudFunctionUrl = 'https://us-central1-text2video-16cbf.cloudfunctions.net/replicateProxy/api/videos/fetch-stitched';

        // If cloud function doesn't exist yet, we can directly list from client
        // For immediate fix, we'll check the videos we already have
        console.log('Fetching stitched videos from videos/ folder...');

        // Alternative: Direct fetch using Firebase client SDK
        // This requires firebase initialization on client side
        const response = await fetch('/api/storage/list-stitched');

        if (!response.ok) {
            throw new Error(`Failed to fetch stitched videos: ${response.statusText}`);
        }

        const data = await response.json();
        return data.videos || [];

    } catch (error) {
        console.error('Error fetching stitched videos:', error);
        throw error;
    }
};

export interface StorageVideo {
    id: string;
    url: string;
}

/**
 * Fetches video URLs from MockAIGeneratedVideos folder
 * Returns signed URLs that expire after 1 hour
 */
export const fetchVideosFromStorage = async (): Promise<string[]> => {
    try {
        // Use deployed Cloud Function URL
        const cloudFunctionUrl = 'https://us-central1-text2video-16cbf.cloudfunctions.net/replicateProxy/api/videos/fetch';
        const response = await fetch(cloudFunctionUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch videos: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.videos || !Array.isArray(data.videos)) {
            throw new Error('Invalid response format from server');
        }


        const urls = data.videos.map((v: StorageVideo) => v.url);
        console.log('Fetched video URLs:', urls);
        return urls;
    } catch (error) {
        console.error('Error fetching videos from storage:', error);
        throw error;
    }
};
