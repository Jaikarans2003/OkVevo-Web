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
    serverTimestamp 
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
    Check, 
    Image as ImageIcon,
    Video,
    LayoutGrid,
    Tag,
    IndianRupee,
    Loader2,
    Eye,
    Music
} from 'lucide-react';
import Link from 'next/link';
import AdminGuard from '@/components/admin/AdminGuard';

interface MasivProduct {
    id: string;
    name: string;
    type: 'photo' | 'video';
    thumbnails: string[];
    description: string;
    price: number;
    badge1: string;
    badge2: string;
    level?: number;
    audioUrl?: string;
    audioSource?: 'original' | 'custom';
}

function ProductManager() {
    const [products, setProducts] = useState<MasivProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<MasivProduct | null>(null);

    // Form Stats
    const [formData, setFormData] = useState<Partial<MasivProduct>>({
        name: '',
        type: 'photo',
        thumbnails: [],
        description: '',
        price: 0,
        badge1: '',
        badge2: '',
        level: 0,
        audioSource: 'original',
        audioUrl: ''
    });
    const [uploading, setUploading] = useState(false);
    const [audioUploading, setAudioUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [audioProgress, setAudioProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);

    // Fetch Products
    useEffect(() => {
        const q = query(collection(db, 'masiv_products'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedProducts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as MasivProduct[];
            console.log('✅ Loaded products from Firestore:', fetchedProducts.map(p => ({ id: p.id, name: p.name })));
            setProducts(fetchedProducts);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate product name exists before upload
        if (!formData.name?.trim()) {
            alert('Please enter a product name before uploading assets');
            return;
        }

        setUploading(true);
        setUploadProgress(0);

        try {
            const timestamp = Date.now();
            // Sanitize product name for directory: lowercase, replace spaces with hyphens, remove special chars
            const sanitizedProductName = formData.name
                .toLowerCase()
                .trim()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');
            
            // Store in product-specific subdirectory: masiv_catalog/{product-name}/{timestamp}_{filename}
            const storagePath = `masiv_catalog/${sanitizedProductName}/${timestamp}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error("Upload error:", error);
                    alert("Failed to upload image.");
                    setUploading(false);
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    setFormData(prev => ({
                        ...prev,
                        thumbnails: [...(prev.thumbnails || []), downloadURL]
                    }));
                    setUploading(false);
                    console.log('✅ File uploaded to:', storagePath);
                }
            );
        } catch (error) {
            console.error("Error starting upload:", error);
            setUploading(false);
        }
    };

    const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate product name exists before upload
        if (!formData.name?.trim()) {
            alert('Please enter a product name before uploading assets');
            return;
        }

        setAudioUploading(true);
        setAudioProgress(0);

        try {
            const timestamp = Date.now();
            const sanitizedProductName = formData.name
                .toLowerCase()
                .trim()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');
            
            const storagePath = `masiv_catalog/${sanitizedProductName}/audio/${timestamp}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setAudioProgress(progress);
                },
                (error) => {
                    console.error("Audio upload error:", error);
                    alert("Failed to upload audio.");
                    setAudioUploading(false);
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    setFormData(prev => ({
                        ...prev,
                        audioUrl: downloadURL
                    }));
                    setAudioUploading(false);
                    console.log('✅ Audio uploaded to:', storagePath);
                }
            );
        } catch (error) {
            console.error("Error starting audio upload:", error);
            setAudioUploading(false);
        }
    };

    const removeAudio = async () => {
        if (!formData.audioUrl) return;

        try {
            const urlParts = formData.audioUrl.split('/o/')[1]?.split('?')[0];
            if (urlParts) {
                const storagePath = decodeURIComponent(urlParts);
                const storageRef = ref(storage, storagePath);
                await deleteObject(storageRef);
                console.log('✅ Deleted audio file from storage:', storagePath);
            }
        } catch (error) {
            console.error('Error deleting audio from storage:', error);
        }

        setFormData(prev => ({
            ...prev,
            audioUrl: ''
        }));
    };

    const removeThumbnail = async (index: number) => {
        const thumbnailUrl = formData.thumbnails?.[index];
        if (!thumbnailUrl) return;

        try {
            // Delete from Firebase Storage
            // Extract storage path from URL
            const urlParts = thumbnailUrl.split('/o/')[1]?.split('?')[0];
            if (urlParts) {
                const storagePath = decodeURIComponent(urlParts);
                const storageRef = ref(storage, storagePath);
                await deleteObject(storageRef);
                console.log('✅ Deleted old file from storage:', storagePath);
            }
        } catch (error) {
            console.error('Error deleting file from storage:', error);
            // Continue even if deletion fails
        }

        // Remove from form data
        setFormData(prev => ({
            ...prev,
            thumbnails: prev.thumbnails?.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validate required fields
        if (!formData.name?.trim()) {
            alert('Product name is required');
            return;
        }
        if (!formData.description?.trim()) {
            alert('Description is required');
            return;
        }
        if (!formData.thumbnails || formData.thumbnails.length === 0) {
            alert('At least one thumbnail/asset is required');
            return;
        }

        setUploading(true);

        try {
            if (editingProduct) {
                // UPDATE existing product in same document
                console.log('🔄 Updating product with ID:', editingProduct.id);
                console.log('📄 Document path:', `masiv_products/${editingProduct.id}`);
                const docRef = doc(db, 'masiv_products', editingProduct.id);
                await updateDoc(docRef, {
                    name: formData.name,
                    type: formData.type,
                    thumbnails: formData.thumbnails,
                    description: formData.description,
                    price: formData.price,
                    badge1: formData.badge1 || '',
                    badge2: formData.badge2 || '',
                    level: formData.level || 0,
                    audioUrl: formData.audioUrl || '',
                    audioSource: formData.audioSource || 'original',
                    updatedAt: serverTimestamp()
                });
                console.log('✅ Product updated successfully:', editingProduct.id);
                alert('✅ Product updated successfully!');
            } else {
                // CREATE new product
                const docRef = await addDoc(collection(db, 'masiv_products'), {
                    name: formData.name,
                    type: formData.type,
                    thumbnails: formData.thumbnails,
                    description: formData.description,
                    price: formData.price,
                    badge1: formData.badge1 || '',
                    badge2: formData.badge2 || '',
                    level: formData.level || 0,
                    audioUrl: formData.audioUrl || '',
                    audioSource: formData.audioSource || 'original',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                console.log('✅ Product created:', docRef.id);
                alert('✅ Product created successfully!');
            }
            closeModal();
        } catch (error) {
            console.error("Error saving product:", error);
            alert(`❌ Failed to save product: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"?\n\nThis will permanently delete the product and all its assets from storage.`)) return;
        
        try {
            // Find the product to get its thumbnails
            const product = products.find(p => p.id === id);
            
            // Delete all associated files from Firebase Storage
            if (product?.thumbnails) {
                for (const thumbnailUrl of product.thumbnails) {
                    try {
                        const urlParts = thumbnailUrl.split('/o/')[1]?.split('?')[0];
                        if (urlParts) {
                            const storagePath = decodeURIComponent(urlParts);
                            const storageRef = ref(storage, storagePath);
                            await deleteObject(storageRef);
                            console.log('✅ Deleted file from storage:', storagePath);
                        }
                    } catch (error) {
                        console.error('Error deleting file:', error);
                        // Continue deleting other files even if one fails
                    }
                }
            }

            // Delete audio file if it exists
            if (product?.audioUrl) {
                try {
                    const urlParts = product.audioUrl.split('/o/')[1]?.split('?')[0];
                    if (urlParts) {
                        const storagePath = decodeURIComponent(urlParts);
                        const storageRef = ref(storage, storagePath);
                        await deleteObject(storageRef);
                        console.log('✅ Deleted audio file from storage:', storagePath);
                    }
                } catch (error) {
                    console.error('Error deleting audio:', error);
                }
            }
            
            // Delete the Firestore document
            await deleteDoc(doc(db, 'masiv_products', id));
            console.log('✅ Product deleted:', id);
            alert('✅ Product and all assets deleted successfully!');
        } catch (error) {
            console.error("Error deleting product:", error);
            alert(`❌ Failed to delete product: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const openModal = (product?: MasivProduct) => {
        if (product) {
            console.log('📝 Editing product:', { id: product.id, name: product.name });
            setEditingProduct(product);
            setFormData({
                ...product,
                audioSource: product.audioSource || 'original',
                audioUrl: product.audioUrl || ''
            });
        } else {
            console.log('➕ Creating new product');
            setEditingProduct(null);
            setFormData({
                name: '',
                type: 'photo',
                thumbnails: [],
                description: '',
                price: 0,
                badge1: '',
                badge2: '',
                level: 0,
                audioSource: 'original',
                audioUrl: ''
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
        setFormData({
            name: '',
            type: 'photo',
            thumbnails: [],
            description: '',
            price: 0,
            badge1: '',
            badge2: '',
            level: 0,
            audioSource: 'original',
            audioUrl: ''
        });
    };

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 font-sans selection:bg-orange-500/30">
            {/* Header */}
            <header className="max-w-7xl mx-auto mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Product Manager</h1>
                    <p className="text-gray-400">Manage the MASIV trend catalog and thumbnails</p>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-orange-500 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Find products..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-6 outline-none focus:border-orange-500/50 focus:bg-white/10 transition-all font-bold"
                        />
                    </div>
                    <button 
                        onClick={() => openModal()}
                        className="px-8 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-xl shadow-orange-500/10 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Add New
                    </button>
                    <Link href="/okvevo-masiv" target="_blank" className="p-3.5 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-colors">
                        <Eye className="w-5 h-5" />
                    </Link>
                </div>
            </header>

            {/* Grid */}
            <main className="max-w-7xl mx-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
                        <p className="text-white/30 font-bold uppercase tracking-widest text-xs">Syncing with database...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredProducts.map(product => (
                            <div key={product.id} className="group relative bg-[#111] border border-white/10 rounded-[2rem] overflow-hidden hover:border-orange-500/50 transition-all">
                                <div className="aspect-[3/4] overflow-hidden relative">
                                    {product.type === 'video' ? (
                                        <video src={product.thumbnails[0]} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" muted loop onMouseEnter={(e) => e.currentTarget.play()} onMouseLeave={(e) => e.currentTarget.pause()} />
                                    ) : (
                                        <img src={product.thumbnails[0]} alt={product.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
                                    )}
                                    <div className="absolute top-4 left-4 flex gap-2">
                                        <span className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-[9px] font-black tracking-widest uppercase border border-white/10">{product.type}</span>
                                        {product.badge1 && <span className="px-3 py-1 bg-orange-500 rounded-full text-[9px] font-black tracking-widest uppercase text-white">{product.badge1}</span>}
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                                    <div className="absolute bottom-6 left-6 right-6">
                                        <h3 className="text-xl font-black tracking-tight mb-1">{product.name}</h3>
                                        <p className="text-orange-500 font-black text-lg">₹{product.price}</p>
                                    </div>
                                </div>
                                <div className="p-6 flex gap-3">
                                    <button onClick={() => openModal(product)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                                        <Edit2 className="w-3.5 h-3.5" /> Edit
                                    </button>
                                    <button onClick={() => handleDelete(product.id, product.name)} className="px-4 py-3 bg-red-500/5 hover:bg-red-500/20 rounded-xl border border-red-500/10 text-red-500 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
                    <div className="max-w-[1000px] w-full bg-[#111] border border-white/10 rounded-[3rem] overflow-hidden flex flex-col md:flex-row h-[85vh]">
                        {/* Previews / Uploads */}
                        <div className="w-full md:w-1/2 p-10 bg-white/5 border-r border-white/10 flex flex-col gap-6 overflow-y-auto">
                            <h2 className="text-sm font-black uppercase tracking-widest text-white/40 mb-2">Assets & Media</h2>
                            
                            <div className="grid grid-cols-2 gap-4">
                                {formData.thumbnails?.map((url, i) => (
                                    <div key={i} className="aspect-[3/4] bg-black rounded-3xl overflow-hidden relative group border border-white/10">
                                        {formData.type === 'video' ? (
                                            <video src={url} className="w-full h-full object-cover" controls />
                                        ) : (
                                            <img src={url} alt="Thumbnail" className="w-full h-full object-cover" />
                                        )}
                                        <button 
                                            onClick={() => removeThumbnail(i)}
                                            className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="aspect-[3/4] bg-white/5 hover:bg-white/10 border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center gap-4 transition-all"
                                >
                                    {uploading ? (
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-[10px] font-black tracking-widest text-orange-500">{Math.round(uploadProgress)}%</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                                                <Upload className="w-6 h-6" />
                                            </div>
                                            <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">Upload Asset</span>
                                        </>
                                    )}
                                </button>
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept={formData.type === 'video' ? 'video/*' : 'image/*'} onChange={handleFileUpload} />
                        </div>

                        {/* Details */}
                        <form onSubmit={handleSubmit} className="w-full md:w-1/2 grid grid-rows-[auto_1fr_auto] h-full overflow-hidden relative bg-[#111]">
                            {/* Header - Fixed Height */}
                            <div className="p-8 pb-4 flex items-center justify-between border-b border-white/5 bg-[#111] z-10">
                                <h2 className="text-2xl font-black uppercase tracking-tighter">
                                    {editingProduct ? 'Update Product' : 'Build New Trend'}
                                </h2>
                                <button type="button" onClick={closeModal} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/10">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Content - Scrollable Region */}
                            <div className="overflow-y-auto p-8 space-y-10 custom-scrollbar-v2">
                                {/* Type Switch */}
                                <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 gap-2">
                                    <button type="button" onClick={() => setFormData({...formData, type: 'photo'})} className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === 'photo' ? 'bg-orange-500 text-white shadow-lg' : 'text-white/30 hover:text-white'}`}>
                                        <ImageIcon className="w-3.5 h-3.5" /> Photo Trend
                                    </button>
                                    <button type="button" onClick={() => setFormData({...formData, type: 'video'})} className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === 'video' ? 'bg-orange-500 text-white shadow-lg' : 'text-white/30 hover:text-white'}`}>
                                        <Video className="w-3.5 h-3.5" /> Video Trend
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-8">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-3">Product Name</label>
                                        <input required type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-orange-500/50" placeholder="e.g. Nazakat" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-3">Price (INR)</label>
                                        <input required type="number" value={formData.price || 0} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-orange-500/50" placeholder="2499" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-3">Description</label>
                                    <textarea required value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-orange-500/50 min-h-[140px] resize-none" placeholder="Capture your look..." />
                                </div>

                                {/* Audio Settings Section */}
                                <div className="space-y-8 p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                                            <Music className="w-4 h-4 text-orange-500" />
                                        </div>
                                        <h3 className="text-sm font-black uppercase tracking-widest text-white underline underline-offset-8 decoration-orange-500/30">Audio Settings</h3>
                                    </div>

                                    <div className="grid grid-cols-1 gap-8">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-4">Choose Audio Source</label>
                                            <div className="flex bg-black/60 p-2 rounded-2xl border border-white/5 gap-2">
                                                <button 
                                                    type="button" 
                                                    onClick={() => setFormData({...formData, audioSource: 'original'})} 
                                                    className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.audioSource === 'original' ? 'bg-orange-500 text-white shadow-xl translate-y-[-2px]' : 'text-white/20 hover:text-white/40'}`}
                                                >
                                                    Original Video
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setFormData({...formData, audioSource: 'custom'})} 
                                                    className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.audioSource === 'custom' ? 'bg-orange-500 text-white shadow-xl translate-y-[-2px]' : 'text-white/20 hover:text-white/40'}`}
                                                >
                                                    Custom Upload
                                                </button>
                                            </div>
                                        </div>

                                        <div className={`space-y-4 pt-4 border-t border-white/5 transition-all duration-500 ${formData.audioSource === 'custom' ? 'opacity-100 scale-100' : 'opacity-20 scale-[0.98] blur-[2px] pointer-events-none'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Custom Track</label>
                                                <span className="text-[9px] font-bold text-orange-500/50 uppercase italic tracking-tighter">Required for custom audio</span>
                                            </div>
                                            
                                            {formData.audioUrl ? (
                                                <div className="bg-black/40 border border-white/10 rounded-3xl p-6 flex flex-col gap-4 shadow-inner">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white shadow-lg animate-pulse">
                                                                <Music className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-white">Audio Track Ready</p>
                                                                <p className="text-[9px] font-medium text-white/30 truncate max-w-[200px]">Cloud Storage Asset</p>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            type="button"
                                                            onClick={removeAudio}
                                                            className="w-10 h-10 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-full transition-all flex items-center justify-center"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <audio src={formData.audioUrl} controls className="h-10 w-full accent-orange-500 brightness-110" />
                                                </div>
                                            ) : (
                                                <button 
                                                    type="button"
                                                    onClick={() => audioInputRef.current?.click()}
                                                    disabled={audioUploading}
                                                    className="w-full h-44 bg-black/40 hover:bg-black/60 border-2 border-dashed border-white/10 hover:border-orange-500/30 rounded-[2.5rem] flex flex-col items-center justify-center gap-6 transition-all group"
                                                >
                                                    {audioUploading ? (
                                                        <div className="flex flex-col items-center gap-6">
                                                            <div className="relative w-16 h-16">
                                                                <div className="absolute inset-0 border-4 border-orange-500/20 rounded-full" />
                                                                <div className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                    <span className="text-[10px] font-black text-orange-500">{Math.round(audioProgress)}%</span>
                                                                </div>
                                                            </div>
                                                            <span className="text-[10px] font-black tracking-widest text-orange-500/80 uppercase animate-pulse">Uploading Sound...</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-white/10 group-hover:bg-orange-500 group-hover:text-white group-hover:shadow-[0_0_30px_rgba(255,102,0,0.3)] transition-all duration-500">
                                                                <Upload className="w-10 h-10" />
                                                            </div>
                                                            <div className="text-center">
                                                                <p className="text-[11px] font-black tracking-widest text-white/40 uppercase mb-1">Click to browse audio</p>
                                                                <p className="text-[9px] font-medium text-white/20 uppercase tracking-tighter">MP3, WAV, or AAC (Max 10MB)</p>
                                                            </div>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                            <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={handleAudioUpload} />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-8">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-3">Gender/Badge 1</label>
                                        <input type="text" value={formData.badge1 || ''} onChange={e => setFormData({...formData, badge1: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-orange-500/50" placeholder="UNISEX" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-3">Style/Badge 2</label>
                                        <input type="text" value={formData.badge2 || ''} onChange={e => setFormData({...formData, badge2: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-orange-500/50" placeholder="Trending" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-white/40 block mb-3">Display Level</label>
                                        <input type="number" value={formData.level || 0} onChange={e => setFormData({...formData, level: Number(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-orange-500/50" placeholder="0" />
                                    </div>
                                </div>

                                {/* Extra Padding for Scroll */}
                                <div className="h-20" />
                            </div>

                            {/* Footer - Fixed Height */}
                            <div className="p-8 border-t border-white/5 bg-[#111] z-10">
                                <button type="submit" disabled={uploading || audioUploading} className="w-full py-6 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black uppercase tracking-widest text-sm rounded-[2rem] transition-all shadow-2xl shadow-orange-500/40 flex items-center justify-center gap-4 active:scale-[0.98]">
                                    {(uploading || audioUploading) ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : editingProduct ? (
                                        <Check className="w-5 h-5" />
                                    ) : (
                                        <Plus className="w-5 h-5" />
                                    )}
                                    {editingProduct ? 'Update Presence' : 'Launch Trend'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ProductManagerPage() {
    return (
        <AdminGuard>
            <ProductManager />
        </AdminGuard>
    );
}

