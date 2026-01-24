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

/**
 * Fetches a specific count of mock AI-generated videos from Firebase Storage
 * Used for testing the video stitching pipeline
 * @param count Number of videos to fetch (default: 3)
 */
export const fetchMockAIGeneratedVideos = async (count: number = 3): Promise<string[]> => {
    try {
        const allVideos = await fetchVideosFromStorage();

        // Return the requested number of videos
        const selectedVideos = allVideos.slice(0, count);

        if (selectedVideos.length < count) {
            console.warn(`Requested ${count} videos but only ${selectedVideos.length} available`);
        }

        return selectedVideos;
    } catch (error) {
        console.error(`Error fetching ${count} mock videos:`, error);
        throw error;
    }
};
