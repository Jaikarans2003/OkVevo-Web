'use client';

import { useState, useEffect } from 'react';
import { db } from '@/config/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { BlogPost } from '@/types/blog';
import { Loader2 } from 'lucide-react';
import BlogCard from '@/components/blog/BlogCard';
import NoiseOverlay from '@/components/NoiseOverlay';
import Navbar from '@/components/ook/Navbar';
import Footer from '@/components/ook/Footer';

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
        <div className="relative min-h-screen bg-[#020202] text-white">
            <NoiseOverlay />
            
            {/* Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none mix-blend-screen" />
            
            {/* Subtle Orange Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[400px] opacity-20 bg-orange-600 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] opacity-10 bg-purple-600 blur-[150px] rounded-full pointer-events-none" />

            <div className="relative z-10">
                <Navbar user={user} onJoinClick={handleJoinClick} theme="dark" />

                <main className="pt-32 md:pt-40 pb-20 max-w-7xl mx-auto px-6">
                
                {/* Split Hero Section */}
                <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-12 lg:gap-16 items-start mb-24">

                    {/* Left Side: Featured Blog */}
                    <div className="order-2 lg:order-1 w-full relative z-20">
                        {filteredBlogs.length > 0 ? (
                            <div className="h-full">
                                <BlogCard blog={filteredBlogs[0]} featured={true} />
                            </div>
                        ) : (
                            <div className="w-full flex items-center justify-center bg-white/[0.02] border border-white/5 rounded-[2rem] aspect-[4/3]">
                                <p className="text-white/40 font-medium tracking-wide">No posts available</p>
                            </div>
                        )}
                    </div>

                    {/* Right Side: Header & Categories */}
                    <div className="order-1 lg:order-2 flex flex-col justify-start text-left pt-2 relative z-20">
                        <h1 className="text-7xl md:text-8xl lg:text-[10rem] font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-orange-400 via-orange-500 to-orange-700 pb-4 mb-6 leading-none">
                            Insights
                        </h1>
                        <p className="text-lg md:text-2xl text-white/50 leading-relaxed font-medium mb-12 max-w-lg">
                            Explore the latest strategies, updates, and breakthroughs in AI-driven video content.
                        </p>
                        
                        {/* Category Filter */}
                        <div className="flex flex-wrap items-center gap-3">
                            {categories.map((category) => (
                                <button
                                    key={category}
                                    onClick={() => setSelectedCategory(category)}
                                    className={`px-6 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] rounded-full border backdrop-blur-md transition-all duration-300 ${
                                        selectedCategory === category
                                            ? 'bg-white text-black border-transparent shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                                            : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white hover:border-white/20'
                                    }`}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Remaining Blogs Grid */}
                {filteredBlogs.length > 1 && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24 relative z-20">
                            {filteredBlogs.slice(1).map((blog) => (
                                <BlogCard key={blog.id} blog={blog} />
                            ))}
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-center space-x-6 border-t border-white/5 pt-16 mb-24 relative z-20">
                            <button className="px-8 py-3 text-xs font-bold uppercase tracking-widest border border-white/10 rounded-full text-white/60 hover:bg-white/5 hover:text-white transition-all duration-300">
                                Previous
                            </button>
                            <button className="px-8 py-3 text-xs font-bold uppercase tracking-widest border border-white/10 rounded-full text-white/60 hover:bg-white/5 hover:text-white transition-all duration-300">
                                Next
                            </button>
                        </div>
                    </>
                )}
                
                {/* Newsletter Block */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-16 bg-white/[0.02] border border-white/10 p-12 rounded-[2.5rem] backdrop-blur-md mt-12 mb-8">
                    <div className="w-full md:w-1/2">
                        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-6 flex items-center gap-4">
                            <span className="w-8 h-[1px] bg-orange-600/50"></span>
                            Newsletter
                        </div>
                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight text-white mb-6">
                            Stay ahead of <br /> the curve
                        </h2>
                        <p className="text-lg text-white/50 leading-relaxed font-medium">
                            Join thousands of creators getting weekly tips on optimizing their AI video workflows and audience growth.
                        </p>
                    </div>
                    
                    <div className="w-full md:w-5/12 bg-black/40 p-2 rounded-2xl border border-white/5 flex items-center shadow-inner">
                        <input 
                            type="email" 
                            placeholder="Enter your email address..." 
                            className="w-full bg-transparent border-none text-white px-6 py-4 outline-none placeholder:text-white/30 text-sm font-medium"
                        />
                        <button className="bg-white text-black font-bold uppercase tracking-widest text-[10px] px-8 py-4 rounded-xl hover:bg-orange-600 hover:text-white transition-all duration-300 shrink-0">
                            Subscribe
                        </button>
                    </div>
                </div>
            </main>

            <Footer />
            </div>
        </div>
    );
}
