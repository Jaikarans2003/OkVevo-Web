import { db, storage } from '../config/firebase';
import { 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    deleteDoc, 
    query, 
    orderBy, 
    Timestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, uploadBytesResumable } from 'firebase/storage';

export interface AvatarProfile {
    id: string;
    name: string;
    videoUrl: string;
    audioSampleUrl: string;
    thumbnailUrl?: string;
    createdAt: string;
    updatedAt: string;
}

const MAX_PROFILES = 5;

/**
 * Generate a thumbnail from video file using canvas
 */
export async function generateThumbnail(videoFile: File): Promise<Blob | null> {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        video.onloadeddata = () => {
            // Seek to 1 second or start
            video.currentTime = Math.min(1, video.duration / 2);
        };

        video.onseeked = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            canvas.toBlob((blob) => {
                URL.revokeObjectURL(video.src);
                resolve(blob);
            }, 'image/jpeg', 0.8);
        };

        video.onerror = () => {
            URL.revokeObjectURL(video.src);
            resolve(null);
        };

        video.src = URL.createObjectURL(videoFile);
    });
}

export interface UploadProgress {
    videoProgress: number;
    audioProgress: number;
    thumbnailProgress: number;
    stage: 'video' | 'audio' | 'thumbnail' | 'saving' | 'complete';
}

/**
 * Create a new avatar profile with progress tracking
 */
