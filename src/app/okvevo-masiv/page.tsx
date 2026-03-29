'use client';

import { useState, useRef, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, ShoppingCart, Upload, Check, Trash2, Search, Sparkles, Play, ArrowUpRight, ArrowRight, ArrowLeft } from 'lucide-react';
import { db, storage } from '@/config/firebase';
import { collection, addDoc, serverTimestamp, query, onSnapshot, doc, getDocs } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
// import MasivHero from '@/components/masiv/MasivHero';
import FeaturedShows from '@/components/masiv/FeaturedShows';
import Link from 'next/link';

interface MasivProduct {
    id: string;
    name: string;
    type: 'photo' | 'video'
    thumbnails: string[];
    description: string;
    price: number;
    badge1: string;
    badge2: string;
    level?: number;
}

interface MasivBanner {
    id: string;
    title: string;
    description: string;
    mediaUrl: string;
    type: 'photo' | 'video';
    badge: string;
    level: number;
}

 
const isVideo = (url: string) => {
    return url.toLowerCase().endsWith('.mp4') || url.toLowerCase().endsWith('.webm') || url.toLowerCase().endsWith('.mov');
};

const bgColors = [
    'bg-[#FF6A00]', // Bright Orange
    'bg-[#F5F1E8]', // Cream
    'bg-[#E5E5E5]', // Grey
    'bg-[#E5E5E5]',//Grey
    'bg-[#FF6A00]', // Bright Orange
    'bg-[#F5F1E8]', // Cream
    
];

interface CartItem {
    id: string;
    name: string;
    price: number;
    trendType: string;
    fullBodyImageUrl: string;
    faceImageUrl: string | null;
}

