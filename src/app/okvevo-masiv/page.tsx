'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, ShoppingCart } from 'lucide-react';

// Sample data - replace with actual data source
const products = [
    {
        id: '1',
        name: 'Neon City Pack',
        thumbnail: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=400&h=400&fit=crop',
        description: 'Cyberpunk cityscape assets for video production',
        price: 2999,
    },
    {
        id: '2',
        name: 'Luxury Minimal',
        thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=400&fit=crop',
        description: 'Clean, minimal backgrounds for product shots',
        price: 1999,
    },
    {
        id: '3',
        name: 'Abstract Flow',
        thumbnail: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=400&h=400&fit=crop',
        description: 'Fluid abstract motion graphics pack',
        price: 2499,
    },
    {
        id: '4',
        name: 'Nature Cinematic',
        thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop',
        description: 'Stunning nature footage and overlays',
        price: 3499,
    },
    {
        id: '5',
        name: 'Tech HUD Elements',
        thumbnail: 'https://images.unsplash.com/photo-1535868463750-c78d9543614f?w=400&h=400&fit=crop',
        description: 'Futuristic UI elements and overlays',
        price: 2799,
    },
    {
        id: '6',
        name: 'Film Grain Collection',
        thumbnail: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&h=400&fit=crop',
        description: 'Authentic film grain overlays for vintage look',
        price: 1599,
    },
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
    const [activeTab, setActiveTab] = useState('Trending');

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
        <div className="min-h-screen bg-[#0B0B0D] text-white selection:bg-[#FF6B35]/30 font-sans pb-20">
            {/* Minimal Subtle Grain Overlay */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-[100]"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
            />

            {/* Custom Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-[#0B0B0D]/80 backdrop-blur-md border-b border-white/10">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    {/* Center - Logo */}
                    <div className="flex-1 flex justify-center">
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-bold tracking-tight">OKVEVO</span>
                            <span className="text-[#FF6B35] font-bold">x</span>
                            <span className="text-xl font-bold tracking-tight text-[#FF6B35]">MASIV</span>
                        </div>
                    </div>

                    {/* Right - Cart */}
                    <div className="absolute right-6">
                        <button
                            onClick={() => setShowCart(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-[#FF6B35] hover:bg-[#FF8F6B] rounded-full transition-colors"
                        >
                            <ShoppingCart className="w-5 h-5" />
                            <span className="font-medium">{cart.length}</span>
                        </button>
                    </div>
                </div>
            </nav>

            <main className="pt-24">
                {/* Title Section - Below Navbar */}
                <section className="px-6 pt-8 pb-4">
                    <div className="max-w-7xl mx-auto">
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                            <span className="bg-gradient-to-r from-[#FF6B35] to-[#FF8F6B] bg-clip-text text-transparent">AI</span> Trends
                        </h1>
                        <p className="text-base text-white/60 mt-2">
                            Create stunning visual content with click of a Button.
                        </p>
                    </div>
                </section>
               
                

                {/* Tabs */}
                <section className="px-6 pb-4">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex items-center gap-2">
                            {['Trending', 'Photos', 'Videos'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-6 py-3 rounded-full font-medium transition-all ${
                                        activeTab === tab
                                            ? 'bg-[#FF6B35] text-white'
                                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Product Grid */}
                <section className="py-12 px-6">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {products.map((product) => (
                                <motion.div
                                    key={product.id}
                                    layoutId={`card-${product.id}`}
                                    onClick={() => setSelectedCard(product.id)}
                                    className={`group relative bg-white/5 border border-white/10 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:bg-white/10 ${
                                        selectedCard === product.id ? 'ring-2 ring-[#FF6B35]' : ''
                                    }`}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {/* Thumbnail */}
                                    <div className="aspect-square overflow-hidden">
                                        <img
                                            src={product.thumbnail}
                                            alt={product.name}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        />
                                    </div>

                                    {/* Name & Price */}
                                    <div className="p-4">
                                        <h3 className="text-lg font-semibold text-white mb-1">{product.name}</h3>
                                        <p className="text-sm text-white/60 line-clamp-2">{product.description}</p>
                                        <div className="mt-3 flex items-center justify-between">
                                            <span className="text-[#FF6B35] font-bold">₹{product.price}</span>
                                            {isInCart(product.id) && (
                                                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                                                    In Cart
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>
            </main>

            {/* Expanded Card Modal */}
            <AnimatePresence>
                {selectedCard && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedCard(null)}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4"
                    >
                        {(() => {
                            const product = products.find(p => p.id === selectedCard);
                            if (!product) return null;
                            const alreadyInCart = isInCart(product.id);

                            return (
                                <motion.div
                                    layoutId={`card-${product.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="relative bg-[#1a1a1a] border border-white/20 rounded-3xl max-w-2xl w-full overflow-hidden"
                                >
                                    {/* Close Button */}
                                    <button
                                        onClick={() => setSelectedCard(null)}
                                        className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>

                                    {/* Expanded Content */}
                                    <div className="aspect-video overflow-hidden">
                                        <img
                                            src={product.thumbnail}
                                            alt={product.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>

                                    <div className="p-8">
                                        <h2 className="text-3xl font-bold mb-4">{product.name}</h2>
                                        <p className="text-white/70 text-lg mb-6">{product.description}</p>

                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="text-sm text-white/50">Price</span>
                                                <p className="text-3xl font-bold text-[#FF6B35]">₹{product.price}</p>
                                            </div>

                                            <button
                                                onClick={() => addToCart(product)}
                                                disabled={alreadyInCart}
                                                className={`flex items-center gap-3 px-8 py-4 rounded-xl font-semibold transition-all ${
                                                    alreadyInCart
                                                        ? 'bg-green-500/20 text-green-400 cursor-not-allowed'
                                                        : 'bg-[#FF6B35] hover:bg-[#FF8F6B] text-white'
                                                }`}
                                            >
                                                {alreadyInCart ? (
                                                    <span>Added to Cart</span>
                                                ) : (
                                                    <>
                                                        <Plus className="w-6 h-6" />
                                                        <span>Add to Cart</span>
                                                    </>
                                                )}
                                            </button>
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
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200]"
                    >
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-0 h-full w-full max-w-md bg-[#1a1a1a] border-l border-white/10"
                        >
                            <div className="p-6 h-full flex flex-col">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-2xl font-bold">Your Cart</h2>
                                    <button
                                        onClick={() => setShowCart(false)}
                                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* Cart Items */}
                                <div className="flex-1 overflow-y-auto space-y-4">
                                    {cart.length === 0 ? (
                                        <div className="text-center py-12 text-white/50">
                                            <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                            <p>Your cart is empty</p>
                                        </div>
                                    ) : (
                                        cart.map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between p-4 bg-white/5 rounded-xl"
                                            >
                                                <div>
                                                    <h4 className="font-medium">{item.name}</h4>
                                                    <p className="text-[#FF6B35] font-semibold">₹{item.price}</p>
                                                </div>
                                                <button
                                                    onClick={() => removeFromCart(item.id)}
                                                    className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Footer */}
                                {cart.length > 0 && (
                                    <div className="border-t border-white/10 pt-4 mt-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-lg">Total</span>
                                            <span className="text-2xl font-bold text-[#FF6B35]">₹{totalPrice}</span>
                                        </div>
                                        <button className="w-full py-4 bg-[#FF6B35] hover:bg-[#FF8F6B] text-white font-semibold rounded-xl transition-colors">
                                            Checkout
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
