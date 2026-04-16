import { Metadata } from 'next';
import { db } from '@/config/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { BlogPost } from '@/types/blog';
import BlogsClient from '@/components/blog/BlogsClient';

export const metadata: Metadata = {
    title: 'Resources & Insights | OKVEVO AI Blog',
    description: 'Explore the latest insights, strategies, and breakthroughs in AI-driven video content, Instagram reels growth, and text-to-video technology.',
    openGraph: {
        title: 'OKVEVO AI Blog - Insights for Creators',
        description: 'Stay ahead with the latest in AI video generation and viral content strategies.',
        type: 'website',
    },
};

/**
 * Robust serialization helper to convert Firestore Timestamps and complex objects
 * to plain, serializable JSON values for Next.js Server-to-Client prop passing.
 */
function serializeData(data: any): any {
    if (data === null || data === undefined) return data;
    
    // Handle Arrays
    if (Array.isArray(data)) {
        return data.map(item => serializeData(item));
    }
    
    // Handle Firestore Timestamps
    if (typeof data.toDate === 'function') {
        return data.toDate().toISOString();
    }
    
    // Handle Objects
    if (typeof data === 'object') {
        const serialized: any = {};
        for (const [key, value] of Object.entries(data)) {
            serialized[key] = serializeData(value);
        }
        return serialized;
    }
    
    return data;
}

async function getBlogs() {
    try {
        const q = query(collection(db, 'blogs'), orderBy('publishedAt', 'desc'));
        const snapshot = await getDocs(q);
        const blogs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as BlogPost[];

        return serializeData(blogs);
    } catch (error) {
        console.error('Error fetching blogs:', error);
        return [];
    }
}

export default async function BlogsPage() {
    const blogs = await getBlogs();

    return <BlogsClient initialBlogs={blogs} />;
}
