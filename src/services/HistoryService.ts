import { db } from '../config/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

export type GenerationType = 'AI_INFLUENCER' | 'DIRECTOR_PHOTOS' | 'PRODUCT_SHOOTS' | 'TRENDS' | 'PRODUCT_PLACEMENT';
export type GenerationStatus = 'pending' | 'processing' | 'generating-script' | 'generating-audio' | 'generating-lipsync' | 'downloading' | 'generating-subtitles' | 'compositing' | 'uploading' | 'complete' | 'error' | 'failed';

export interface UserGeneration {
    id: string;
    userId: string;
    type: GenerationType;
    title: string;
    status: GenerationStatus;
    createdAt: Date;
    thumbnailUrl?: string; // Optional image url to show in history card
    videoUrl?: string; // Optional final video url
    imageUrl?: string; // Optional final image url
}

// Map each collection to its GenerationType and extract a helpful title
const COLLECTIONS: Array<{ name: string; type: GenerationType; isSubcollection?: boolean }> = [
    { name: 'aiInfluencerJobs', type: 'AI_INFLUENCER', isSubcollection: true },
    { name: 'directorPhotosJobs', type: 'DIRECTOR_PHOTOS' },
    { name: 'productShootsJobs', type: 'PRODUCT_SHOOTS' },
    { name: 'trendGenerations', type: 'TRENDS' },
    { name: 'placementJobs', type: 'PRODUCT_PLACEMENT' },
];

/**
 * Fetch and aggregate user generations from all different collections.
 */
export async function getUserHistory(userId: string, maxResults: number = 50): Promise<UserGeneration[]> {
    if (!userId) return [];

    let allGenerations: UserGeneration[] = [];

    // Run queries in parallel for performance
    const queries = COLLECTIONS.map(async ({ name, type, isSubcollection }) => {
        try {
            // For subcollections, query from users/{userId}/{collectionName}
            // For regular collections, query from {collectionName} with userId filter
            const colRef = isSubcollection 
                ? collection(db, 'users', userId, name)
                : collection(db, name);
            
            // We'll limit per collection to ensure we get something from all if they exist,
            // then we sort/limit the merged result. 
            // NOTE: orderBy createdAt requires composite indexes if combined with where(). 
            // In many cases, it's safer to just fetch & sort client-side (or here) to avoid index errors on new collections.
            const q = isSubcollection
                ? query(colRef) // No userId filter needed for subcollections
                : query(colRef, where('userId', '==', userId));

            const snapshot = await getDocs(q);
            console.log(`📊 Fetched ${snapshot.size} documents from ${isSubcollection ? `users/${userId}/${name}` : name} (${type})`);
            const gens: UserGeneration[] = [];

            snapshot.forEach(doc => {
                const data = doc.data();

                // Parse the createdAt Date cleanly
                let createdAtDate = new Date();
                if (data.createdAt?.toDate) {
                    createdAtDate = data.createdAt.toDate();
                } else if (data.timestamp) {
                    createdAtDate = new Date(data.timestamp);
                } else if (data.createdAt) {
                    createdAtDate = new Date(data.createdAt);
                }

                // Map data depending on type
                let title = 'Untitled Generation';
                let thumbnailUrl = '';
                let videoUrl = '';
                let imageUrl = '';

                if (type === 'AI_INFLUENCER') {
                    title = data.topic || 'AI Influencer Video';
                    videoUrl = data.finalVideoUrl || '';
                    thumbnailUrl = data.avatarUrl || '';
                    console.log(`📹 AI Influencer found: ${doc.id}`, {
                        topic: data.topic,
                        status: data.status,
                        finalVideoUrl: data.finalVideoUrl,
                        avatarUrl: data.avatarUrl,
                        createdAt: createdAtDate
                    });
                } else if (type === 'DIRECTOR_PHOTOS') {
                    title = data.masterPrompt?.substring(0, 40) + '...' || 'Director Photo';
                    imageUrl = data.outputUrl || '';
                    thumbnailUrl = data.outputUrl || '';
                } else if (type === 'PRODUCT_SHOOTS') {
                    title = data.masterPrompt?.substring(0, 40) + '...' || 'Product Shoot';
                    imageUrl = data.outputUrl || '';
                    thumbnailUrl = data.productImageUrl || data.outputUrl || '';
                } else if (type === 'TRENDS') {
                    title = data.trendTitle || data.title || 'Trend Generation';
                    videoUrl = data.finalVideoUrl || '';
                    thumbnailUrl = data.images?.[0]?.url || '';
                } else if (type === 'PRODUCT_PLACEMENT') {
                    title = data.masterPrompt?.substring(0, 40) + '...' || 'Product Placement';
                    imageUrl = data.outputUrl || '';
                    thumbnailUrl = data.heroImageUrl || data.outputUrl || '';
                }

                // If no specific name, use the type
                if (title === 'Untitled Generation') {
                    title = type.replace('_', ' ');
                }

                gens.push({
                    id: doc.id,
                    userId: data.userId || userId,
                    type,
                    title,
                    status: data.status || 'pending',
                    createdAt: createdAtDate,
                    thumbnailUrl,
                    videoUrl,
                    imageUrl
                });
            });

            return gens;
        } catch (error) {
            console.error(`Failed to fetch history for ${name}:`, error);
            return []; // Return empty array so one failure doesn't break the whole page
        }
    });

    const results = await Promise.all(queries);

    // Flatten the array of arrays
    results.forEach(res => {
        allGenerations = [...allGenerations, ...res];
    });

    // Sort by Date descending (newest first)
    allGenerations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply overall limit
    return allGenerations.slice(0, maxResults);
}
