import { db } from '@/config/firebase';
import { collection, query, where, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
import { BlogPost } from '@/types/blog';

/**
 * Generate URL-friendly slug from title
 */
export function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Fetch blog post by slug
 */
export async function getBlogBySlug(slug: string): Promise<BlogPost | null> {
    try {
        const q = query(collection(db, 'blogs'), where('slug', '==', slug));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) return null;
        
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as BlogPost;
    } catch (error) {
        console.error('Error fetching blog by slug:', error);
        return null;
    }
}

/**
 * Increment blog view counter
 */
export async function incrementBlogViews(blogId: string): Promise<void> {
    try {
        const blogRef = doc(db, 'blogs', blogId);
        await updateDoc(blogRef, {
            views: increment(1)
        });
    } catch (error) {
        console.error('Error incrementing blog views:', error);
    }
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
}

/**
 * Format date for display
 */
export function formatDate(timestamp: any): string {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(date);
}