const ThumbnailScroller = memo(({ images, isHovered }: { images: string[], isHovered?: boolean }) => {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        // ROTATION: Automatic change every 5 seconds regardless of hover
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % images.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [images.length]);

    const getLabel = (idx: number) => {
        if (images.length === 2) return idx === 0 ? "MALE" : "FEMALE";
        return `PREVIEW ${idx + 1}`;
    };

    const mediaUrl = images[index];
    const isMediaVideo = isVideo(mediaUrl);
    // REMOVED fragment to avoid Error 208 on certain devices
    const sourceUrl = mediaUrl;

    return (
        <div className="w-full h-full relative bg-[#0a0a0a] overflow-hidden">
            <AnimatePresence mode="wait">
                <motion.div 
                    key={sourceUrl}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    className="absolute inset-0 w-full h-full flex items-center justify-center"
                >
                    {isMediaVideo ? (
                        <div className="relative w-full h-full flex items-center justify-center">
                            <video 
                                src={sourceUrl}
                                autoPlay
                                muted 
                                loop 
                                playsInline 
                                preload="metadata"
                                crossOrigin="anonymous"
                                className="w-full h-full object-cover" 
                            />
                            {/* Visual play indicator always visible for clarity if not auto-played by browser */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                <Play className="w-6 h-6 text-white/20 fill-white/10" />
                            </div>
                        </div>
                    ) : (
                        <img 
                            src={sourceUrl}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-cover" 
                        />
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Pagination Dots for Thumbnails (Sleek) */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-30">
                {images.map((_, i) => (
                    <div 
                        key={i} 
                        className={`h-1 rounded-full transition-all duration-500 ${
                            i === index ? 'w-4 bg-[#FF6B35]' : 'w-1 bg-white/20'
                        }`} 
                    />
                ))}
            </div>

            <div className="absolute top-3 left-3 z-30">
                <span className="bg-black/40 backdrop-blur-md text-[8px] font-black text-white/50 px-2 py-0.5 rounded-full border border-white/5 tracking-[0.2em] uppercase">
                    {getLabel(index)}
                </span>
            </div>
        </div>
    );
});

ThumbnailScroller.displayName = 'ThumbnailScroller';

const ProductCard = memo(({ product, index, isInCart, addToCart, setSelectedCard }: { 
    product: MasivProduct, 
    index: number, 
    isInCart: (id: string) => boolean,
    addToCart: (p: MasivProduct) => void,
    setSelectedCard: (id: string) => void
}) => {
    const [isHovered, setIsHovered] = useState(false);
    
    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => setSelectedCard(product.id)}
            className="group relative p-4 rounded-[32px] overflow-hidden cursor-pointer flex flex-col min-h-[580px] bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.05] transition-all duration-300 transform-gpu hover:-translate-y-1"
        >
            {/* ---- TOP SECTION ---- */}
            <div className="z-10 relative flex flex-col h-[85px] shrink-0 px-1 ">
                <div className="flex gap-2 justify-between items-start mb-3 w-full">
                    <div className="flex gap-2">
                        <span className="px-3 py-1 rounded-full text-[8px] font-black tracking-widest uppercase bg-white/5 text-white/50 border border-white/5 transition-colors group-hover:border-white/10 group-hover:text-white/80">
                            {product.badge1 || 'Trend'}
                        </span>
                        <span className="px-3 py-1 rounded-full text-[8px] font-black tracking-widest uppercase bg-white/5 text-white/50 border border-white/5 transition-colors group-hover:border-white/10 group-hover:text-white/80">
                            {product.badge2 || 'New'}
                        </span>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/5 transition-colors group-hover:border-white/10">
                        <img src="/OKVEVO WithOut BackGrounds/White.svg" alt="" className="h-2.5 object-contain opacity-30 group-hover:opacity-60 transition-opacity" />
                    </div>
                </div>

                <h3 className="text-xl lg:text-2xl font-black tracking-tighter leading-[1] text-white/90 group-hover:text-white transition-colors text-balance">
                    {product.name}
                </h3>
            </div>

            {/* ---- MIDDLE THUMBNAIL ---- */}
            <div className="relative w-full h-[430px] rounded-[24px] overflow-hidden z-0 shrink-0 shadow-lg group">
                <div className="w-full h-full relative">
                    <ThumbnailScroller 
                        images={product.thumbnails} 
                        isHovered={isHovered}
                    />
                </div>
            </div>

            {/* ---- BOTTOM SECTION ---- */}
            <div className="z-10 w-full relative flex flex-col flex-1 mt-4 justify-end gap-3">
                <p className="text-[11px] leading-relaxed font-medium text-white/40 line-clamp-2 group-hover:text-white/60 transition-colors">
                    {product.description}
                </p>
                
                <div className="flex items-center justify-between mt-auto">
                    <div className="font-black text-xl tracking-tighter text-white/90 group-hover:text-white transition-colors">
                        {product.price === 0 ? "Free" : `₹${product.price}`}
                    </div>

                    <button
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                            isInCart(product.id)
                                ? 'bg-green-500/20 text-green-500 cursor-default'
                                : 'bg-white/5 text-white/40 hover:bg-[#FF6B35] hover:text-white'
                        }`}
                        disabled={isInCart(product.id)}
                        onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product);
                        }}
                    >
                        {isInCart(product.id) ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
});

ProductCard.displayName = 'ProductCard';


const FeaturedCarousel = ({ items, onTryTrend }: { items: any[], onTryTrend: (product: any) => void }) => {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % items.length);
        }, 8000); 
        return () => clearInterval(interval);
    }, [items.length]);

    return (
        <div className="relative w-full h-[600px] md:h-[700px] rounded-[32px] md:rounded-[48px] overflow-hidden group shadow-[0_30px_100px_rgba(0,0,0,0.8),0_0_150px_rgba(255,107,53,0.25)] border border-white/5 bg-[#0a0a0a]">
            {/* 1. IMMERSIVE BACKGROUND LAYER */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={`bg-${index}`}
                    initial={{ opacity: 0, scale: 1.2 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 z-0"
                >
                    {isVideo(items[index].image) ? (
                        <video 
                            src={items[index].image} 
                            autoPlay muted loop playsInline 
                            className="w-full h-full object-cover brightness-[0.9]" 
                        />
                    ) : (
                        <img 
                            src={items[index].image} 
                            alt="" 
                            className="w-full h-full object-cover brightness-[0.7]" 
                        />
                    )}
                    {/* Dark gradient overlay for readability */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-[#0a0a0a] via-[#0a0a0a]/40 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
                </motion.div>
            </AnimatePresence>

            {/* 2. HERO CONTENT (LEFT SIDE) */}
            <div className="absolute inset-0 z-10 flex flex-col justify-center px-8 md:px-20 max-w-4xl">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`content-${index}`}
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="space-y-6 md:space-y-10"
                    >
                        <div className="flex items-center gap-4">
                            <div className="h-[2px] w-12 bg-[#FF6B35]" />
                            <span className="text-[#FF6B35] font-black tracking-[0.4em] uppercase text-[10px] md:text-xs">
                                {items[index].badge || "Global Destination"}
                            </span>
                        </div>

                        <h1 className="text-5xl md:text-[7rem] font-black leading-[0.85] text-white tracking-tighter uppercase max-w-min">
                            <span dangerouslySetInnerHTML={{ __html: items[index].title }} />
                        </h1>

                        <p className="text-white/40 text-sm md:text-lg font-medium max-w-md leading-relaxed">
                            {items[index].description || "Experience the pinnacle of creative excellence. Our global community curates only the most elite digital assets."}
                        </p>

                        <div className="flex items-center gap-8 pt-6">
                            <button className="px-8 py-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-full text-white text-xs font-black tracking-[0.3em] uppercase hover:bg-white hover:text-black transition-all duration-500 overflow-hidden group/btn">
                                <span className="relative z-10">Discover Project</span>
                            </button>
                            
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center group/play cursor-pointer hover:bg-[#FF6B35] transition-all">
                                    <Play className="w-4 h-4 text-white fill-white/10" />
                                </div>
                                <span className="text-[10px] font-black tracking-widest text-white/20 uppercase">Watch Reel</span>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* 3. INTERACTIVE THUMBNAILS (LAYOUT-DRIVEN SMOOTH TRANSITIONS) */}
            <div className="absolute bottom-10 right-12 z-20 flex items-end gap-5 overflow-visible max-w-[50%] justify-end">
                {[0, 1, 2].map((offset) => {
                    const itemIndex = (index + offset) % items.length;
                    const item = items[itemIndex];
                    return (
                        <motion.div
                            key={item.id}
                            layout
                            layoutId={item.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ 
                                opacity: offset === 0 ? 1 : 0.4, 
                                x: 0, 
                                scale: offset === 0 ? 1.05 : 1, 
                                y: offset === 0 ? -10 : 0 
                            }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ 
                                layout: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
                                opacity: { duration: 0.6 },
                                scale: { duration: 0.6 }
                            }}
                            onClick={() => setIndex(itemIndex)}
                            className={`relative w-32 md:w-52 aspect-[4/5] rounded-3xl md:rounded-[10px] overflow-hidden cursor-pointer border-2 transition-all duration-700 shadow-[0_20px_60px_rgba(0,0,0,0.8)] ${
                                offset === 0 ? 'border-white/40' : 'border-white/5 grayscale hover:grayscale-0'
                            }`}
                        >
                            <img src={item.image} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                            <div className="absolute bottom-6 left-6 right-6 text-[10px] md:text-[12px] font-black text-white leading-tight uppercase tracking-widest z-10">
                                {item.title.replace(/<[^>]*>?/gm, '')}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* 4. NAVIGATION & INDICATORS */}
            <div className="absolute bottom-12 left-8 md:left-20 z-20 flex items-center gap-10">
                {/* Arrow Nav */}
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIndex((index - 1 + items.length) % items.length)}
                        className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-all text-white/40 hover:text-white"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => setIndex((index + 1) % items.length)}
                        className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-all text-white/40 hover:text-white"
                    >
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Big Number Counter */}
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-white tracking-tighter">0{index + 1}</span>
                    <div className="h-px w-10 bg-white/20" />
                    <span className="text-sm font-black text-white/20 tracking-tighter">0{items.length}</span>
                </div>
            </div>
        </div>
    );
};

export default function OkvevoMasivPage() {
    const { user, loading: authLoading, isAuthenticated } = useAuth();
    const [selectedCard, setSelectedCard] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [showCart, setShowCart] = useState(false);
    const [userName, setUserName] = useState('');
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [email, setEmail] = useState('');
    const router = useRouter();

    const [products, setProducts] = useState<MasivProduct[]>([]);
    const [banners, setBanners] = useState<MasivBanner[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [loadingBanners, setLoadingBanners] = useState(true);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!authLoading && !isAuthenticated()) {
            router.push('/login');
        }
    }, [authLoading, isAuthenticated, router]);

    // Fetch Products from Firestore
    useEffect(() => {
        const q = query(collection(db, 'masiv_products'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedProducts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as MasivProduct[];
            setProducts(fetchedProducts);
            setLoadingProducts(false);
        }, (error) => {
            console.error("Error fetching masiv_products:", error);
            setLoadingProducts(false);
        });

        return () => unsubscribe();
    }, []);

    // Lenis removed for maximum native performance
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'all' | 'photo' | 'video'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch Banners from Firestore
    useEffect(() => {
        const q = query(collection(db, 'masiv_banners'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedBanners = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as MasivBanner[];
            setBanners(fetchedBanners.sort((a, b) => (a.level || 0) - (b.level || 0)));
            setLoadingBanners(false);
        }, (error) => {
            console.error("Error fetching masiv_banners:", error);
            setLoadingBanners(false);
        });

        return () => unsubscribe();
    }, []);

    const filteredProducts = useMemo(() => {
        return products
            .filter(product => {
                const matchesCategory = activeFilter === 'all' || product.type === activeFilter;
                const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                      product.description.toLowerCase().includes(searchQuery.toLowerCase());
                return matchesCategory && matchesSearch;
            })
            .sort((a, b) => (a.level || 0) - (b.level || 0)); // Sort by level (ascending)
    }, [products, activeFilter, searchQuery]);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
    const [resultImage, setResultImage] = useState<string | null>(null);

    // Image Upload State
    const [fullBodyImage, setFullBodyImage] = useState<string | null>(null);
    const [faceCloseUpImage, setFaceCloseUpImage] = useState<string | null>(null);

    // Refs for hidden inputs
    const fullBodyInputRef = useRef<HTMLInputElement>(null);
    const faceInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!activeRequestId) return;

        // Listen for the specific request document to get the resultUrl
        const unsubscribe = onSnapshot(doc(db, 'trend_requests', activeRequestId), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data.resultUrl) {
                    setResultImage(data.resultUrl);
                    setIsSubmitting(false); // Stop loading once result is here
                }
            }
        });

        return () => unsubscribe();
    }, [activeRequestId]);

    // Reset success state after a delay
    useEffect(() => {
        if (submitSuccess) {
            const timer = setTimeout(() => setSubmitSuccess(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [submitSuccess]);

    const handleTryTrend = async (product: MasivProduct) => {
        if (!fullBodyImage) {
            alert('Please upload a full body photo first.');
            return;
        }

        setIsSubmitting(true);
        try {
            if (!user?.uid) {
                alert('Please sign in to continue.');
                return;
            }
            const timestamp = Date.now();
            const userId = user.uid;
            
            // 1. Upload Full Body Image
            const fullBodyRef = ref(storage, `trend_requests/${userId}/${timestamp}_full_body.jpg`);
            await uploadString(fullBodyRef, fullBodyImage, 'data_url');
            const fullBodyUrl = await getDownloadURL(fullBodyRef);

            // 2. Upload Face Image (if present)
            let faceUrl = '';
            if (faceCloseUpImage) {
                const faceRef = ref(storage, `trend_requests/${userId}/${timestamp}_face.jpg`);
                await uploadString(faceRef, faceCloseUpImage, 'data_url');
                faceUrl = await getDownloadURL(faceRef);
            }

            // 3. Save Request to Firestore
            const docRef = await addDoc(collection(db, 'trend_requests'), {
                userId,
                userEmail: user?.email || 'anonymous',
                userName: user?.displayName || 'Anonymous User',
                trendId: product.id,
                trendName: product.name,
                price: product.price,
                fullBodyUrl,
                faceUrl,
                status: 'pending',
                createdAt: serverTimestamp()
            });

            setActiveRequestId(docRef.id);
            // setSubmitSuccess(true); // We don't close yet, we wait for results
            // setSelectedCard(null); 
            // setFullBodyImage(null);
            // setFaceCloseUpImage(null);
        } catch (error) {
            console.error('Error submitting trend request:', error);
            alert('Failed to submit request. Please try again.');
        } finally {
            // setIsSubmitting(false); // We keep loading until resultUrl arrives
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'full' | 'face') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (type === 'full') setFullBodyImage(reader.result as string);
                else setFaceCloseUpImage(reader.result as string);
            };
            reader.readAsDataURL(file);
            // Reset input value to allow selecting the same file again if needed
            e.target.value = '';
        }
    };

    const addToCart = async (product: MasivProduct) => {
        // Validate that photos are uploaded
        if (!fullBodyImage) {
            alert('Please upload a full body photo before adding to cart.');
            return;
        }

        try {
            if (!user?.uid) {
                alert('Please sign in to add items to cart.');
                return;
            }
            const timestamp = Date.now();
            const userId = user.uid;
            
            // Upload Full Body Image to Storage
            const fullBodyRef = ref(storage, `masiv_orders/${userId}/${timestamp}_${product.id}_full_body.jpg`);
            await uploadString(fullBodyRef, fullBodyImage, 'data_url');
            const fullBodyUrl = await getDownloadURL(fullBodyRef);

            // Upload Face Image (if present)
            let faceUrl = '';
            if (faceCloseUpImage) {
                const faceRef = ref(storage, `masiv_orders/${userId}/${timestamp}_${product.id}_face.jpg`);
                await uploadString(faceRef, faceCloseUpImage, 'data_url');
                faceUrl = await getDownloadURL(faceRef);
            }

            // Add to cart with photo URLs (no Firestore write yet - will be created after payment)
            if (!cart.find(item => item.id === product.id)) {
                setCart([...cart, { 
                    id: product.id, 
                    name: product.name, 
                    price: product.price,
                    trendType: product.type,
                    fullBodyImageUrl: fullBodyUrl,
                    faceImageUrl: faceUrl || null
                }]);
            }
            
            // Clear uploaded images after successful submission
            setFullBodyImage(null);
            setFaceCloseUpImage(null);
            
            alert('Successfully added to cart with your photos!');
            setSelectedCard(null);
        } catch (error) {
            console.error('Error adding to cart:', error);
            alert('Failed to add to cart. Please try again.');
        }
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const isInCart = (id: string) => cart.some(item => item.id === id);
    const totalPrice = cart.reduce((sum, item) => sum + item.price, 0);

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#FF6B35]/30 overflow-x-hidden relative scroll-smooth">
            {/* Minimal Background (Non-fixed to prevent paint lag) */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#1a0a05_0%,#050505_100%)] pointer-events-none z-0" />

            {/* Custom Floating Pill Navbar (Landing Page style) */}
            <nav className="fixed top-0 left-0 right-0 z-[150] px-4 md:px-6 py-8 transition-all duration-700 pointer-events-none">
                <div className="max-w-[1200px] mx-auto pointer-events-auto flex items-center justify-between w-full px-8 py-5 rounded-full backdrop-blur-xl bg-gradient-to-r from-[#FF6B35]/10 via-[#0A0A0A]/80 to-[#FF6B35]/10 border border-white/10 hover:shadow-[0_0_30px_rgba(255,107,53,0.15)] transition-all">
                    
                    {/* Left - Official Logo */}
                    <div className="flex-1 flex justify-start">
                        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <img src="/masiv/masivlogo.png" alt="MASIV Logo" className="h-10 w-auto object-contain" />
                        </Link>
                    </div>

                    {/* Center - Empty */}
                    <div className="flex-1 flex justify-center" />

                    {/* Right - Cart */}
                    <div className="flex-1 flex justify-end">
                        <button
                            onClick={() => setShowCart(true)}
                            className="flex items-center gap-2.5 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-colors shadow-lg"
                        >
                            <ShoppingCart className="w-4 h-4 text-[#FF6B35]" />
                            <span className="font-bold text-sm tracking-widest uppercase hidden sm:block">Cart <span className="text-white/50 ml-1">({cart.length})</span></span>
                            <span className="font-bold text-sm tracking-widest uppercase sm:hidden">{cart.length}</span>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Section with persistent grid background */}
            <div className="bg-transparent text-white pb-24 relative z-10 transition-all">
                
                
            </div>

            {/* Dark Section for Cards */}
            <main className="max-w-[1400px] mx-auto pb-24 relative z-0">
                
                {/* Header Title Space (Optionally kept or moved) */}
                <header className="mb-12 md:mb-8 px-10 text-center mt-10">
                    {/* <p className="text-[#FF6B35] text-sm font-black tracking-[0.3em] uppercase mb-4 opacity-70">
                        Explore Our Catalog
                    </p> */}
                    <h1 className="text-6xl md:text-5xl font-black tracking-tighter text-white leading-[0.9] max-w-4xl mx-auto">
                    </h1>
                </header>

                {/* Featured Trends Section with Orange Boundary Glow */}
                <section className="px-6 md:px-10 mb-6 relative z-10">
                    <div className="relative z-10">
                        {loadingBanners ? (
                            <div className="w-full h-[400px] md:h-[500px] rounded-[48px] bg-white/5 animate-pulse flex items-center justify-center border border-white/10">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-12 h-12 border-4 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
                                    <p className="text-white/30 font-bold tracking-widest uppercase text-xs">Loading Features...</p>
                                </div>
                            </div>
                        ) : banners.length > 0 ? (
                            <FeaturedCarousel 
                                onTryTrend={() => {}}
                                items={banners.map(b => ({
                                    id: b.id,
                                    title: b.title,
                                    image: b.mediaUrl,
                                    description: b.description,
                                    badge: b.badge
                                }))}
                            />
                        ) : (
                            // Fallback to products if no banners are configured
                            loadingProducts ? (
                                <div className="w-full h-[400px] md:h-[500px] rounded-[48px] bg-white/5 animate-pulse flex items-center justify-center border border-white/10">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-12 h-12 border-4 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
                                        <p className="text-white/30 font-bold tracking-widest uppercase text-xs">Loading Trends...</p>
                                    </div>
                                </div>
                            ) : (
                                <FeaturedCarousel 
                                    onTryTrend={(item) => setSelectedCard(item.id)}
                                    items={products.slice(0, 3).map(p => ({
                                        id: p.id,
                                        title: p.name.toUpperCase().split(' ').join(' <br/> '),
                                        image: p.thumbnails[0],
                                        description: p.description,
                                        badge: p.badge1 || "Featured Collection"
                                    }))}
                                />
                            )
                        )}
                    </div>
                </section>

                {/* Filter & Search Control Bar */}
                <section className="px-10 mb-12 flex flex-col md:flex-row gap-6 items-center justify-between">
                    {/* Category Tabs */}
                    <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-2xl backdrop-blur-md">
                        {['all', 'photo', 'video'].map((type) => (
                            <button
                                key={type}
                                onClick={() => setActiveFilter(type as any)}
                                className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                                    activeFilter === type 
                                    ? 'bg-[#FF6B35] text-white shadow-lg' 
                                    : 'text-white/40 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full md:w-96 group">
                        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                            <Search className={`w-4 h-4 transition-colors duration-300 ${searchQuery ? 'text-[#FF6B35]' : 'text-white/20'}`} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search trends..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 text-white pl-14 pr-12 py-4 rounded-2xl outline-none focus:border-[#FF6B35]/50 focus:bg-white/10 transition-all font-bold text-sm placeholder:text-white/20"
                        />
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 right-4 flex items-center p-2 text-white/30 hover:text-white transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </section>

                {/* Vertical Normal Grid (4 columns) */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {filteredProducts.map((product, index) => (
                        <ProductCard 
                            key={product.id}
                            product={product}
                            index={index}
                            isInCart={isInCart}
                            addToCart={addToCart}
                            setSelectedCard={setSelectedCard}
                        />
                    ))}
                </section>
            </main>

            {/* 3-Column Expanded Card Modal */}
            <AnimatePresence>
                {selectedCard && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => {
                            setSelectedCard(null);
                            setFullBodyImage(null);
                            setFaceCloseUpImage(null);
                        }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[150] flex items-center justify-center p-4 md:p-8"
                    >
                        {(() => {
                            const product = products.find(p => p.id === selectedCard);
                            if (!product) return null;
                            const alreadyInCart = isInCart(product.id);

                            return (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 30 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 30 }}
                                    transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="relative bg-[#0d0d0d] border border-white/10 rounded-[2.5rem] w-full max-w-[1200px] h-[75vh] min-h-[500px] overflow-hidden shadow-2xl flex flex-col"
                                >
                                    {/* Close Button */}
                                    <button
                                        onClick={() => {
                                            setSelectedCard(null);
                                            setFullBodyImage(null);
                                            setFaceCloseUpImage(null);
                                        }}
                                        className="absolute top-6 right-6 z-50 p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/10"
                                    >
                                        <X className="w-5 h-5 text-white" />
                                    </button>

                                    {/* 3 Parts: Left Thumbnail, Center Upload, Right Info */}
                                    <div className="flex flex-col md:flex-row h-full">

                                        {/* LEFT Part: Thumbnail */}
                                        <div className="w-full md:w-1/3 h-1/3 md:h-full p-6 pb-3 md:pb-6 pr-3 md:pr-3">
                                            <div className="w-full h-full rounded-3xl overflow-hidden relative border border-white/5">
                                                <ThumbnailScroller 
                                                    images={product.thumbnails} 
                                                />
                                            </div>
                                        </div>

                                        {/* CENTER Part: Image Uploads */}
                                        <div className="w-full md:w-1/3 h-1/3 md:h-full p-6 py-3 md:py-6 px-3 md:px-3 flex flex-col gap-5">
                                            
                                            {/* Top Box: Full Body */}
                                            <div className="flex flex-col flex-1 min-h-0">
                                                <div className="mb-2 shrink-0 flex justify-between items-center">
                                                    <div>
                                                        <span className="text-white/90 text-[13px] font-bold tracking-wide">Full Body Photo</span>
                                                        <span className="text-[#FF6B35] font-black ml-1 text-[13px]">*</span>
                                                    </div>
                                                    {fullBodyImage && (
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setFullBodyImage(null);
                                                            }}
                                                            className="text-red-500 hover:text-red-400 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                                <label className="flex-1 min-h-0 block cursor-pointer group">
                                                    <input 
                                                        type="file" 
                                                        className="hidden" 
                                                        accept="image/*"
                                                        onChange={(e) => handleFileChange(e, 'full')}
                                                    />
                                                    <div 
                                                        className={`w-full relative h-full rounded-[1.5rem] bg-[#0a0a0a]/50 border-2 border-dashed flex flex-col items-center justify-center p-4 text-center transition-all overflow-hidden ${
                                                            fullBodyImage 
                                                                ? 'border-[#FF6B35]/50 bg-[#FF6B35]/5' 
                                                                : 'border-[#FF6B35]/30 group-hover:bg-[#FF6B35]/5 group-hover:border-[#FF6B35]/60'
                                                        }`}
                                                    >
                                                        {fullBodyImage ? (
                                                            <img src={fullBodyImage} alt="Preview" className="absolute inset-0 w-full h-full object-cover rounded-[1.5rem]" />
                                                        ) : (
                                                            <>
                                                                <Upload strokeWidth={1.5} className="w-5 h-5 text-white/40 group-hover:text-[#FF6B35] transition-colors mb-2" />
                                                                <span className="text-white/60 text-[13px] mb-1 group-hover:text-white transition-colors">Upload full body photo</span>
                                                                <span className="text-white/30 text-[11px]">Required for outfit reference</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </label>
                                            </div>

                                            {/* Bottom Box: Face Close-up */}
                                            <div className="flex flex-col flex-1 min-h-0">
                                                <div className="mb-2 shrink-0 flex justify-between items-center">
                                                    <div>
                                                        <span className="text-white/90 text-[13px] font-bold tracking-wide">Face Close-up Photo</span>
                                                        <span className="text-white/30 ml-1 text-[13px]">(Optional)</span>
                                                    </div>
                                                    {faceCloseUpImage && (
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setFaceCloseUpImage(null);
                                                            }}
                                                            className="text-red-500 hover:text-red-400 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                                <label className="flex-1 min-h-0 block cursor-pointer group">
                                                    <input 
                                                        type="file" 
                                                        className="hidden" 
                                                        accept="image/*"
                                                        onChange={(e) => handleFileChange(e, 'face')}
                                                    />
                                                    <div 
                                                        className={`w-full relative h-full rounded-[1.5rem] bg-[#0a0a0a]/50 border-2 border-dashed flex flex-col items-center justify-center p-4 text-center transition-all overflow-hidden ${
                                                            faceCloseUpImage 
                                                                ? 'border-white/30 bg-white/5' 
                                                                : 'border-white/10 group-hover:bg-white/5 group-hover:border-white/30'
                                                        }`}
                                                    >
                                                        {faceCloseUpImage ? (
                                                            <img src={faceCloseUpImage} alt="Preview" className="absolute inset-0 w-full h-full object-cover rounded-[1.5rem]" />
                                                        ) : (
                                                            <>
                                                                <Upload strokeWidth={1.5} className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors mb-2" />
                                                                <span className="text-white/60 text-[13px] mb-1 group-hover:text-white transition-colors">Upload face close-up</span>
                                                                <span className="text-white/30 text-[11px]">For better facial accuracy</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </label>
                                            </div>

                                        </div>

                                        {/* RIGHT Part: Info & Buttons */}
                                        <div className="w-full md:w-1/3 h-1/3 md:h-full p-6 pt-3 md:pt-6 pl-3 md:pl-3 flex flex-col">
                                            <div className="w-full h-full rounded-3xl bg-[#151515] border border-white/5 p-8 flex flex-col relative overflow-hidden">

                                                <div className="flex-1 relative z-10">
                                                    <h2 className="text-4xl lg:text-5xl font-black mb-4 tracking-tighter text-white leading-[1.1]">{product.name}</h2>
                                                    <p className="text-white/50 text-base leading-relaxed mb-8 font-medium">
                                                        {product.description}
                                                    </p>

                                                    <div className="flex flex-col">
                                                        <span className="text-white/30 text-xs font-bold uppercase tracking-widest mb-1">
                                                            Price
                                                        </span>
                                                        <p className="text-4xl font-black text-[#FF6B35]">
                                                            ₹{product.price}
                                                        </p>
                                                    </div>
                                                </div>

                                                    <div className="flex flex-col gap-3 mt-8 relative z-10">
                                                        {/* <button 
                                                            onClick={() => handleTryTrend(product)}
                                                            disabled={isSubmitting || !fullBodyImage}
                                                            className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-xl flex items-center justify-center gap-3 ${
                                                                isSubmitting || !fullBodyImage
                                                                    ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
                                                                    : 'bg-[#FF6B35] hover:bg-[#FF8F6B] text-black shadow-[0_0_30px_rgba(255,107,53,0.3)]'
                                                            }`}
                                                        >
                                                            {isSubmitting ? (
                                                                <>
                                                                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                                                    Reviewing Trend...
                                                                </>
                                                            ) : (
                                                                'Submit'
                                                            )}
                                                        </button> */}
                                                    <button
                                                        onClick={() => addToCart(product)}
                                                        disabled={alreadyInCart || !fullBodyImage || loadingProducts}
                                                        className={`w-full py-5 rounded-2xl font-bold uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 border ${
                                                            alreadyInCart
                                                                ? 'bg-green-500/10 text-green-500 border-green-500/20 cursor-not-allowed'
                                                                : !fullBodyImage
                                                                ? 'bg-red-500/10 text-red-500 border-red-500/20 cursor-not-allowed'
                                                                : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                                                            }`}
                                                    >
                                                        {alreadyInCart ? (
                                                            <>
                                                                <Check className="w-5 h-5" />
                                                                In Cart
                                                            </>
                                                        ) : !fullBodyImage ? (
                                                            <>
                                                                <Upload className="w-5 h-5" />
                                                                Upload Photo First
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ShoppingCart className="w-5 h-5 opacity-50" />
                                                                Add to Cart
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </motion.div>
                            );
                        })()}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- GENERATION LOADER / RESULT OVERLAY --- */}
            <AnimatePresence>
                {(isSubmitting || resultImage) && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6"
                    >
                        <div className="max-w-4xl w-full text-center">
                            {resultImage ? (
                                <motion.div 
                                    initial={{ scale: 0.9, y: 20 }}
                                    animate={{ scale: 1, y: 0 }}
                                    className="flex flex-col items-center"
                                >
                                    <div className="mb-8">
                                        <h2 className="text-5xl font-black tracking-tighter uppercase mb-2">Your Trend is Ready</h2>
                                        <p className="text-gray-400">Our AI has successfully crafted your unique look</p>
                                    </div>
                                    
                                    <div className="relative group rounded-[32px] overflow-hidden border border-white/10 shadow-2xl mb-10 w-full max-w-lg aspect-[3/4]">
                                        <img src={resultImage} alt="AI Result" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                    </div>

                                    <div className="flex gap-4">
                                        <button 
                                            onClick={() => window.open(resultImage, '_blank')}
                                            className="px-8 py-4 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all"
                                        >
                                            Download High-Res
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setResultImage(null);
                                                setActiveRequestId(null);
                                                setIsSubmitting(false);
                                                setSelectedCard(null);
                                            }}
                                            className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all"
                                        >
                                            Back to Catalog
                                        </button>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <div className="relative w-32 h-32 mb-10">
                                        <div className="absolute inset-0 border-4 border-[#FF6B35]/20 rounded-full" />
                                        <motion.div 
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                            className="absolute inset-0 border-4 border-[#FF6B35] border-t-transparent rounded-full"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-16 h-16 bg-[#FF6B35]/10 rounded-full flex items-center justify-center animate-pulse">
                                                <div className="w-8 h-8 rounded-full bg-[#FF6B35]" />
                                            </div>
                                        </div>
                                    </div>

                                    <h2 className="text-4xl font-black tracking-tighter uppercase mb-4 animate-pulse">Generating your Trend</h2>
                                    <div className="space-y-2 max-w-md mx-auto">
                                        <p className="text-gray-400 text-lg">Our design team is manually reviewing your photos to ensure the highest AI quality.</p>
                                        <p className="text-[#FF6B35] text-sm font-black tracking-widest uppercase">Do not close this window</p>
                                    </div>

                                    {/* Progress simulation or steps */}
                                    <div className="mt-12 flex justify-center gap-2">
                                        {[0, 1, 2].map(i => (
                                            <motion.div 
                                                key={i}
                                                animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                                                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.4 }}
                                                className="w-2 h-2 rounded-full bg-[#FF6B35]"
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cart Sidebar */}
            <AnimatePresence>
                {showCart && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowCart(false)}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
                    >
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-0 h-full w-full max-w-md bg-[#111] border-l border-white/10 shadow-2xl"
                        >
                            <div className="p-8 h-full flex flex-col">
                                <div className="flex items-center justify-between mb-8">
                                    <h2 className="text-3xl font-black tracking-tight">Your Cart</h2>
                                    <button
                                        onClick={() => setShowCart(false)}
                                        className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                                    >
                                        <X className="w-5 h-5 text-white/70" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                                    {cart.length === 0 ? (
                                        <div className="text-center py-20 text-white/30 flex flex-col items-center">
                                            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                                                <ShoppingCart className="w-10 h-10 text-white/20" />
                                            </div>
                                            <p className="font-bold text-lg">Your cart is empty</p>
                                        </div>
                                    ) : (
                                        cart.map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex flex-col p-5 bg-[#1a1a1a] border border-white/5 rounded-2xl relative group"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="font-bold text-lg text-white pr-8">{item.name}</h4>
                                                    <button
                                                        onClick={() => removeFromCart(item.id)}
                                                        className="absolute top-5 right-5 p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <p className="text-[#FF6B35] font-black text-xl">₹{item.price}</p>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {cart.length > 0 && (
                                    <div className="border-t border-white/10 pt-6 mt-6">
                                        {/* User Information Form */}
                                        <div className="mb-6 space-y-4">
                                            <h3 className="text-sm font-black uppercase tracking-widest text-white/70 mb-4">Your Details</h3>
                                            
                                            {/* Name - Mandatory */}
                                            <div>
                                                <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-wider">
                                                    Name <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={userName}
                                                    onChange={(e) => setUserName(e.target.value)}
                                                    placeholder="Enter your full name"
                                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6B35] transition-colors"
                                                />
                                            </div>

                                            {/* WhatsApp Number - Mandatory */}
                                            <div>
                                                <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-wider">
                                                    WhatsApp Number <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="tel"
                                                    value={whatsappNumber}
                                                    onChange={(e) => setWhatsappNumber(e.target.value)}
                                                    placeholder="Enter your WhatsApp number"
                                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6B35] transition-colors"
                                                />
                                            </div>

                                            {/* Email - Optional */}
                                            <div>
                                                <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-wider">
                                                    Email <span className="text-white/30 text-[10px]">(Optional)</span>
                                                </label>
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    placeholder="Enter your email address"
                                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6B35] transition-colors"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-end justify-between mb-6">
                                            <span className="text-white/50 font-bold uppercase tracking-widest text-xs">Total Amount</span>
                                            <span className="text-4xl font-black text-white">₹{totalPrice}</span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (!userName || !whatsappNumber) {
                                                    alert('Please fill in all required fields (Name and WhatsApp Number)');
                                                    return;
                                                }
                                                alert('Payment integration coming soon!');
                                            }}
                                            disabled={!userName || !whatsappNumber}
                                            className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all ${
                                                !userName || !whatsappNumber
                                                    ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
                                                    : 'bg-[#FF6B35] hover:bg-[#FF8F6B] text-white shadow-[0_0_30px_rgba(255,107,53,0.3)]'
                                            }`}
                                        >
                                            Proceed to Checkout
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
