'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { BlogPost } from '@/types/blog';
import { getBlogBySlug, incrementBlogViews, formatDate } from '@/lib/blogUtils';
import BlogCard from '@/components/blog/BlogCard';
import BlogContent from '@/components/blog/BlogContent';
import { Calendar, Eye, ArrowLeft, Share2 } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/ook/Navbar';
import Footer from '@/components/ook/Footer';
import NoiseOverlay from '@/components/NoiseOverlay';

export default function BlogPostPage() {
    const params = useParams();
    const slug = params.slug as string;
    
    const [blog, setBlog] = useState<BlogPost | null>(null);
    const [relatedBlogs, setRelatedBlogs] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        if (slug) {
            loadBlog();
        }
    }, [slug]);

    const loadBlog = async () => {
        try {
            const fetchedBlog = await getBlogBySlug(slug);
            
            if (fetchedBlog) {
                setBlog(fetchedBlog);
                
                // Increment view counter
                await incrementBlogViews(fetchedBlog.id);
                
                // Fetch related blogs (same category)
                if (fetchedBlog.category) {
                    const q = query(
                        collection(db, 'blogs'),
                        where('category', '==', fetchedBlog.category),
                        limit(4)
                    );
                    const snapshot = await getDocs(q);
                    const related = snapshot.docs
                        .map(doc => ({ id: doc.id, ...doc.data() } as BlogPost))
                        .filter(b => b.id !== fetchedBlog.id)
                        .slice(0, 3);
                    setRelatedBlogs(related);
                }
            }
        } catch (error) {
            console.error('Error loading blog:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleJoinClick = () => {
        window.location.href = user ? '/workspace' : '/login';
    };

    const handleShare = async () => {
        if (navigator.share && blog) {
            try {
                await navigator.share({
                    title: blog.title,
                    text: blog.excerpt || blog.seoDescription,
                    url: window.location.href,
                });
            } catch (error) {
                console.log('Error sharing:', error);
            }
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(window.location.href);
            alert('Link copied to clipboard!');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#020202] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-600"></div>
            </div>
        );
    }

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

    return (
        <div className="min-h-screen bg-[#020202] text-white">
            <NoiseOverlay />
            <Navbar user={user} onJoinClick={handleJoinClick} />

            <main className="pt-32 pb-20">
                {/* Back Button */}
                <div className="max-w-4xl mx-auto px-6 mb-8">
                    <Link 
                        href="/blogs"
                        className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={20} />
                        Back to Blog
                    </Link>
                </div>

                {/* Featured Image */}
                <div className="max-w-6xl mx-auto px-6 mb-12">
                    <div className="relative h-[400px] md:h-[500px] rounded-3xl overflow-hidden">
                        <img
                            src={blog.featuredImage}
                            alt={blog.title}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>
                </div>

                {/* Article Content */}
                <article className="max-w-4xl mx-auto px-6">
                    {/* Category Badge */}
                    <div className="mb-6">
                        <span className="px-4 py-2 bg-orange-600 text-white text-sm font-bold uppercase tracking-wider rounded-full">
                            {blog.category}
                        </span>
                    </div>

                    {/* Title */}
                    <h1 className="text-4xl md:text-5xl font-black mb-6 leading-tight">
                        {blog.title}
                    </h1>

                    {/* Meta Info */}
                    <div className="flex flex-wrap items-center gap-6 text-white/60 mb-8 pb-8 border-b border-white/10">
                        <div className="flex items-center gap-2">
                            <Calendar size={18} />
                            <span>{formatDate(blog.publishedAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Eye size={18} />
                            <span>{blog.views || 0} views</span>
                        </div>
                        <span>By {blog.author}</span>
                        <button
                            onClick={handleShare}
                            className="ml-auto flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <Share2 size={18} />
                            Share
                        </button>
                    </div>

                    {/* Content */}
                    <div className="prose prose-invert prose-lg max-w-none mb-12">
                        <BlogContent content={blog.content} />
                    </div>

                    {/* Tags */}
                    {blog.tags && blog.tags.length > 0 && (
                        <div className="flex flex-wrap gap-3 mb-12 pb-12 border-b border-white/10">
                            {blog.tags.map((tag, index) => (
                                <span
                                    key={index}
                                    className="px-4 py-2 bg-white/5 text-white/80 rounded-full text-sm hover:bg-white/10 transition-colors"
                                >
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Related Posts */}
                    {relatedBlogs.length > 0 && (
                        <div className="mt-16">
                            <h2 className="text-3xl font-black mb-8">Related Articles</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {relatedBlogs.map((relatedBlog) => (
                                    <BlogCard key={relatedBlog.id} blog={relatedBlog} />
                                ))}
                            </div>
                        </div>
                    )}
                </article>
            </main>

            <Footer />
        </div>
    );
}
