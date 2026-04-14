import Link from 'next/link';
import { BlogPost } from '@/types/blog';

interface BlogCardProps {
    blog: BlogPost;
    featured?: boolean;
}

export default function BlogCard({ blog, featured = false }: BlogCardProps) {
    return (
        <Link href={`/blogs/${blog.slug}`} className="group block h-full">
            <div className="flex flex-col h-full bg-white/[0.02] border border-white/5 hover:border-white/20 p-3 lg:p-4 rounded-[2rem] transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50 overflow-hidden relative">
                
                {/* Subtle gradient overlay effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                {/* Featured Image */}
                <div className={`relative w-full overflow-hidden rounded-[1.5rem] mb-6 bg-white/5 ${featured ? 'aspect-[4/3] md:aspect-[16/10]' : 'aspect-[4/3]'}`}>
                    <img
                        src={blog.featuredImage}
                        alt={blog.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]"
                        loading="lazy"
                    />
                    {/* Inner image shadow/vignette */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>

                {/* Content */}
                <div className="flex flex-col px-3 pb-3 flex-grow justify-start">
                    {/* Category & Tags Label */}
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-orange-500/80 bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/10">
                            {blog.category}
                        </span>
                        {blog.tags && blog.tags.length > 0 && (
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30 truncate">
                                {blog.tags[0]}
                            </span>
                        )}
                    </div>
                    
                    {/* Title */}
                    <h3 className={`font-bold text-white/90 leading-snug group-hover:text-white transition-colors duration-300 ${featured ? 'text-3xl md:text-4xl tracking-tight' : 'text-xl tracking-tight'} line-clamp-3`}>
                        {blog.title}
                    </h3>
                </div>
            </div>
        </Link>
    );
}
