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
    Check, 
    Image as ImageIcon,
    Video,
    LayoutGrid,
    Loader2,
    Eye,
    ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import AdminGuard from '@/components/admin/AdminGuard';

interface MasivBanner {
    id: string;
    title: string;
    description: string;
    mediaUrl: string;
    type: 'photo' | 'video';
    badge: string;
    level: number;
}

function BannerManager() {
    const [banners, setBanners] = useState<MasivBanner[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState<MasivBanner | null>(null);

    // Form Stats
    const [formData, setFormData] = useState<Partial<MasivBanner>>({
        title: '',
        description: '',
        mediaUrl: '',
        type: 'photo',
        badge: '',
        level: 0
    });
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch Banners
    useEffect(() => {
        const q = query(collection(db, 'masiv_banners'), orderBy('level', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedBanners = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as MasivBanner[];
            setBanners(fetchedBanners);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadProgress(0);

        try {
            const timestamp = Date.now();
            const storagePath = `masiv_banners/${timestamp}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error("Upload error:", error);
                    alert("Failed to upload media.");
                    setUploading(false);
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    setFormData(prev => ({
                        ...prev,
                        mediaUrl: downloadURL
                    }));
                    setUploading(false);
                }
            );
        } catch (error) {
            console.error("Error starting upload:", error);
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.title?.trim() || !formData.mediaUrl) {
            alert('Title and Media are required');
            return;
        }

        setUploading(true);

        try {
            const bannerData = {
                title: formData.title,
                description: formData.description || '',
                mediaUrl: formData.mediaUrl,
                type: formData.type,
                badge: formData.badge || '',
                level: Number(formData.level) || 0,
                updatedAt: serverTimestamp()
            };

            if (editingBanner) {
                await updateDoc(doc(db, 'masiv_banners', editingBanner.id), bannerData);
                alert('✅ Banner updated successfully!');
            } else {
                await addDoc(collection(db, 'masiv_banners'), {
                    ...bannerData,
                    createdAt: serverTimestamp()
                });
                alert('✅ Banner created successfully!');
            }
            closeModal();
        } catch (error) {
            console.error("Error saving banner:", error);
            alert(`❌ Failed to save banner`);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string, mediaUrl: string) => {
        if (!confirm(`Delete this banner?`)) return;
        
        try {
            // Delete from Storage
            const urlParts = mediaUrl.split('/o/')[1]?.split('?')[0];
            if (urlParts) {
                const storagePath = decodeURIComponent(urlParts);
                await deleteObject(ref(storage, storagePath));
            }
            
            // Delete from Firestore
            await deleteDoc(doc(db, 'masiv_banners', id));
            alert('✅ Banner deleted!');
        } catch (error) {
            console.error("Error deleting banner:", error);
        }
    };

    const openModal = (banner?: MasivBanner) => {
        if (banner) {
            setEditingBanner(banner);
            setFormData(banner);
        } else {
            setEditingBanner(null);
            setFormData({
                title: '',
                description: '',
                mediaUrl: '',
                type: 'photo',
                badge: '',
                level: banners.length
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingBanner(null);
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 font-sans">
            <header className="max-w-7xl mx-auto mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                    <Link href="/admin" className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Banner Manager</h1>
                        <p className="text-gray-400">Manage the hero carousel ads/featured items</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={() => openModal()}
                        className="px-8 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-xl shadow-orange-500/10 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Add Banner
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {banners.map(banner => (
                            <div key={banner.id} className="group relative bg-[#111] border border-white/10 rounded-[2.5rem] overflow-hidden hover:border-orange-500/50 transition-all flex flex-col">
                                <div className="aspect-video overflow-hidden relative bg-black">
                                    {banner.type === 'video' ? (
                                        <video src={banner.mediaUrl} className="w-full h-full object-contain" muted loop onMouseEnter={(e) => e.currentTarget.play()} onMouseLeave={(e) => e.currentTarget.pause()} />
                                    ) : (
                                        <img src={banner.mediaUrl} alt={banner.title} className="w-full h-full object-contain" />
                                    )}
                                    <div className="absolute top-4 left-4 flex gap-2">
                                        <span className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-[9px] font-black uppercase border border-white/10">{banner.type}</span>
                                        {banner.badge && <span className="px-3 py-1 bg-orange-500 rounded-full text-[9px] font-black uppercase text-white">{banner.badge}</span>}
                                    </div>
                                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black border border-white/10">LVL {banner.level}</div>
                                </div>
                                <div className="p-8 flex flex-col flex-1">
                                    <h3 className="text-2xl font-black tracking-tighter mb-2" dangerouslySetInnerHTML={{ __html: banner.title }} />
                                    <p className="text-gray-400 text-sm mb-6 flex-1">{banner.description}</p>
                                    <div className="flex gap-3">
                                        <button onClick={() => openModal(banner)} className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                                            <Edit2 className="w-3.5 h-3.5" /> Edit
                                        </button>
                                        <button onClick={() => handleDelete(banner.id, banner.mediaUrl)} className="px-5 py-3.5 bg-red-500/5 hover:bg-red-500/20 rounded-xl border border-red-500/10 text-red-500 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {isModalOpen && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
                    <div className="max-w-[900px] w-full bg-[#111] border border-white/10 rounded-[3rem] overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
                        <div className="w-full md:w-1/2 p-10 bg-white/5 border-r border-white/10 flex flex-col gap-6 overflow-y-auto">
                            <h2 className="text-xs font-black uppercase tracking-widest text-white/40">Banner Media</h2>
                            <div className="aspect-video bg-black rounded-3xl overflow-hidden relative group border border-white/10 flex items-center justify-center">
                                {formData.mediaUrl ? (
                                    <>
                                        {formData.type === 'video' ? (
                                            <video src={formData.mediaUrl} className="w-full h-full object-contain" controls />
                                        ) : (
                                            <img src={formData.mediaUrl} alt="Preview" className="w-full h-full object-contain" />
                                        )}
                                        <button onClick={() => setFormData({...formData, mediaUrl: ''})} className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
                                    </>
                                ) : (
                                    <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full h-full flex flex-col items-center justify-center gap-4 hover:bg-white/5 transition-colors">
                                        {uploading ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                                                <span className="text-[10px] font-black">{Math.round(uploadProgress)}%</span>
                                            </div>
                                        ) : (
                                            <>
                                                <Upload className="w-8 h-8 text-orange-500" />
                                                <span className="text-[10px] font-black uppercase text-white/40">Upload Media</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />
                            
                            <div className="space-y-4 pt-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-2">Display Level (Sorting)</label>
                                    <input type="number" value={formData.level || 0} onChange={e => setFormData({...formData, level: Number(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 font-bold outline-none focus:border-orange-500/50" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-2">Media Type</label>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => setFormData({...formData, type: 'photo'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${formData.type === 'photo' ? 'bg-orange-500' : 'bg-white/5'}`}>Photo</button>
                                        <button type="button" onClick={() => setFormData({...formData, type: 'video'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${formData.type === 'video' ? 'bg-orange-500' : 'bg-white/5'}`}>Video</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="w-full md:w-1/2 p-10 flex flex-col overflow-y-auto">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-black uppercase tracking-tighter">{editingBanner ? 'Edit Banner' : 'New Banner'}</h2>
                                <button type="button" onClick={closeModal} className="p-2 hover:bg-white/5 rounded-full"><X className="w-6 h-6" /></button>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-2">Title (supports &lt;br/&gt;)</label>
                                    <input required type="text" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 font-bold outline-none focus:border-orange-500/50" placeholder="e.g. DHURANDHAR <br/> ENERGY" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-2">Description</label>
                                    <textarea required value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 font-bold outline-none focus:border-orange-500/50 min-h-[100px]" placeholder="Brief description..." />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-2">Badge Text</label>
                                    <input type="text" value={formData.badge || ''} onChange={e => setFormData({...formData, badge: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 font-bold outline-none focus:border-orange-500/50" placeholder="e.g. UNISEX" />
                                </div>
                            </div>
                            <button type="submit" disabled={uploading} className="mt-10 w-full py-5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-xl shadow-orange-500/20 flex items-center justify-center gap-3">
                                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                {editingBanner ? 'Save Changes' : 'Publish Banner'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function BannerManagerPage() {
    return (
        <AdminGuard>
            <BannerManager />
        </AdminGuard>
    );
}
