'use client';

import { useState } from 'react';
import { db } from '@/config/firebase';
import { collection, addDoc, getDocs, deleteDoc, query } from 'firebase/firestore';
import { Shield, Database, Send, AlertTriangle, CheckCircle2 } from 'lucide-react';
import AdminGuard from '@/components/admin/AdminGuard';

const PRODUCTS_TO_MIGRATE = [
    {
        id: '14',
        name: 'Nazakat',
        type: 'photo',
        thumbnails: [
            '/masiv/nazakat/suit4.jpeg',
            '/masiv/nazakat/suit5.jpeg',
            '/masiv/nazakat/suit6.jpeg',
            '/masiv/nazakat/suit7.jpeg',
            '/masiv/nazakat/suit8.jpeg',
            '/masiv/nazakat/suit9.jpeg',
            '/masiv/nazakat/suit10.jpeg',
            '/masiv/nazakat/suit11.jpeg',
            '/masiv/nazakat/suit12.jpeg'
        ],
        description: 'Embrace your feminine side.',
        price: 2499,
        badge1: 'FEMALE',
        badge2: 'Ethereal'
    },
    {
        id: '13',
        name: 'Dhurandhar',
        type: 'photo',
        thumbnails: [
            '/masiv/dhurandharmale.png',
            '/masiv/dhurandharfemale.png'
        ],
        description: 'Embrace the legendary aura of a true Dhurandhar.',
        price: 2499,
        badge1: 'UNISEX',
        badge2: 'Legendary'
    },
    {
        id: '15', // Changed from 14 to avoid conflict
        name: 'Cenimatic Gangster',
        type: 'photo',
        thumbnails: [
            '/masiv/Cinematic Gangster Portrait Male.png',
            '/masiv/Cinematic Gangster Portrait Female.png'
        ],
        description: 'Own the streets with bold, cinematic mafia energy.',
        price: 2999,
        badge1: 'UNISEX',
        badge2: 'Trending'
    },
    {
        id: '4',
        name: 'Sky fall',
        type: 'video',
        thumbnails: [
            '/masiv/skyfall.mp4',
        ],
        description: 'Experience the thrill of freefall with cinematic sky-high visuals.',
        price: 2799,
        badge1: 'UNISEX',
        badge2: 'HUD'
    },
    {
        id: '3',
        name: 'Winter Hour',
        type: 'photo',
        thumbnails: [
            '/masiv/Winter hour Male.png',
            '/masiv/winterfemale.png'
        ],
        description: 'Capture calm, aesthetic winter vibes with soft elegance.',
        price: 1999,
        badge1: 'UNISEX',
        badge2: 'Clean'
    },
     {
        id: '1',
        name: 'Modern Mafia',
        type: 'photo',
        thumbnails: [
            '/masiv/Modern Mafia Male.png',
            '/masiv/Modern Mafia Female.png'
        ],
        description: 'Own the streets with bold, cinematic mafia energy.',
        price: 2999,
        badge1: 'UNISEX',
        badge2: 'Trending'
    },
    {
        id: '2',
        name: 'Warrior fighting',
        type: 'video',
        thumbnails: [
            '/masiv/horseback.mov',
        ],
        description: 'Unleash raw warrior power in every intense frame.',
        price: 1999,
        badge1: 'UNISEX',
        badge2: 'Clean'
    },
    {
        id: '8',
        name: 'Void Cast',
        type: 'photo',
        thumbnails: [
            '/masiv/voidmale.png',
            '/masiv/voidfemale.png'
        ],
        description: 'Dive into dark, mysterious visuals with cinematic depth.',
        price: 3499,
        badge1: 'UNISEX',
        badge2: 'Nature'
    },
    {
        id: '11',
        name: 'The Pause',
        type: 'photo',
        thumbnails: [
            '/masiv/pausemale.png',
            '/masiv/pausefemale.png'
        ],
        description: 'Freeze powerful emotions in stunning slow-motion moments.',
        price: 1599,
        badge1: 'UNISEX',
        badge2: 'Slow-Mo'
    },
     {
        id: '10',
        name: 'Vantaged',
        type: 'photo',
        thumbnails: ['/masiv/Vantaged Male 1.png', '/masiv/van1f.png', '/masiv/vantagedmale.png', '/masiv/van2f.png'],
        description: 'Bring timeless vintage aesthetics to life effortlessly.',
        price: 1599,
        badge1: 'UNISEX',
        badge2: 'Vintage'
    },
    {
        id: '6',
        name: 'Raw Glass',
        type: 'photo',
        thumbnails: [
            '/masiv/rawmale.png',
            '/masiv/rawfemale.png'
        ],
        description: 'Sleek glass visuals that redefine modern minimal aesthetics.',
        price: 2799,
        badge1: 'UNISEX',
        badge2: 'HUD'
    },
    {
        id: '9',
        name: 'Apex Editorial',
        type: 'photo',
        thumbnails: ['/masiv/apex1.png', '/masiv/apex1f.png', '/masiv/apex2.png', '/masiv/apex3f.png', '/masiv/apex3.png'],
        description: 'Create magazine-worthy looks with premium editorial style.',
        price: 1599,
        badge1: 'UNISEX',
        badge2: 'Editorial'
    },
    {
        id: '5',
        name: 'Hero v/s monster ',
        type: 'video',
        thumbnails: [
            '/masiv/hero.mov',
        ],
        description: 'Experience epic hero vs monster battles like never before.',
        price: 1999,
        badge1: 'UNISEX',
        badge2: 'Clean'
    },
    {
        id: '7',
        name: 'GTA Character',
        type: 'photo',
        thumbnails: [
            '/masiv/gtamale.png',
            '/masiv/gtafemale.png'
        ],
        description: 'Step into a GTA-style world with ultra-real character visuals.',
        price: 2499,
        badge1: 'UNISEX',
        badge2: 'Motion'
    },
   {
        id: '12',
        name: 'Off Set',
        type: 'photo',
        thumbnails: [
            '/masiv/offmale.png',
            '/masiv/offfemale.png'
        ],
        description: 'Capture raw, authentic studio moments with creative edge.',
        price: 1599,
        badge1: 'UNISEX',
        badge2: 'Studio'
    },
];

