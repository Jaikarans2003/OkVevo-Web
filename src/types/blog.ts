export interface BlogPost {
    id: string;
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    featuredImage: string;
    featuredImagePath: string;
    
    // SEO Fields
    seoTitle: string;
    seoDescription: string;
    seoKeywords: string[];
    
    // Metadata
    author: string;
    category: string;
    tags: string[];
    
    // Timestamps
    createdAt: any;
    updatedAt: any;
    publishedAt: any;
    
    // Stats
    views: number;
}
