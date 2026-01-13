export interface StorageVideo {
    id: string;
    url: string;
}

/**
 * Fetches video URLs from Firebase Storage via Cloud Function
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
