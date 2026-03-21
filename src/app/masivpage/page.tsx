'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, ShoppingCart, Upload, Check, Trash2 } from 'lucide-react';
import { useRef } from 'react';
// import MasivHero from '@/components/masiv/MasivHero';
import FeaturedShows from '@/components/masiv/FeaturedShows';

const products = [
    {
        id: '1',
        name: 'Neon City Pack',
        thumbnail: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=400&h=400&fit=crop',
        description: 'Cyberpunk cityscape assets for video production',
        price: 2999,
        badge1: '12-18 Yrs',
        badge2: 'Trending'
    },
    {
        id: '2',
        name: 'Luxury Minimal',
        thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=400&fit=crop',
        description: 'Clean, minimal backgrounds for product shots',
        price: 1999,
        badge1: '10-24 Yrs',
        badge2: 'Clean'
    },
    {
        id: '3',
        name: 'Abstract Flow',
        thumbnail: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=400&h=400&fit=crop',
        description: 'Fluid abstract motion graphics pack',
        price: 2499,
        badge1: 'All Ages',
        badge2: 'Motion'
    },
    {
        id: '4',
        name: 'Nature Cinematic',
        thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop',
        description: 'Stunning nature footage and overlays',
        price: 3499,
        badge1: 'Pro',
        badge2: 'Nature'
    },
    {
        id: '5',
        name: 'Tech HUD Elements',
        thumbnail: 'https://images.unsplash.com/photo-1535868463750-c78d9543614f?w=400&h=400&fit=crop',
        description: 'Futuristic UI elements and overlays',
        price: 2799,
        badge1: 'Gamers',
        badge2: 'HUD'
    },
    {
        id: '6',
        name: 'Film Grain Collection',
        thumbnail: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&h=400&fit=crop',
        description: 'Authentic film grain overlays for vintage look',
        price: 1599,
        badge1: 'Classic',
        badge2: 'Vintage'
    },
];

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
}

