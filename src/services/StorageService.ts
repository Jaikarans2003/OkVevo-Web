/**
 * Fetches stitched videos from Firebase Storage 'videos/' folder
 * Returns signed URLs for stitched videos
 */
export const fetchStitchedVideos = async (): Promise<string[]> => {
    try {
        console.log('Fetching stitched videos from Firebase Storage (client-side)...');

        // Reuse the logic to fetch files from videos folder
        // Stitched videos are typically saved there or in a subfolder. 
        // Helper to list from 'videos/'
        const listRef = ref(storage, 'videos/');
        const res = await listAll(listRef);

        const urlPromises = res.items.map((itemRef: StorageReference) => getDownloadURL(itemRef));
        const urls = await Promise.all(urlPromises);

        return urls;

    } catch (error) {
        console.error('Error fetching stitched videos:', error);
        return [];
    }
};

export interface StorageVideo {
    id: string;
    url: string;
}

import { storage } from '../config/firebase';
import { ref, listAll, getDownloadURL, StorageReference } from 'firebase/storage';

/**
 * Fetches video URLs from MockAIGeneratedVideos folder (or 'videos' folder)
 * Returns signed URLs
 */
export const fetchVideosFromStorage = async (): Promise<string[]> => {
    try {
        console.log('Fetching videos from Firebase Storage (client-side)...');

        // Reference to the videos folder
        // User confirmed path: MockAIGeneratedVideos (files: 1, 2, 3)
        const listRef = ref(storage, 'MockAIGeneratedVideos/');

        const res = await listAll(listRef);

        // Fetch download URLs for each item
        const urlPromises = res.items.map((itemRef: StorageReference) => getDownloadURL(itemRef));
        const urls = await Promise.all(urlPromises);

        console.log(`Fetched ${urls.length} videos from storage.`);
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
