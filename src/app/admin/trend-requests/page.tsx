'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, storage } from '@/config/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Shield, ArrowLeft, Clock, CheckCircle, Trash2, ExternalLink, User, Image as ImageIcon, UploadCloud, ShoppingCart, X } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import AdminGuard from '@/components/admin/AdminGuard';

interface TrendRequest {
    id: string;
    userId: string;
    userEmail: string;
    userName: string;
    trendId: string;
    trendName: string;
    price: number;
    fullBodyUrl: string;
    faceUrl: string;
    status: 'pending' | 'processing' | 'completed';
    createdAt: Timestamp;
}

interface MasivOrder {
    id: string;
    orderId?: string;
    userId: string;
    userEmail?: string;
    userName?: string;
    customerName?: string;
    whatsappNumber?: string;
    email?: string;
    
    // Old format (single item)
    trendId?: string;
    trendName?: string;
    trendType?: string;
    price?: number;
    fullBodyImageUrl?: string;
    faceImageUrl?: string | null;
    
    // New format (multiple items)
    items?: Array<{
        trendId?: string;
        id?: string;
        trendName?: string;
        name?: string;
        trendType?: string;
        price?: number;
        fullBodyImageUrl?: string;
        faceImageUrl?: string | null;
    }>;
    
    totalAmount?: number;
    paymentStatus?: 'pending' | 'paid' | 'failed';
    isVerified?: boolean;  // Webhook verification flag
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    
    status: 'pending' | 'processing' | 'completed' | 'failed';
    createdAt: Timestamp;
    paidAt?: Timestamp;
}