function MigrateProducts() {
    const [status, setStatus] = useState<'idle' | 'migrating' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const runMigration = async () => {
        if (!confirm('This will upload all 15 products to the "masiv_products" collection. Continue?')) return;
        
        setStatus('migrating');
        setMessage('Starting migration...');

        try {
            const colRef = collection(db, 'masiv_products');
            
            // Optional: Clear existing products first? No, let's just append for safety.
            // But if they run it twice, they get duplicates.
            
            for (const product of PRODUCTS_TO_MIGRATE) {
                setMessage(`Migrating: ${product.name}...`);
                await addDoc(colRef, {
                    ...product,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }

            setStatus('success');
            setMessage(`Successfully migrated ${PRODUCTS_TO_MIGRATE.length} products!`);
        } catch (error: any) {
            console.error('Migration error:', error);
            setStatus('error');
            setMessage('Error: ' + error.message);
        }
    };

    const clearDatabase = async () => {
        if (!confirm('DANGER: This will delete ALL products from "masiv_products". Are you sure?')) return;
        
        setStatus('migrating');
        setMessage('Clearing collection...');

        try {
            const q = query(collection(db, 'masiv_products'));
            const snapshot = await getDocs(q);
            
            for (const doc of snapshot.docs) {
                await deleteDoc(doc.ref);
            }

            setStatus('success');
            setMessage('Collection cleared successfully!');
        } catch (error: any) {
            setStatus('error');
            setMessage('Error clearing: ' + error.message);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
            <div className="max-w-xl w-full bg-[#111] border border-white/10 rounded-[2.5rem] p-10 shadow-2xl">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                        <Database className="w-6 h-6 text-orange-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight uppercase">Product Migration</h1>
                        <p className="text-gray-400 text-sm">Transfer hardcoded products to Firestore</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-6">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-white/50 mb-4">Migration Details</h2>
                        <ul className="space-y-3">
                            <li className="flex items-center gap-3 text-sm">
                                <Shield className="w-4 h-4 text-green-500" />
                                <span>Target Collection: <code className="text-orange-400">masiv_products</code></span>
                            </li>
                            <li className="flex items-center gap-3 text-sm">
                                <Shield className="w-4 h-4 text-green-500" />
                                <span>Products to upload: <span className="font-bold">{PRODUCTS_TO_MIGRATE.length}</span></span>
                            </li>
                        </ul>
                    </div>

                    {status === 'migrating' && (
                        <div className="flex flex-col items-center gap-4 py-6">
                            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-orange-400 font-bold animate-pulse">{message}</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 flex flex-col items-center gap-3">
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                            <p className="text-green-500 font-bold text-center">{message}</p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 flex flex-col items-center gap-3">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                            <p className="text-red-500 font-bold text-center">{message}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 mt-8">
                        <button
                            onClick={runMigration}
                            disabled={status === 'migrating'}
                            className="w-full py-5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-xl shadow-orange-500/20 flex items-center justify-center gap-3"
                        >
                            <Send className="w-4 h-4" /> Start Migration
                        </button>
                        
                        <button
                            onClick={clearDatabase}
                            disabled={status === 'migrating'}
                            className="w-full py-4 bg-transparent hover:bg-red-500/10 text-red-500/50 hover:text-red-500 border border-white/5 hover:border-red-500/30 font-bold uppercase tracking-widest text-[10px] rounded-2xl transition-all"
                        >
                            Clear Collection (Reset)
                        </button>
                    </div>

                    <p className="text-[10px] text-center text-white/20 mt-6 leading-relaxed">
                        After the migration is successful, you can verify the data in your Firebase Console and then delete this migration page file.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function MigrateProductsPage() {
    return (
        <AdminGuard>
            <MigrateProducts />
        </AdminGuard>
    );
}

