import { Metadata } from 'next';
import { getBlogBySlug } from '@/lib/blogUtils';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { BlogPost } from '@/types/blog';
import BlogView from '@/components/blog/BlogView';
import Link from 'next/link';
import { env } from '@/config/env';

interface Props {
    params: Promise<{ slug: string }>;
}

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const blog = await getBlogBySlug(slug);
    
    if (!blog) {
        return {
            title: 'Blog Post Not Found | OKVEVO',
        };
    }

    const title = `${blog.title} | OKVEVO Blog`;
    const description = blog.seoDescription || blog.excerpt || `Read about ${blog.title} on OKVEVO.`;
    
    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: 'article',
            publishedTime: blog.publishedAt?.toDate?.()?.toISOString() || new Date(blog.publishedAt).toISOString(),
            authors: [blog.author],
            images: [
                {
                    url: blog.featuredImage,
                    width: 1200,
                    height: 630,
                    alt: blog.title,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [blog.featuredImage],
        },
    };
}

async function getRelatedBlogs(category: string, currentId: string) {
    try {
        const q = query(
            collection(db, 'blogs'),
            where('category', '==', category),
            limit(4)
        );
        const snapshot = await getDocs(q);
        const blogs = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as BlogPost))
            .filter(b => b.id !== currentId)
            .slice(0, 3);

        return serializeData(blogs);
    } catch (error) {
        console.error('Error fetching related blogs:', error);
        return [];
    }
}

export default async function BlogPostPage({ params }: Props) {
    const { slug } = await params;
    const blog = await getBlogBySlug(slug);

    if (!blog) {
        return (
            <div className="min-h-screen bg-[#020202] text-white flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-4xl font-black mb-4">Blog Post Not Found</h1>
                    <Link href="/blogs" className="text-orange-600 hover:text-orange-400 transition-colors">
                        ← Back to Blog
                    </Link>
                </div>
            </div>
        );
    }

    const relatedBlogs = await getRelatedBlogs(blog.category, blog.id);

    const articleSchema = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": blog.title,
        "image": [blog.featuredImage],
        "datePublished": blog.publishedAt?.toDate?.()?.toISOString() || new Date(blog.publishedAt).toISOString(),
        "dateModified": blog.publishedAt?.toDate?.()?.toISOString() || new Date(blog.publishedAt).toISOString(),
        "author": [{
            "@type": "Person",
            "name": blog.author,
            "url": `${env.siteUrl}/about`
        }],
        "publisher": {
            "@type": "Organization",
            "name": "OKVEVO",
            "logo": {
                "@type": "ImageObject",
                "url": `${env.siteUrl}/OKVEVO%20With%20BackGrounds/OrangeBackGround.svg`
            }
        },
        "description": blog.seoDescription || blog.excerpt,
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": `${env.siteUrl}/blogs/${slug}`
        }
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
            />
            <BlogView blog={serializeData(blog)} relatedBlogs={relatedBlogs} />
        </>
    );
}
