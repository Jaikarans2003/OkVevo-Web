'use client';

import { useState, useEffect, useRef } from 'react';
import { db, storage } from '@/config/firebase';
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    orderBy
} from 'firebase/firestore';
import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from 'firebase/storage';
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    Upload,
    X,
    Loader2,
    Eye,
    ArrowLeft,
    Image as ImageIcon
} from 'lucide-react';
import Link from 'next/link';
import AdminGuard from '@/components/admin/AdminGuard';
import { BlogPost } from '@/types/blog';
import { generateSlug } from '@/lib/blogUtils';

function BlogManager() {
    const [blogs, setBlogs] = useState<BlogPost[]>([]);
    const [filteredBlogs, setFilteredBlogs] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBlog, setEditingBlog] = useState<BlogPost | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Form State
    const [formData, setFormData] = useState<Partial<BlogPost>>({
        title: '',
        slug: '',
        content: '',
        excerpt: '',
        featuredImage: '',
        featuredImagePath: '',
        seoTitle: '',
        seoDescription: '',
        seoKeywords: [],
        author: 'OKVEVO Team',
        category: '',
        tags: [],
        views: 0
    });
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [keywordsInput, setKeywordsInput] = useState('');
    const [tagsInput, setTagsInput] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch Blogs
    useEffect(() => {
        const q = query(collection(db, 'blogs'), orderBy('publishedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedBlogs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as BlogPost[];
            setBlogs(fetchedBlogs);
            setFilteredBlogs(fetchedBlogs);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Search/Filter
    useEffect(() => {
        if (!searchTerm) {
            setFilteredBlogs(blogs);
            return;
        }
        const filtered = blogs.filter(blog =>
            blog.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            blog.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            blog.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        setFilteredBlogs(filtered);
    }, [searchTerm, blogs]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadProgress(0);

        try {
            const timestamp = Date.now();
            const storagePath = `blogs/${timestamp}_${file.name}`;
            const storageRef = ref(storage, storagePath);

            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error('Upload error:', error);
                    alert('Failed to upload image');
                    setUploading(false);
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    setFormData(prev => ({
                        ...prev,
                        featuredImage: downloadURL,
                        featuredImagePath: storagePath
                    }));
                    setUploading(false);
                }
            );
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Failed to upload image');
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title || !formData.content || !formData.featuredImage) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            const blogData = {
                ...formData,
                slug: formData.slug || generateSlug(formData.title),
                seoKeywords: keywordsInput.split(',').map(k => k.trim()).filter(Boolean),
                tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
                updatedAt: serverTimestamp(),
            };

            if (editingBlog) {
                // Update existing blog
                await updateDoc(doc(db, 'blogs', editingBlog.id), blogData);
            } else {
                // Create new blog
                await addDoc(collection(db, 'blogs'), {
                    ...blogData,
                    createdAt: serverTimestamp(),
                    publishedAt: serverTimestamp(),
                });
            }

            resetForm();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving blog:', error);
            alert('Failed to save blog post');
        }
    };

    const handleEdit = (blog: BlogPost) => {
        setEditingBlog(blog);
        setFormData(blog);
        setKeywordsInput(blog.seoKeywords.join(', '));
        setTagsInput(blog.tags.join(', '));
        setIsModalOpen(true);
    };

    const handleDelete = async (blog: BlogPost) => {
        if (!confirm(`Are you sure you want to delete "${blog.title}"?`)) return;

        try {
            // Delete image from storage
            if (blog.featuredImagePath) {
                const imageRef = ref(storage, blog.featuredImagePath);
                await deleteObject(imageRef);
            }

            // Delete blog document
            await deleteDoc(doc(db, 'blogs', blog.id));
        } catch (error) {
            console.error('Error deleting blog:', error);
            alert('Failed to delete blog post');
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            slug: '',
            content: '',
            excerpt: '',
            featuredImage: '',
            featuredImagePath: '',
            seoTitle: '',
            seoDescription: '',
            seoKeywords: [],
            author: 'OKVEVO Team',
            category: '',
            tags: [],
            views: 0
        });
        setKeywordsInput('');
        setTagsInput('');
        setEditingBlog(null);
    };

    const handleTitleChange = (title: string) => {
        setFormData(prev => ({
            ...prev,
            title,
            slug: generateSlug(title)
        }));
    };

    return (
        <div className="min-h-screen bg-[#020202] text-white p-8">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8">
                <Link href="/admin" className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors">
                    <ArrowLeft size={20} />
                    Back to Admin
                </Link>

                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-4xl font-black">Blog Management</h1>
                    <button
                        onClick={() => {
                            resetForm();
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors font-semibold"
                    >
                        <Plus size={20} />
                        Create New Post
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                    <input
                        type="text"
                        placeholder="Search blogs by title, category, or tags..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-orange-600"
                    />
                </div>
            </div>

            {/* Blog Table */}
            <div className="max-w-7xl mx-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-orange-600" size={40} />
                    </div>
                ) : filteredBlogs.length === 0 ? (
                    <div className="text-center py-20 text-white/60">
                        {searchTerm ? 'No blogs found matching your search' : 'No blog posts yet. Create your first post!'}
                    </div>
                ) : (
                    <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-white/5 border-b border-white/10">
                                <tr>
                                    <th className="text-left p-4 font-semibold">Image</th>
                                    <th className="text-left p-4 font-semibold">Title</th>
                                    <th className="text-left p-4 font-semibold">Category</th>
                                    <th className="text-left p-4 font-semibold">Author</th>
                                    <th className="text-left p-4 font-semibold">Views</th>
                                    <th className="text-left p-4 font-semibold">Published</th>
                                    <th className="text-right p-4 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBlogs.map((blog) => (
                                    <tr key={blog.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="p-4">
                                            <img
                                                src={blog.featuredImage}
                                                alt={blog.title}
                                                className="w-16 h-16 object-cover rounded-lg"
                                            />
                                        </td>
                                        <td className="p-4">
                                            <div className="font-semibold">{blog.title}</div>
                                            <div className="text-sm text-white/60 mt-1">{blog.slug}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className="px-3 py-1 bg-orange-600/20 text-orange-400 rounded-full text-sm">
                                                {blog.category}
                                            </span>
                                        </td>
                                        <td className="p-4 text-white/80">{blog.author}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <Eye size={16} className="text-white/60" />
                                                <span>{blog.views || 0}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-white/60 text-sm">
                                            {blog.publishedAt?.toDate?.().toLocaleDateString() || 'N/A'}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(blog)}
                                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(blog)}
                                                    className="p-2 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#111] border border-white/10 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                        {/* Fixed Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
                            <h2 className="text-2xl font-black">
                                {editingBlog ? 'Edit Blog Post' : 'Create New Blog Post'}
                            </h2>
                            <button
                                onClick={() => {
                                    setIsModalOpen(false);
                                    resetForm();
                                }}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Scrollable Form Content */}
                        <div data-lenis-prevent className="overflow-y-auto flex-1 p-6 custom-scrollbar">
                            <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-semibold mb-2">Title *</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => handleTitleChange(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-600"
                                    required
                                />
                            </div>
                                
                            {/* Slug */}
                            <div>
                                <label className="block text-sm font-semibold mb-2">Slug (URL)</label>
                                <input
                                    type="text"
                                    value={formData.slug}
                                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-600"
                                    placeholder="auto-generated-from-title"
                                />
                            </div>

                            {/* Content */}
                            <div>
                                <label className="block text-sm font-semibold mb-2">Content *</label>
                                <div className="mb-2 p-3 bg-blue-600/10 border border-blue-600/20 rounded-lg text-xs text-blue-400">
                                    <p className="font-semibold mb-1">💡 Formatting Tips:</p>
                                    <p className="mb-1">• <strong>Tables:</strong> Use markdown format: | Header 1 | Header 2 |</p>
                                    <p>• <strong>Graphs:</strong> Use [GRAPH: Description] or [CHART: Description]</p>
                                </div>
                                <textarea
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    rows={12}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-600 resize-none font-mono text-sm"
                                    placeholder="Write your blog content here...

Example table:
| Feature | Price | Status |
|---------|-------|--------|
| Basic | $10 | Active |
| Pro | $20 | Active |

Example graph:
[GRAPH: Monthly Revenue Growth Chart]"
                                    required
                                />
                            </div>

                            {/* Excerpt */}
                            <div>
                                <label className="block text-sm font-semibold mb-2">Excerpt (150 chars)</label>
                                <textarea
                                    value={formData.excerpt}
                                    onChange={(e) => setFormData({ ...formData, excerpt: e.target.value.slice(0, 150) })}
                                    rows={3}
                                    maxLength={150}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-600 resize-none"
                                    placeholder="Short summary for blog cards..."
                                />
                                <div className="text-xs text-white/40 mt-1">{formData.excerpt?.length || 0}/150</div>
                            </div>

                            {/* Featured Image */}
                            <div>
                                <label className="block text-sm font-semibold mb-2">Featured Image *</label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                                >
                                    {uploading ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} />
                                            Uploading... {Math.round(uploadProgress)}%
                                        </>
                                    ) : formData.featuredImage ? (
                                        <>
                                            <ImageIcon size={20} />
                                            Change Image
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={20} />
                                            Upload Image
                                        </>
                                    )}
                                </button>
                                {formData.featuredImage && (
                                    <img
                                        src={formData.featuredImage}
                                        alt="Preview"
                                        className="mt-4 w-full h-48 object-cover rounded-lg"
                                    />
                                )}
                            </div>

                            {/* SEO Title */}
                            <div>
                                <label className="block text-sm font-semibold mb-2">SEO Title</label>
                                <input
                                    type="text"
                                    value={formData.seoTitle}
                                    onChange={(e) => setFormData({ ...formData, seoTitle: e.target.value })}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-600"
                                    placeholder="Custom title for search engines"
                                />
                            </div>

                            {/* SEO Description */}
                            <div>
                                <label className="block text-sm font-semibold mb-2">SEO Description</label>
                                <textarea
                                    value={formData.seoDescription}
                                    onChange={(e) => setFormData({ ...formData, seoDescription: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-600 resize-none"
                                    placeholder="Meta description for search engines"
                                />
                            </div>

                            {/* SEO Keywords */}
                            <div>
                                <label className="block text-sm font-semibold mb-2">SEO Keywords (comma-separated)</label>
                                <input
                                    type="text"
                                    value={keywordsInput}
                                    onChange={(e) => setKeywordsInput(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-600"
                                    placeholder="AI video, Instagram reels, tutorials"
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-sm font-semibold mb-2">Category</label>
                                <input
                                    type="text"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-600"
                                    placeholder="e.g., Tutorials, Updates, Tips"
                                />
                            </div>

                            {/* Tags */}
                            <div>
                                <label className="block text-sm font-semibold mb-2">Tags (comma-separated)</label>
                                <input
                                    type="text"
                                    value={tagsInput}
                                    onChange={(e) => setTagsInput(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-600"
                                    placeholder="Instagram, AI, Video, Social Media"
                                />
                            </div>

                            {/* Author */}
                            <div>
                                <label className="block text-sm font-semibold mb-2">Author</label>
                                <input
                                    type="text"
                                    value={formData.author}
                                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-orange-600"
                                />
                            </div>

                            {/* Submit Buttons */}
                            <div className="flex gap-4 pt-4">
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="flex-1 px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-600/50 rounded-lg font-semibold transition-colors"
                                >
                                    {editingBlog ? 'Update Post' : 'Create Post'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsModalOpen(false);
                                        resetForm();
                                    }}
                                    className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-lg font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AdminBlogsPage() {
    return (
        <AdminGuard>
            <BlogManager />
        </AdminGuard>
    );
}
