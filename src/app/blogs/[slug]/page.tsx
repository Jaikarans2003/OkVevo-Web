'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { BlogPost } from '@/types/blog';
import { getBlogBySlug, incrementBlogViews, formatDate } from '@/lib/blogUtils';
import BlogCard from '@/components/blog/BlogCard';
import BlogContent from '@/components/blog/BlogContent';
import { Share2 } from 'lucide-react';
import Link from 'next/link';
import NoiseOverlay from '@/components/NoiseOverlay';
import Navbar from '@/components/ook/Navbar';
import Footer from '@/components/ook/Footer';
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
            <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-600"></div>
            </div>
        );
    }

    if (!blog) {
        return (
            <div className="min-h-screen bg-[#FAF9F6] text-[#111111] flex items-center justify-center">
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
        <div className="relative min-h-screen bg-[#020202] text-white">
            <NoiseOverlay />
            
            {/* Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none mix-blend-screen" />
            
            {/* Subtle Glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[400px] opacity-20 bg-orange-600 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute right-0 top-1/3 w-[500px] h-[500px] opacity-10 bg-purple-600 blur-[150px] rounded-full pointer-events-none" />

            <div className="relative z-10">
                <Navbar user={user} onJoinClick={handleJoinClick} theme="dark" />

                <main className="pt-40 pb-20 max-w-7xl mx-auto px-6">
                
                {/* GO BACK and Meta Header */}
                <div className="flex flex-col md:flex-row md:justify-between items-start mb-12">
                    
                    {/* Left side: Back Button & Title */}
                    <div className="max-w-3xl">
                        <Link 
                            href="/blogs"
                            className="inline-flex items-center justify-center px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-white/20 rounded mb-10 hover:bg-white hover:text-black transition-colors"
                        >
                            Go Back
                        </Link>
                        
                        <h1 className="text-5xl md:text-6xl lg:text-7xl font-black leading-[1.1] mb-6 tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white via-white/90 to-white/30 pb-2">
                            {blog.title}
                        </h1>
                        <p className="text-xl md:text-2xl text-white/60 leading-relaxed font-medium max-w-2xl">
                            {blog.excerpt || "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor."}
                        </p>
                    </div>

                    {/* Right side: Meta */}
                    <div className="flex flex-col gap-6 mt-10 md:mt-0 md:text-left border-t md:border-t-0 md:border-l border-white/10 pt-6 md:pt-0 md:pl-12">
                        <div>
                            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40 mb-1">Date</div>
                            <div className="text-sm font-semibold">{formatDate(blog.publishedAt)}</div>
                        </div>
                        <div>
                            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40 mb-1">Category</div>
                            <div className="text-sm font-semibold uppercase">{blog.category}</div>
                        </div>
                        <div>
                            <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40 mb-1">Reading Time</div>
                            <div className="text-sm font-semibold uppercase">5 MIN</div>
                        </div>
                    </div>

                </div>

                {/* Featured Image */}
                <div className="w-full relative h-[400px] md:h-[600px] rounded-[2.5rem] overflow-hidden mb-16 bg-white/[0.02] border border-white/5 p-4 lg:p-6 backdrop-blur-md shadow-2xl transition-all duration-500 hover:border-white/10 group">
                    <img
                        src={blog.featuredImage}
                        alt={blog.title}
                        className="w-full h-full object-cover rounded-[1.5rem] md:rounded-[2rem] group-hover:scale-105 transition-transform duration-1000 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 rounded-[2.5rem] pointer-events-none" />
                </div>

                {/* Article Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-16 relative">
                    
                    {/* Left: Content */}
                    <article className="prose prose-lg max-w-none prose-invert text-white prose-headings:text-white prose-a:text-orange-600">
                        <BlogContent content={blog.content} />
                        
                        {/* Tags */}
                        {blog.tags && blog.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-12 pt-8 border-t border-white/10">
                                {blog.tags.map((tag, index) => (
                                    <span
                                        key={index}
                                        className="px-3 py-1 bg-white/5 text-white/60 text-xs font-bold uppercase tracking-wider rounded-md"
                                    >
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </article>

                    {/* Right: Sticky Sidebar */}
                    <aside className="border-t lg:border-t-0 lg:border-l border-white/10 pt-8 lg:pt-0 lg:pl-10">
                        <div className="sticky top-32">
                            <div className="mb-12">
                                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40 mb-4">Author</div>
                                <h3 className="text-lg font-bold mb-3">{blog.author}</h3>
                                <p className="text-sm text-white/60 leading-relaxed mb-6">
                                    Tristique sollicitudin nibh sit amet commodo. Sit amet justo donec enim diam vulputate.
                                </p>
                            </div>

                            <div>
                                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40 mb-4">Share</div>
                                <div className="flex items-center gap-3">
                                    <button onClick={handleShare} className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:bg-white hover:text-black transition-colors">
                                        <Share2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>

                {/* Related Posts */}
                {relatedBlogs.length > 0 && (
                    <div className="mt-24 pt-16 border-t border-white/10">
                        <div className="flex items-center justify-between mb-10">
                            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight">Related News</h2>
                            <Link href="/blogs" className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest border border-white/20 rounded hover:bg-white hover:text-black transition-colors">
                                See All
                            </Link>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {relatedBlogs.map((relatedBlog) => (
                                <BlogCard key={relatedBlog.id} blog={relatedBlog} />
                            ))}
                        </div>
                    </div>
                )}
            </main>

            <Footer />
            </div>
        </div>
    );
}