export async function createAvatarProfile(
    userId: string,
    name: string,
    videoFile: File,
    audioFile: File,
    onProgress?: (progress: UploadProgress) => void
): Promise<AvatarProfile> {
    // Check if user already has max profiles
    const existingProfiles = await getUserAvatarProfiles(userId);
    if (existingProfiles.length >= MAX_PROFILES) {
        throw new Error(`Maximum ${MAX_PROFILES} avatar profiles allowed`);
    }

    // Check if name already exists
    if (existingProfiles.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        throw new Error('Avatar profile with this name already exists');
    }

    // Validate name
    if (!name || name.trim().length < 3 || name.trim().length > 50) {
        throw new Error('Avatar name must be between 3 and 50 characters');
    }

    // Validate audio format
    if (!audioFile.type.includes('mp3') && !audioFile.name.toLowerCase().endsWith('.mp3')) {
        throw new Error('Audio file must be in MP3 format');
    }

    const profileId = `avatar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const storagePath = `avatarProfiles/${userId}/${profileId}`;

    try {
        // Upload video with progress
        const videoRef = ref(storage, `${storagePath}/video.mp4`);
        const videoUploadTask = uploadBytesResumable(videoRef, videoFile);
        
        const videoUrl = await new Promise<string>((resolve, reject) => {
            videoUploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    onProgress?.({
                        videoProgress: progress,
                        audioProgress: 0,
                        thumbnailProgress: 0,
                        stage: 'video'
                    });
                },
                (error) => reject(error),
                async () => {
                    const url = await getDownloadURL(videoUploadTask.snapshot.ref);
                    resolve(url);
                }
            );
        });

        // Upload audio with progress
        const audioRef = ref(storage, `${storagePath}/audio.mp3`);
        const audioUploadTask = uploadBytesResumable(audioRef, audioFile);
        
        const audioSampleUrl = await new Promise<string>((resolve, reject) => {
            audioUploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    onProgress?.({
                        videoProgress: 100,
                        audioProgress: progress,
                        thumbnailProgress: 0,
                        stage: 'audio'
                    });
                },
                (error) => reject(error),
                async () => {
                    const url = await getDownloadURL(audioUploadTask.snapshot.ref);
                    resolve(url);
                }
            );
        });

        // Generate and upload thumbnail
        let thumbnailUrl: string | undefined;
        try {
            onProgress?.({
                videoProgress: 100,
                audioProgress: 100,
                thumbnailProgress: 0,
                stage: 'thumbnail'
            });
            
            const thumbnailBlob = await generateThumbnail(videoFile);
            if (thumbnailBlob) {
                const thumbnailRef = ref(storage, `${storagePath}/thumbnail.jpg`);
                await uploadBytes(thumbnailRef, thumbnailBlob);
                thumbnailUrl = await getDownloadURL(thumbnailRef);
                
                onProgress?.({
                    videoProgress: 100,
                    audioProgress: 100,
                    thumbnailProgress: 100,
                    stage: 'thumbnail'
                });
            }
        } catch (err) {
            console.warn('Failed to generate thumbnail:', err);
        }

        // Save to Firestore
        onProgress?.({
            videoProgress: 100,
            audioProgress: 100,
            thumbnailProgress: 100,
            stage: 'saving'
        });
        
        const now = new Date().toISOString();
        const profile: AvatarProfile = {
            id: profileId,
            name: name.trim(),
            videoUrl,
            audioSampleUrl,
            thumbnailUrl,
            createdAt: now,
            updatedAt: now,
        };

        const profileRef = doc(db, 'users', userId, 'avatarProfiles', profileId);
        await setDoc(profileRef, profile);

        onProgress?.({
            videoProgress: 100,
            audioProgress: 100,
            thumbnailProgress: 100,
            stage: 'complete'
        });

        return profile;
    } catch (error) {
        // Cleanup on error
        try {
            const videoRef = ref(storage, `${storagePath}/video.mp4`);
            await deleteObject(videoRef).catch(() => {});
            const audioRef = ref(storage, `${storagePath}/audio.mp3`);
            await deleteObject(audioRef).catch(() => {});
            const thumbnailRef = ref(storage, `${storagePath}/thumbnail.jpg`);
            await deleteObject(thumbnailRef).catch(() => {});
        } catch {}
        
        throw error;
    }
}

/**
 * Get all avatar profiles for a user
 */
export async function getUserAvatarProfiles(userId: string): Promise<AvatarProfile[]> {
    try {
        const profilesRef = collection(db, 'users', userId, 'avatarProfiles');
        const q = query(profilesRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => doc.data() as AvatarProfile);
    } catch (error) {
        console.error('Error fetching avatar profiles:', error);
        return [];
    }
}

/**
 * Get a single avatar profile
 */
export async function getAvatarProfile(userId: string, profileId: string): Promise<AvatarProfile | null> {
    try {
        const profileRef = doc(db, 'users', userId, 'avatarProfiles', profileId);
        const snapshot = await getDoc(profileRef);
        
        if (!snapshot.exists()) {
            return null;
        }
        
        return snapshot.data() as AvatarProfile;
    } catch (error) {
        console.error('Error fetching avatar profile:', error);
        return null;
    }
}

/**
 * Delete an avatar profile
 */
export async function deleteAvatarProfile(userId: string, profileId: string): Promise<void> {
    const storagePath = `avatarProfiles/${userId}/${profileId}`;

    try {
        // Delete from Storage
        const videoRef = ref(storage, `${storagePath}/video.mp4`);
        await deleteObject(videoRef).catch(() => {});
        
        const audioRef = ref(storage, `${storagePath}/audio.mp3`);
        await deleteObject(audioRef).catch(() => {});
        
        const thumbnailRef = ref(storage, `${storagePath}/thumbnail.jpg`);
        await deleteObject(thumbnailRef).catch(() => {});

        // Delete from Firestore
        const profileRef = doc(db, 'users', userId, 'avatarProfiles', profileId);
        await deleteDoc(profileRef);
    } catch (error) {
        console.error('Error deleting avatar profile:', error);
        throw new Error('Failed to delete avatar profile');
    }
}

/**
 * Check if user can add more profiles
 */
export async function canAddProfile(userId: string): Promise<boolean> {
    const profiles = await getUserAvatarProfiles(userId);
    return profiles.length < MAX_PROFILES;
}