export default function OkvevoMasivPage() {
    const [selectedCard, setSelectedCard] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [showCart, setShowCart] = useState(false);

    // Image Upload State
    const [fullBodyImage, setFullBodyImage] = useState<string | null>(null);
    const [faceCloseUpImage, setFaceCloseUpImage] = useState<string | null>(null);

    // Refs for hidden inputs
    const fullBodyInputRef = useRef<HTMLInputElement>(null);
    const faceInputRef = useRef<HTMLInputElement>(null);

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

    const addToCart = (product: typeof products[0]) => {
        if (!cart.find(item => item.id === product.id)) {
            setCart([...cart, { id: product.id, name: product.name, price: product.price }]);
        }
        setSelectedCard(null);
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const isInCart = (id: string) => cart.some(item => item.id === id);
    const totalPrice = cart.reduce((sum, item) => sum + item.price, 0);

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-[#FF6B35]/30 overflow-x-hidden">

            {/* Custom Floating Pill Navbar (Landing Page style) */}
            <nav className="fixed top-0 left-0 right-0 z-[150] px-4 md:px-6 py-8 transition-all duration-700 pointer-events-none">
                <div className="max-w-[1200px] mx-auto pointer-events-auto flex items-center justify-between w-full px-8 py-5 rounded-full backdrop-blur-xl bg-gradient-to-r from-[#FF6B35]/10 via-[#0A0A0A]/80 to-[#FF6B35]/10 border border-white/10 hover:shadow-[0_0_30px_rgba(255,107,53,0.15)] transition-all">
                    
                    {/* Left - Official Logo */}
                    <div className="flex-1 flex justify-start">
                        <a href="/" className="hover:opacity-80 transition-opacity">
                            <img src="/OKVEVO WithOut BackGrounds/White.svg" alt="OKVEVO" className="h-6 md:h-10 object-contain" />
                        </a>
                    </div>

                    {/* Center - Collab Text with Red Dash */}
                    <div className="flex-1 flex justify-center">
                        <div className="text-xl md:text-2xl font-black tracking-tighter flex items-center gap-3">
                            <div className="hidden sm:flex items-center gap-3">
                                OKVEVO
                                <span className="text-orange-600 font-medium font-sans">X</span>
                            </div>
                            <span className="text-white flex items-center">
                                MA
                                <span className="relative inline-flex flex-col items-center">
                                    {/* Red dash over S */}
                                    <div className="absolute -top-1 md:-top-2 w-3 md:w-3.5 h-1 md:h-1.5 bg-red-600 rounded-full" />
                                    S
                                </span>
                                IV
                            </span>
                        </div>
                    </div>

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

            {/* Top Light Section to match photo style */}
            <div className="bg-[#0b0b0b] text-white pb-24 rounded-b-[80px] shadow-2xl relative z-10">
                
                
            </div>

            {/* Dark Section for Cards */}
            <main className="max-w-[1500px] mx-auto pb-24 relative z-0">
                
                {/* Header Title Space (Optionally kept or moved) */}
                <header className="mb-12 md:mb-24 px-10 text-center">
                    <p className="text-[#FF6B35] text-sm font-black tracking-[0.3em] uppercase mb-4 opacity-70">
                        Explore Our Catalog
                    </p>
                    <h1 className="text-6xl md:text-5xl font-black tracking-tighter text-white leading-[0.9] max-w-4xl mx-auto">
                        "AI-Crafted Visuals, Starting with You."
                    </h1>
                </header>

                {/* Vertical Normal Grid */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {products.map((product, index) => {
                        const cardBg = bgColors[index % bgColors.length];
                        const isOrange = cardBg === 'bg-[#FF6B35]';

                        return (
                            <motion.div
                                key={product.id}
                                onClick={() => setSelectedCard(product.id)}
                                // Min height of 740px to closely match the massive screenshot card height
                                className={`group relative p-8 rounded-[40px] overflow-hidden cursor-pointer transition-transform duration-500 flex flex-col min-h-[740px] shadow-2xl ${cardBg}`}
                                whileHover={{ y: -8 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                {/* ---- TOP SECTION (Mathematically Bounded) ---- */}
                                <div className="z-10 relative flex flex-col h-[120px] shrink-0">
                                    <div className="flex gap-2 justify-between items-start mb-4 w-full">
                                        <div className="flex gap-2">
                                            <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide ${isOrange ? 'bg-white text-black' : 'bg-black text-white'
                                                }`}>
                                                {product.badge1 || 'Trend'}
                                            </span>
                                            <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide ${isOrange ? 'bg-white text-black' : 'bg-black text-white'
                                                }`}>
                                                {product.badge2 || 'New'}
                                            </span>
                                        </div>

                                        {/* Small Okvevo Logo Badge */}
                                        <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center shrink-0">
                                            <span className="font-black text-[10px] tracking-tighter text-black flex items-center leading-none">
                                                <img src="/OKVEVO WithOut BackGrounds/Black.svg" alt="OKVEVO" className="h-4 md:h-5 object-contain" />
                                            </span>
                                        </div>
                                    </div>

                                    {/* Exact original Title */}
                                    <h3 className="text-4xl lg:text-[42px] font-black tracking-tight leading-[1.05] text-black pr-4">
                                        {product.name}
                                    </h3>
                                </div>

                                {/* ---- MIDDLE THUMBNAIL (Mathematically Bounded) ---- */}
                                <div className="relative w-full h-[380px] rounded-[30px] overflow-hidden z-0 mt-4 shrink-0">
                                    <div className="w-full h-full relative rounded-[30px] overflow-hidden ring-4 ring-black/5 ring-inset">
                                        <img
                                            src={product.thumbnail}
                                            alt={product.name}
                                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                                        />
                                    </div>
                                </div>

                                {/* ---- BOTTOM SECTION (Mathematically Bounded) ---- */}
                                <div className="z-10 w-full relative pt-2 flex gap-4 shrink-0 mt-auto min-h-[80px] items-end justify-between">
                                    <div className="flex-1 flex flex-col justify-end">
                                        <p className="text-sm md:text-[15px] mb-4 leading-relaxed font-semibold text-black/70 pr-4">
                                            {product.description}
                                        </p>
                                        <div className="flex items-center gap-1 font-black text-3xl tracking-tighter text-black">
                                            {product.price === 0 ? "Free" : `₹${product.price}`}
                                        </div>
                                    </div>

                                    <div className="flex-shrink-0 flex items-end">
                                        <button
                                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-700 ${
                                                isInCart(product.id)
                                                    ? 'bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] scale-105 cursor-default'
                                                    : 'bg-black text-[#FF6B35] group-hover:rotate-90 group-hover:shadow-xl'
                                            }`}
                                            disabled={isInCart(product.id)}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                addToCart(product);
                                            }}
                                        >
                                            {isInCart(product.id) ? (
                                                <Check className="w-6 h-6" />
                                            ) : (
                                                <Plus className="w-6 h-6" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
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
                                                <img
                                                    src={product.thumbnail}
                                                    alt={product.name}
                                                    className="w-full h-full object-cover"
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
                                                    <button className="w-full py-5 rounded-2xl bg-[#FF6B35] hover:bg-[#FF8F6B] text-black font-black uppercase tracking-widest text-sm transition-all shadow-[0_0_30px_rgba(255,107,53,0.3)]">
                                                        Try Trend
                                                    </button>
                                                    <button
                                                        onClick={() => addToCart(product)}
                                                        disabled={alreadyInCart}
                                                        className={`w-full py-5 rounded-2xl font-bold uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 border ${alreadyInCart
                                                                ? 'bg-green-500/10 text-green-500 border-green-500/20 cursor-not-allowed'
                                                                : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                                                            }`}
                                                    >
                                                        {alreadyInCart ? (
                                                            <>
                                                                <Check className="w-5 h-5" />
                                                                In Cart
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
                                        <div className="flex items-end justify-between mb-6">
                                            <span className="text-white/50 font-bold uppercase tracking-widest text-xs">Total Amount</span>
                                            <span className="text-4xl font-black text-white">₹{totalPrice}</span>
                                        </div>
                                        <button className="w-full py-5 bg-white text-black hover:bg-white/90 font-black uppercase tracking-widest text-sm rounded-2xl transition-all shadow-xl">
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
