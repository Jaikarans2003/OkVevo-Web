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
import { ref, listAll, getDownloadURL, StorageReference, uploadBytes } from 'firebase/storage';

export interface UploadedCharacterSheet {
    name: string;
    description: string;
    downloadUrl?: string; // undefined if no image was provided
}

/**
 * Uploads character sheet images to Firebase Storage under
 * `character-sheets/{sessionId}/`. Returns the same sheets enriched
 * with public download URLs for any that had an image.
 */
export const uploadCharacterSheets = async (
    sheets: Array<{ name: string; description: string; imageDataUrl?: string }>,
    sessionId: string
): Promise<UploadedCharacterSheet[]> => {
    const results: UploadedCharacterSheet[] = [];

    for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];

        if (!sheet.imageDataUrl) {
            results.push({ name: sheet.name, description: sheet.description });
            continue;
        }

        // Derive extension from data URL (e.g. "data:image/jpeg;base64,...")
        const mimeMatch = sheet.imageDataUrl.match(/^data:(image\/[a-z]+);base64,/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const ext = mime.split('/')[1]; // jpeg | jpg | png

        // Convert base-64 to Blob
        const base64Data = sheet.imageDataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
        const byteChars = atob(base64Data);
        const byteArr = new Uint8Array(byteChars.length);
        for (let j = 0; j < byteChars.length; j++) byteArr[j] = byteChars.charCodeAt(j);
        const blob = new Blob([byteArr], { type: mime });

        const storagePath = `character-sheets/${sessionId}/${i + 1}_${sheet.name || 'character'}.${ext}`;
        const fileRef = ref(storage, storagePath);

        try {
            await uploadBytes(fileRef, blob, { contentType: mime });
            const downloadUrl = await getDownloadURL(fileRef);
            results.push({ name: sheet.name, description: sheet.description, downloadUrl });
            console.log(`Uploaded character sheet ${i + 1} → ${storagePath}`);
        } catch (err) {
            console.error(`Failed to upload character sheet ${i + 1}:`, err);
            results.push({ name: sheet.name, description: sheet.description });
        }
    }

    return results;
};



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
