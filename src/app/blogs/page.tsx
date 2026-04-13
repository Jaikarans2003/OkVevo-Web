'use client';

import { useState, useEffect } from 'react';
import { db } from '@/config/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { BlogPost } from '@/types/blog';
import BlogHero from '@/components/blog/BlogHero';
import BlogCard from '@/components/blog/BlogCard';
import { Loader2 } from 'lucide-react';
import Navbar from '@/components/ook/Navbar';
import Footer from '@/components/ook/Footer';
import NoiseOverlay from '@/components/NoiseOverlay';

export default function BlogsPage() {
    const [blogs, setBlogs] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        fetchBlogs();
    }, []);

    const fetchBlogs = async () => {
        try {
            const q = query(collection(db, 'blogs'), orderBy('publishedAt', 'desc'));
            const snapshot = await getDocs(q);
            const fetchedBlogs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as BlogPost[];
            setBlogs(fetchedBlogs);
        } catch (error) {
            console.error('Error fetching blogs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleJoinClick = () => {
        window.location.href = user ? '/workspace' : '/login';
    };

    // Get unique categories
    const categories = ['All', ...Array.from(new Set(blogs.map(blog => blog.category).filter(Boolean)))];

    // Filter blogs by category
    const filteredBlogs = selectedCategory === 'All'
        ? blogs
        : blogs.filter(blog => blog.category === selectedCategory);

    const featuredBlog = filteredBlogs[0];
    const otherBlogs = filteredBlogs.slice(1);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#020202] flex items-center justify-center">
                <Loader2 className="animate-spin text-orange-600" size={48} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020202] text-white">
            <NoiseOverlay />
            <Navbar user={user} onJoinClick={handleJoinClick} />

            <main className="pt-32 pb-20">
                <div className="max-w-7xl mx-auto px-6">
                    {/* Header */}
                    <div className="mb-12 text-center">
                        <h1 className="text-5xl md:text-6xl font-black mb-4">
                            OKVEVO <span className="text-orange-600">Blog</span>
                        </h1>
                        <p className="text-xl text-white/60 max-w-2xl mx-auto">
                            Learn about AI video generation, Instagram reels, YouTube shorts, and faceless content creation
                        </p>
                    </div>

                    {/* Category Filter */}
                    <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
                        {categories.map((category) => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={`px-6 py-2 rounded-full font-semibold transition-all ${
                                    selectedCategory === category
                                        ? 'bg-orange-600 text-white'
                                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                                }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>

                    {filteredBlogs.length === 0 ? (
                        <div className="text-center py-20">
                            <p className="text-white/60 text-lg">No blog posts yet. Check back soon!</p>
                        </div>
                    ) : (
                        <>
                            {/* Featured Blog Hero */}
                            {featuredBlog && (
                                <div className="mb-16">
                                    <BlogHero blog={featuredBlog} />
                                </div>
                            )}

                            {/* Other Blogs Grid */}
                            {otherBlogs.length > 0 && (
                                <>
                                    <h2 className="text-3xl font-black mb-8">Latest Articles</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                        {otherBlogs.map((blog) => (
                                            <BlogCard key={blog.id} blog={blog} />
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </main>

            <Footer />
        </div>
    );
}
