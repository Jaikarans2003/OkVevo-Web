import Link from 'next/link';
import { BlogPost } from '@/types/blog';
import { formatDate, truncateText } from '@/lib/blogUtils';
import { Calendar, Eye } from 'lucide-react';

interface BlogCardProps {
    blog: BlogPost;
}

export default function BlogCard({ blog }: BlogCardProps) {
    return (
        <Link href={`/blogs/${blog.slug}`}>
            <div className="group bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-orange-600/50 transition-all duration-300 hover:scale-[1.02]">
                {/* Featured Image */}
                <div className="relative h-48 overflow-hidden">
                    <img
                        src={blog.featuredImage}
                        alt={blog.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    
                    {/* Category Badge */}
                    <div className="absolute top-4 left-4">
                        <span className="px-3 py-1 bg-orange-600 text-white text-xs font-bold uppercase tracking-wider rounded-full">
                            {blog.category}
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-orange-400 transition-colors line-clamp-2">
                        {blog.title}
                    </h3>
                    
                    <p className="text-white/60 text-sm mb-4 line-clamp-3">
                        {blog.excerpt || truncateText(blog.content, 120)}
                    </p>

                    {/* Meta Info */}
                    <div className="flex items-center gap-4 text-xs text-white/40">
                        <div className="flex items-center gap-1">
                            <Calendar size={14} />
                            <span>{formatDate(blog.publishedAt)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Eye size={14} />
                            <span>{blog.views || 0} views</span>
                        </div>
                    </div>

                    {/* Tags */}
                    {blog.tags && blog.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4">
                            {blog.tags.slice(0, 3).map((tag, index) => (
                                <span
                                    key={index}
                                    className="px-2 py-1 bg-white/5 text-white/60 text-xs rounded-full"
                                >
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}