function TrendRequestsAdmin() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState<TrendRequest[]>([]);
    const [masivOrders, setMasivOrders] = useState<MasivOrder[]>([]);
    const [activeTab, setActiveTab] = useState<'trend_requests' | 'masiv_orders'>('masiv_orders');
    const [error, setError] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [uploadingId, setUploadingId] = useState<string | null>(null);

    // Auth is handled by AdminGuard
    useEffect(() => {
        setLoading(false);
    }, []);

    // Live data from Firestore - Trend Requests
    useEffect(() => {
        if (loading) return;

        const q = query(collection(db, 'trend_requests'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const reqData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as TrendRequest[];
            setRequests(reqData);
        }, (err) => {
            console.error('Firestore Error:', err);
            setError('Failed to load requests.');
        });

        return () => unsubscribe();
    }, [loading]);

    // Live data from Firestore - Masiv Orders
    useEffect(() => {
        if (loading) return;

        const q = query(collection(db, 'masiv_orders'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const orderData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as MasivOrder[];
            setMasivOrders(orderData);
        }, (err) => {
            console.error('Firestore Error (Masiv Orders):', err);
        });

        return () => unsubscribe();
    }, [loading]);

    const updateStatus = async (id: string, newStatus: string, collection_name: string = 'trend_requests') => {
        try {
            await updateDoc(doc(db, collection_name, id), { status: newStatus });
        } catch (err) {
            console.error('Update Error:', err);
            alert('Failed to update status.');
        }
    };

    const deleteMasivOrder = async (id: string) => {
        if (!confirm('Are you sure you want to delete this order?')) return;
        try {
            await deleteDoc(doc(db, 'masiv_orders', id));
        } catch (err) {
            console.error('Delete Error:', err);
            alert('Failed to delete order.');
        }
    };

    const handleUploadResult = async (id: string, file: File) => {
        if (!file) return;

        setUploadingId(id);
        try {
            // 1. Upload to Storage
            const resultRef = ref(storage, `trend_results/${id}_${Date.now()}.jpg`);
            await uploadBytes(resultRef, file);
            const resultUrl = await getDownloadURL(resultRef);

            // 2. Update Firestore
            await updateDoc(doc(db, 'trend_requests', id), { 
                resultUrl,
                status: 'completed'
            });
            
            alert('Output uploaded successfully!');
        } catch (err) {
            console.error('Upload Error:', err);
            alert('Failed to upload result.');
        } finally {
            setUploadingId(null);
        }
    };

    const deleteRequest = async (id: string) => {
        if (!confirm('Are you sure you want to delete this request?')) return;
        try {
            await deleteDoc(doc(db, 'trend_requests', id));
        } catch (err) {
            console.error('Delete Error:', err);
            alert('Failed to delete request.');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white p-8">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <Link href="/admin" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4 group">
                        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                        Back to User Management
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#FF6B35]/10 flex items-center justify-center border border-[#FF6B35]/20">
                            <Shield className="w-6 h-6 text-[#FF6B35]" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tighter uppercase">Order Management</h1>
                            <p className="text-gray-400 text-sm">Manage MASIV orders and trend requests</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="bg-[#111] border border-white/5 p-4 rounded-2xl min-w-[150px]">
                        <p className="text-xs text-gray-500 uppercase font-black mb-1">MASIV Orders</p>
                        <p className="text-2xl font-black text-[#FF6B35]">
                            {masivOrders.filter(r => r.status === 'pending').length}
                        </p>
                    </div>
                    <div className="bg-[#111] border border-white/5 p-4 rounded-2xl min-w-[150px]">
                        <p className="text-xs text-gray-500 uppercase font-black mb-1">Completed</p>
                        <p className="text-2xl font-black text-green-500">
                            {masivOrders.filter(r => r.status === 'completed').length}
                        </p>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="flex gap-4 border-b border-white/5">
                    <button
                        onClick={() => setActiveTab('masiv_orders')}
                        className={`px-6 py-3 font-black uppercase tracking-widest text-sm transition-all relative ${
                            activeTab === 'masiv_orders'
                                ? 'text-[#FF6B35]'
                                : 'text-gray-500 hover:text-white'
                        }`}
                    >
                        MASIV Orders ({masivOrders.length})
                        {activeTab === 'masiv_orders' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B35]" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('trend_requests')}
                        className={`px-6 py-3 font-black uppercase tracking-widest text-sm transition-all relative ${
                            activeTab === 'trend_requests'
                                ? 'text-[#FF6B35]'
                                : 'text-gray-500 hover:text-white'
                        }`}
                    >
                        Trend Requests ({requests.length})
                        {activeTab === 'trend_requests' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B35]" />
                        )}
                    </button>
                </div>
            </div>

            {/* MASIV Orders Table */}
            {activeTab === 'masiv_orders' && (
                <div className="max-w-7xl mx-auto">
                    <div className="bg-[#111] border border-white/5 rounded-[32px] overflow-hidden shadow-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#181818] border-b border-white/5">
                                        <th className="px-6 py-5 text-xs font-black uppercase tracking-widest text-gray-500">User Details</th>
                                        <th className="px-6 py-5 text-xs font-black uppercase tracking-widest text-gray-500">Trend Information</th>
                                        <th className="px-6 py-5 text-xs font-black uppercase tracking-widest text-gray-500">Uploaded Photos</th>
                                        <th className="px-6 py-5 text-xs font-black uppercase tracking-widest text-gray-500">Status</th>
                                        <th className="px-6 py-5 text-xs font-black uppercase tracking-widest text-gray-500 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {masivOrders.map((order) => (
                                        <tr key={order.id} className="hover:bg-white/[0.02] transition-colors group">
                                            {/* User Info */}
                                            <td className="px-6 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden">
                                                        <User className="w-5 h-5 text-gray-400" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm">{order.userName || order.userEmail?.split('@')[0] || order.customerName || 'Unknown User'}</p>
                                                        <p className="text-xs text-gray-500">{order.userEmail || order.email || 'No email'}</p>
                                                        {order.whatsappNumber && (
                                                            <p className="text-xs text-green-500 mt-1">📱 {order.whatsappNumber}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Trend Info */}
                                            <td className="px-6 py-6">
                                                {order.items ? (
                                                    // New format: multiple items
                                                    <>
                                                        <p className="font-bold text-sm text-[#FF6B35] mb-2">
                                                            Order #{order.orderId?.slice(-8)}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mb-1">
                                                            {order.items.length} item{order.items.length > 1 ? 's' : ''} • ₹{order.totalAmount}
                                                        </p>
                                                        <div className="text-[10px] text-gray-600 space-y-0.5">
                                                            {order.items.map((item, idx) => (
                                                                <p key={idx}>• {item.trendName || item.name || 'Unknown Trend'}</p>
                                                            ))}
                                                        </div>
                                                        <div className="flex gap-2 mt-2">
                                                            {order.paymentStatus && (
                                                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                    order.paymentStatus === 'paid' 
                                                                        ? 'bg-green-500/20 text-green-500'
                                                                        : order.paymentStatus === 'failed'
                                                                        ? 'bg-red-500/20 text-red-500'
                                                                        : 'bg-yellow-500/20 text-yellow-500'
                                                                }`}>
                                                                    {order.paymentStatus.toUpperCase()}
                                                                </span>
                                                            )}
                                                            {order.paymentStatus === 'paid' && (
                                                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                    order.isVerified 
                                                                        ? 'bg-blue-500/20 text-blue-400'
                                                                        : 'bg-orange-500/20 text-orange-400'
                                                                }`}>
                                                                    {order.isVerified ? '✓ VERIFIED' : '⚠ PENDING'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </>
                                                ) : (
                                                    // Old format: single item
                                                    <>
                                                        <p className="font-bold text-sm text-[#FF6B35]">{order.trendName}</p>
                                                        <p className="text-xs text-gray-500">₹{order.price} • {order.trendType}</p>
                                                    </>
                                                )}
                                                <p className="text-[10px] text-gray-600 mt-1">
                                                    {order.createdAt?.toDate().toLocaleString()}
                                                </p>
                                            </td>

                                            {/* Uploaded Photos */}
                                            <td className="px-6 py-6">
                                                <div className="flex gap-2 flex-wrap max-w-[200px]">
                                                    {order.items ? (
                                                        // New format: show all photos from all items
                                                        order.items.map((item, idx) => (
                                                            <div key={idx} className="flex gap-2">
                                                                <div 
                                                                    onClick={() => setSelectedImage(item.fullBodyImageUrl || null)}
                                                                    className="w-12 h-12 rounded-lg bg-[#222] border border-white/10 overflow-hidden cursor-pointer hover:border-[#FF6B35] transition-colors relative group/img"
                                                                >
                                                                    <img src={item.fullBodyImageUrl} alt="Full Body" className="w-full h-full object-cover" />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                                                        <ExternalLink className="w-3 h-3 text-white" />
                                                                    </div>
                                                                </div>
                                                                {item.faceImageUrl && (
                                                                    <div 
                                                                        onClick={() => setSelectedImage(item.faceImageUrl || null)}
                                                                        className="w-12 h-12 rounded-lg bg-[#222] border border-white/10 overflow-hidden cursor-pointer hover:border-[#FF6B35] transition-colors relative group/img"
                                                                    >
                                                                        <img src={item.faceImageUrl} alt="Face" className="w-full h-full object-cover" />
                                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                                                            <ExternalLink className="w-3 h-3 text-white" />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        // Old format: single item photos
                                                        <>
                                                            {order.fullBodyImageUrl && (
                                                                <div 
                                                                    onClick={() => setSelectedImage(order.fullBodyImageUrl!)}
                                                                    className="w-14 h-14 rounded-lg bg-[#222] border border-white/10 overflow-hidden cursor-pointer hover:border-[#FF6B35] transition-colors relative group/img"
                                                                >
                                                                    <img src={order.fullBodyImageUrl} alt="Full Body" className="w-full h-full object-cover" />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                                                        <ExternalLink className="w-4 h-4 text-white" />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {order.faceImageUrl && (
                                                                <div 
                                                                    onClick={() => setSelectedImage(order.faceImageUrl!)}
                                                                    className="w-14 h-14 rounded-lg bg-[#222] border border-white/10 overflow-hidden cursor-pointer hover:border-[#FF6B35] transition-colors relative group/img"
                                                                >
                                                                    <img src={order.faceImageUrl} alt="Face" className="w-full h-full object-cover" />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                                                        <ExternalLink className="w-4 h-4 text-white" />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td className="px-6 py-6">
                                                <select 
                                                    value={order.status}
                                                    onChange={(e) => updateStatus(order.id, e.target.value, 'masiv_orders')}
                                                    className={`text-xs font-bold px-3 py-1.5 rounded-full border bg-transparent transition-all outline-none cursor-pointer ${
                                                        order.status === 'completed' 
                                                            ? 'border-green-500/30 text-green-500 hover:bg-green-500/10'
                                                            : order.status === 'processing'
                                                            ? 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10'
                                                            : 'border-white/10 text-gray-400 hover:bg-white/5'
                                                    }`}
                                                >
                                                    <option value="pending" className="bg-[#111]">Pending</option>
                                                    <option value="processing" className="bg-[#111]">Processing</option>
                                                    <option value="completed" className="bg-[#111]">Completed</option>
                                                </select>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-6 text-right">
                                                <button 
                                                    onClick={() => deleteMasivOrder(order.id)}
                                                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                    {masivOrders.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center text-gray-600">
                                                <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-10" />
                                                <p className="font-bold">No MASIV orders yet</p>
                                                <p className="text-sm">Orders will appear here when users add trends to cart</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Trend Requests Table */}
            {activeTab === 'trend_requests' && (
                <div className="max-w-7xl mx-auto">
                    <div className="bg-[#111] border border-white/5 rounded-[32px] overflow-hidden shadow-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#181818] border-b border-white/5">
                                        <th className="px-6 py-5 text-xs font-black uppercase tracking-widest text-gray-500">User Details</th>
                                        <th className="px-6 py-5 text-xs font-black uppercase tracking-widest text-gray-500">Trend Information</th>
                                        <th className="px-6 py-5 text-xs font-black uppercase tracking-widest text-gray-500">Uploaded Assets</th>
                                        <th className="px-6 py-5 text-xs font-black uppercase tracking-widest text-gray-500">Status</th>
                                        <th className="px-6 py-5 text-xs font-black uppercase tracking-widest text-gray-500 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {requests.map((req) => (
                                    <tr key={req.id} className="hover:bg-white/[0.02] transition-colors group">
                                        {/* User Info */}
                                        <td className="px-6 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden">
                                                    <User className="w-5 h-5 text-gray-400" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm">{req.userName}</p>
                                                    <p className="text-xs text-gray-500">{req.userEmail}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Trend Info */}
                                        <td className="px-6 py-6">
                                            <p className="font-bold text-sm text-[#FF6B35]">{req.trendName}</p>
                                            <p className="text-xs text-gray-500">₹{req.price}</p>
                                            <p className="text-[10px] text-gray-600 mt-1">
                                                {req.createdAt?.toDate().toLocaleString()}
                                            </p>
                                        </td>

                                        {/* Assets */}
                                        <td className="px-6 py-6">
                                            <div className="flex gap-3">
                                                <div 
                                                    onClick={() => setSelectedImage(req.fullBodyUrl)}
                                                    className="w-14 h-14 rounded-lg bg-[#222] border border-white/10 overflow-hidden cursor-pointer hover:border-[#FF6B35] transition-colors relative group/img"
                                                >
                                                    <img src={req.fullBodyUrl} alt="Body" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                                        <ExternalLink className="w-4 h-4 text-white" />
                                                    </div>
                                                </div>
                                                {req.faceUrl && (
                                                    <div 
                                                        onClick={() => setSelectedImage(req.faceUrl)}
                                                        className="w-14 h-14 rounded-lg bg-[#222] border border-white/10 overflow-hidden cursor-pointer hover:border-[#FF6B35] transition-colors relative group/img"
                                                    >
                                                        <img src={req.faceUrl} alt="Face" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                                            <ExternalLink className="w-4 h-4 text-white" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="px-6 py-6">
                                            <select 
                                                value={req.status}
                                                onChange={(e) => updateStatus(req.id, e.target.value)}
                                                className={`text-xs font-bold px-3 py-1.5 rounded-full border bg-transparent transition-all outline-none cursor-pointer ${
                                                    req.status === 'completed' 
                                                        ? 'border-green-500/30 text-green-500 hover:bg-green-500/10'
                                                        : req.status === 'processing'
                                                        ? 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10'
                                                        : 'border-white/10 text-gray-400 hover:bg-white/5'
                                                }`}
                                            >
                                                <option value="pending" className="bg-[#111]">Pending</option>
                                                <option value="processing" className="bg-[#111]">Processing</option>
                                                <option value="completed" className="bg-[#111]">Completed</option>
                                            </select>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-6 py-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="relative">
                                                    <input 
                                                        type="file" 
                                                        accept="image/*"
                                                        className="absolute inset-0 opacity-0 cursor-pointer" 
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handleUploadResult(req.id, file);
                                                        }}
                                                        disabled={uploadingId === req.id}
                                                    />
                                                    <button 
                                                        className={`p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest ${
                                                            uploadingId === req.id 
                                                                ? 'bg-[#FF6B35]/10 text-[#FF6B35] animate-pulse'
                                                                : 'bg-white/5 text-[#FF6B35] hover:bg-[#FF6B35]/10'
                                                        }`}
                                                    >
                                                        {uploadingId === req.id ? 'Uploading...' : <><UploadCloud className="w-4 h-4" /> Upload Output</>}
                                                    </button>
                                                </div>
                                                <button 
                                                    onClick={() => deleteRequest(req.id)}
                                                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                                {requests.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center text-gray-600">
                                            <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-10" />
                                            <p className="font-bold">No trend requests yet</p>
                                            <p className="text-sm">User submissions will appear here automatically</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                </div>
            )}

            {/* Image Modal */}
            <AnimatePresence>
                {selectedImage && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedImage(null)}
                        className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-8 backdrop-blur-xl"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative max-w-5xl max-h-full"
                        >
                            <img 
                                src={selectedImage} 
                                alt="Full Resolution" 
                                className="rounded-2xl shadow-2xl border border-white/10 max-w-full max-h-[85vh] object-contain"
                            />
                            <button className="absolute -top-12 right-0 text-white flex items-center gap-2 font-bold uppercase tracking-widest text-xs hover:text-[#FF6B35] transition-colors">
                                <X className="w-4 h-4" /> Close View
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function TrendRequestsAdminPage() {
    return (
        <AdminGuard>
            <TrendRequestsAdmin />
        </AdminGuard>
    );
}
