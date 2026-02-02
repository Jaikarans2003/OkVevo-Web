import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import type { Scene } from './AIService';
import type { NarrationScript } from './NarrationService';

export interface GenerationFiles {
    scenes?: string;
    narration?: string;
    audio?: string;
    videos: string[];
    finalVideo?: string;
}

/**
 * Construct storage path for a generation
 * @param userId - User ID or Organisation ID
 * @param sessionId - Unique session identifier
 * @param filename - Name of the file
 */
export function constructGenerationPath(userId: string, sessionId: string, filename: string): string {
    return `generations/${userId}/${sessionId}/${filename}`;
}

/**
 * Upload scenes JSON to Firebase Storage
 */
export async function uploadScenes(
    userId: string,
    sessionId: string,
    scenes: Scene[]
): Promise<string> {
    try {
        const scenesJson = JSON.stringify(scenes, null, 2);
        const blob = new Blob([scenesJson], { type: 'application/json' });

        const path = constructGenerationPath(userId, sessionId, 'scenes.json');
        const storageRef = ref(storage, path);

        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);

        console.log('✅ Scenes uploaded:', url);
        return url;
    } catch (error) {
        console.error('❌ Failed to upload scenes:', error);
        throw new Error('Failed to upload scenes');
    }
}

/**
 * Upload narration JSON to Firebase Storage
 */
export async function uploadNarration(
    userId: string,
    sessionId: string,
    narration: NarrationScript
): Promise<string> {
    try {
        const narrationJson = JSON.stringify(narration, null, 2);
        const blob = new Blob([narrationJson], { type: 'application/json' });

        const path = constructGenerationPath(userId, sessionId, 'narration.json');
        const storageRef = ref(storage, path);

        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);

        console.log('✅ Narration uploaded:', url);
        return url;
    } catch (error) {
        console.error('❌ Failed to upload narration:', error);
        throw new Error('Failed to upload narration');
    }
}

/**
 * Upload audio file to Firebase Storage
 * Accepts either a URL (to fetch and re-upload) or a Blob
 */
export async function uploadAudio(
    userId: string,
    sessionId: string,
    audioSource: string | Blob
): Promise<string> {
    try {
        let audioBlob: Blob;

        if (typeof audioSource === 'string') {
            // Fetch audio from URL and convert to blob
            const response = await fetch(audioSource);
            audioBlob = await response.blob();
        } else {
            audioBlob = audioSource;
        }

        const path = constructGenerationPath(userId, sessionId, 'audio.mp3');
        const storageRef = ref(storage, path);

        await uploadBytes(storageRef, audioBlob, { contentType: 'audio/mpeg' });
        const url = await getDownloadURL(storageRef);

        console.log('✅ Audio uploaded:', url);
        return url;
    } catch (error) {
        console.error('❌ Failed to upload audio:', error);
        throw new Error('Failed to upload audio');
    }
}

/**
 * Upload a video file to Firebase Storage
 * @param index - Video index (1, 2, 3, etc.)
 */
export async function uploadVideo(
    userId: string,
    sessionId: string,
    videoSource: string | Blob,
    index: number
): Promise<string> {
    try {
        let videoBlob: Blob;

        if (typeof videoSource === 'string') {
            // Fetch video from URL and convert to blob
            const response = await fetch(videoSource);
            videoBlob = await response.blob();
        } else {
            videoBlob = videoSource;
        }

        const path = constructGenerationPath(userId, sessionId, `video_${index}.mp4`);
        const storageRef = ref(storage, path);

        await uploadBytes(storageRef, videoBlob, { contentType: 'video/mp4' });
        const url = await getDownloadURL(storageRef);

        console.log(`✅ Video ${index} uploaded:`, url);
        return url;
    } catch (error) {
        console.error(`❌ Failed to upload video ${index}:`, error);
        throw new Error(`Failed to upload video ${index}`);
    }
}

/**
 * Upload multiple videos in parallel
 */
export async function uploadVideos(
    userId: string,
    sessionId: string,
    videoSources: (string | Blob)[]
): Promise<string[]> {
    try {
        const uploadPromises = videoSources.map((source, index) =>
            uploadVideo(userId, sessionId, source, index + 1)
        );

        const urls = await Promise.all(uploadPromises);
        console.log(`✅ All ${urls.length} videos uploaded`);
        return urls;
    } catch (error) {
        console.error('❌ Failed to upload videos:', error);
        throw new Error('Failed to upload videos');
    }
}

/**
 * Upload final stitched video to Firebase Storage
 */
export async function uploadFinalVideo(
    userId: string,
    sessionId: string,
    videoSource: string | Blob
): Promise<string> {
    try {
        let videoBlob: Blob;

        if (typeof videoSource === 'string') {
            // Fetch video from URL and convert to blob
            const response = await fetch(videoSource);
            videoBlob = await response.blob();
        } else {
            videoBlob = videoSource;
        }

        const path = constructGenerationPath(userId, sessionId, 'final_stitched.mp4');
        const storageRef = ref(storage, path);

        await uploadBytes(storageRef, videoBlob, { contentType: 'video/mp4' });
        const url = await getDownloadURL(storageRef);

        console.log('✅ Final video uploaded:', url);
        return url;
    } catch (error) {
        console.error('❌ Failed to upload final video:', error);
        throw new Error('Failed to upload final video');
    }
}

/**
 * Delete all files for a generation
 */
export async function deleteGeneration(userId: string, sessionId: string): Promise<void> {
    try {
        const basePath = `generations/${userId}/${sessionId}`;
        const folderRef = ref(storage, basePath);

        // List all files in the folder
        const listResult = await listAll(folderRef);

        // Delete all files
        const deletePromises = listResult.items.map(itemRef => deleteObject(itemRef));
        await Promise.all(deletePromises);

        console.log(`✅ Deleted all files for generation ${sessionId}`);
    } catch (error) {
        console.error('❌ Failed to delete generation files:', error);
        throw new Error('Failed to delete generation files');
    }
}

/**
 * List all generations for a user
 */
export async function listUserGenerations(userId: string): Promise<string[]> {
    try {
        const basePath = `generations/${userId}`;
        const folderRef = ref(storage, basePath);

        const listResult = await listAll(folderRef);

        // Return session IDs (folder names)
        const sessionIds = listResult.prefixes.map(prefix => {
            const parts = prefix.fullPath.split('/');
            return parts[parts.length - 1];
        });

        return sessionIds;
    } catch (error) {
        console.error('❌ Failed to list user generations:', error);
        return [];
    }
}
