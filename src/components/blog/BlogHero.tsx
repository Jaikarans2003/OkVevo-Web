import Link from 'next/link';
import { BlogPost } from '@/types/blog';
import { formatDate } from '@/lib/blogUtils';
import { Calendar, Eye, ArrowRight } from 'lucide-react';

interface BlogHeroProps {
    blog: BlogPost;
}

export default function BlogHero({ blog }: BlogHeroProps) {
    return (
        <Link href={`/blogs/${blog.slug}`}>
            <div className="group relative h-[500px] rounded-3xl overflow-hidden cursor-pointer">
                {/* Background Image */}
                <img
                    src={blog.featuredImage}
                    alt={blog.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                {/* Content */}
                <div className="relative h-full flex flex-col justify-end p-8 md:p-12">
                    {/* Category Badge */}
                    <div className="mb-4">
                        <span className="px-4 py-2 bg-orange-600 text-white text-sm font-bold uppercase tracking-wider rounded-full">
                            Featured • {blog.category}
                        </span>
                    </div>

                    {/* Title */}
                    <h2 className="text-4xl md:text-5xl font-black text-white mb-4 max-w-3xl group-hover:text-orange-400 transition-colors">
                        {blog.title}
                    </h2>

                    {/* Excerpt */}
                    <p className="text-lg text-white/80 mb-6 max-w-2xl line-clamp-2">
                        {blog.excerpt || blog.content.substring(0, 150) + '...'}
                    </p>

                    {/* Meta Info */}
                    <div className="flex items-center gap-6 text-sm text-white/60 mb-6">
                        <div className="flex items-center gap-2">
                            <Calendar size={16} />
                            <span>{formatDate(blog.publishedAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Eye size={16} />
                            <span>{blog.views || 0} views</span>
                        </div>
                        <span>By {blog.author}</span>
                    </div>

                    {/* Read More Button */}
                    <div className="inline-flex items-center gap-2 text-orange-400 font-semibold group-hover:gap-4 transition-all">
                        Read Full Article
                        <ArrowRight size={20} />
                    </div>
                </div>
            </div>
        </Link>
    );
}
