"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../config/firebase';
import {
    createOrganisation,
    joinOrganisation,
    getOrganisation,
    isCustomDomain,
} from '../../services/userService';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Building,
    UserPlus,
    ArrowLeft,
    Loader2,
    CheckCircle,
    AlertCircle,
    Copy,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

type Tab = 'create' | 'join';

export default function OrganisationPage() {
    const router = useRouter();

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('create');
    const [canCreate, setCanCreate] = useState(false);

    // Create form state
    const [createForm, setCreateForm] = useState({
        name: '',
        description: '',
        sector: '',
        incorporated: false,
    });
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');
    const [createdOrgId, setCreatedOrgId] = useState('');
    const [copied, setCopied] = useState(false);

    // Join form state
    const [orgIdInput, setOrgIdInput] = useState('');
    const [joining, setJoining] = useState(false);
    const [joinError, setJoinError] = useState('');
    const [joinSuccess, setJoinSuccess] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser) {
                router.push('/login');
            } else {
                setUser(currentUser);
                setCanCreate(isCustomDomain(currentUser.email || ''));
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [router]);

    // --- Create ---
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setCreating(true);
        setCreateError('');
        try {
            const orgId = await createOrganisation({
                name: createForm.name,
                description: createForm.description,
                sector: createForm.sector,
                incorporated: createForm.incorporated,
                adminEmail: user.email,
                adminUid: user.uid,
            });
            setCreatedOrgId(orgId);
        } catch (err: any) {
            setCreateError(err.message || 'Failed to create organisation.');
        } finally {
            setCreating(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(createdOrgId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // --- Join ---
    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !orgIdInput.trim()) return;
        setJoining(true);
        setJoinError('');
        try {
            const org = await getOrganisation(orgIdInput.trim());
            if (!org) {
                setJoinError('Organisation not found. Please check the ID and try again.');
                return;
            }
            const result = await joinOrganisation(user.uid, user.email, orgIdInput.trim());
            if (result) {
                setJoinSuccess(true);
                setTimeout(() => router.push('/workspace'), 2500);
            } else {
                setJoinError('Failed to join organisation. Please try again.');
            }
        } catch (err: any) {
            setJoinError(err.message || 'An error occurred. Please try again.');
        } finally {
            setJoining(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-accent-orange animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white relative overflow-hidden">
            {/* Background Orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-orange/15 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1000ms' }} />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto px-6 py-12">
                {/* Back */}
                <Link
                    href="/workspace"
                    className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-10"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm font-medium">Back to Workspace</span>
                </Link>

                {/* Logo + Header */}
                <div className="text-center mb-10">
                    <Link href="/" className="inline-block mb-6">
                        <Image
                            src="/OKVEVO WithOut BackGrounds/White.svg"
                            alt="OKVEVO"
                            width={52}
                            height={52}
                            className="w-14 h-14 hover:scale-110 transition-transform"
                        />
                    </Link>
                    <h1 className="text-4xl font-black tracking-tight mb-2">
                        Organisation
                    </h1>
                    <p className="text-white/40 text-base">
                        Create a new organisation or join an existing one.
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 mb-8">
                    {([
                        { id: 'create', label: 'Create Organisation', icon: Building },
                        { id: 'join', label: 'Join Organisation', icon: UserPlus },
                    ] as { id: Tab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                                tab === id
                                    ? 'bg-accent-orange text-white shadow-lg shadow-accent-orange/30'
                                    : 'text-white/40 hover:text-white'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Panel */}
                <AnimatePresence mode="wait">
                    {/* ---- CREATE TAB ---- */}
                    {tab === 'create' && (
                        <motion.div
                            key="create"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.2 }}
                        >
                            {createdOrgId ? (
                                /* Success */
                                <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center">
                                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-6">
                                        <CheckCircle className="w-8 h-8 text-green-400" />
                                    </div>
                                    <h2 className="text-2xl font-black mb-2">Organisation Created!</h2>
                                    <p className="text-white/40 mb-8">Share this ID with team members to invite them.</p>

                                    <div className="bg-black/40 border border-white/10 rounded-2xl p-5 mb-6">
                                        <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Organisation ID</p>
                                        <div className="flex items-center justify-center gap-3">
                                            <code className="text-accent-orange font-mono text-base break-all">
                                                {createdOrgId}
                                            </code>
                                            <button
                                                onClick={handleCopy}
                                                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                                            >
                                                {copied
                                                    ? <CheckCircle className="w-4 h-4 text-green-400" />
                                                    : <Copy className="w-4 h-4 text-white/60" />
                                                }
                                            </button>
                                        </div>
                                    </div>

                                    <Link
                                        href="/workspace"
                                        className="inline-flex items-center justify-center w-full py-4 bg-accent-orange hover:bg-orange-600 text-white font-bold rounded-2xl transition-colors"
                                    >
                                        Go to Workspace
                                    </Link>
                                </div>
                            ) : !canCreate ? (
                                /* Custom domain required */
                                <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center">
                                    <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 rounded-full mb-6">
                                        <AlertCircle className="w-8 h-8 text-red-400" />
                                    </div>
                                    <h2 className="text-xl font-black mb-3">Custom Domain Required</h2>
                                    <p className="text-white/40 text-sm leading-relaxed">
                                        To create an organisation you need a work or school email
                                        (not Gmail, Yahoo, Outlook, etc.).<br /><br />
                                        You're signed in as <span className="text-white font-semibold">{user?.email}</span>.
                                    </p>
                                    <button
                                        onClick={() => setTab('join')}
                                        className="mt-8 inline-flex items-center gap-2 text-accent-orange font-bold hover:underline"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        Join an existing organisation instead
                                    </button>
                                </div>
                            ) : (
                                /* Create form */
                                <form
                                    onSubmit={handleCreate}
                                    className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-5"
                                >
                                    <div>
                                        <label className="block text-sm font-bold text-white/70 mb-2">Organisation Name *</label>
                                        <input
                                            type="text"
                                            value={createForm.name}
                                            onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                                            placeholder="e.g., Acme Corporation"
                                            required
                                            disabled={creating}
                                            className="w-full bg-black/40 border border-white/10 focus:border-accent-orange rounded-xl px-4 py-3.5 text-white placeholder:text-white/20 outline-none transition-colors"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-white/70 mb-2">Description *</label>
                                        <textarea
                                            value={createForm.description}
                                            onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                                            placeholder="Brief description of your organisation..."
                                            rows={3}
                                            required
                                            disabled={creating}
                                            className="w-full bg-black/40 border border-white/10 focus:border-accent-orange rounded-xl px-4 py-3.5 text-white placeholder:text-white/20 outline-none transition-colors resize-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-white/70 mb-2">Sector / Industry *</label>
                                        <select
                                            value={createForm.sector}
                                            onChange={e => setCreateForm(p => ({ ...p, sector: e.target.value }))}
                                            required
                                            disabled={creating}
                                            className="w-full bg-black/40 border border-white/10 focus:border-accent-orange rounded-xl px-4 py-3.5 text-white outline-none transition-colors"
                                        >
                                            <option value="">Select a sector</option>
                                            {['Technology', 'Healthcare', 'Finance', 'Education', 'Media & Entertainment', 'Retail', 'Manufacturing', 'Real Estate', 'Consulting', 'Non-Profit', 'Other'].map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-white/70 mb-3">Organisation Type *</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { val: true, title: 'Incorporated', sub: 'Registered company' },
                                                { val: false, title: 'Non-Incorporated', sub: 'Unregistered entity' },
                                            ].map(({ val, title, sub }) => (
                                                <button
                                                    key={String(val)}
                                                    type="button"
                                                    onClick={() => setCreateForm(p => ({ ...p, incorporated: val }))}
                                                    disabled={creating}
                                                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                                                        createForm.incorporated === val
                                                            ? 'bg-accent-orange/10 border-accent-orange text-white'
                                                            : 'bg-black/20 border-white/10 text-white/50 hover:border-white/30'
                                                    }`}
                                                >
                                                    <div className="font-bold text-sm">{title}</div>
                                                    <div className="text-xs opacity-60 mt-0.5">{sub}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {createError && (
                                        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                            {createError}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={creating}
                                        className="w-full flex items-center justify-center gap-2 py-4 bg-accent-orange hover:bg-orange-600 text-white font-black rounded-2xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Building className="w-5 h-5" />}
                                        {creating ? 'Creating...' : 'Create Organisation'}
                                    </button>
                                </form>
                            )}
                        </motion.div>
                    )}

                    {/* ---- JOIN TAB ---- */}
                    {tab === 'join' && (
                        <motion.div
                            key="join"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.2 }}
                        >
                            {joinSuccess ? (
                                <div className="bg-white/5 border border-white/10 rounded-3xl p-10 text-center">
                                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-6">
                                        <CheckCircle className="w-8 h-8 text-green-400" />
                                    </div>
                                    <h2 className="text-2xl font-black mb-2">Joined Successfully!</h2>
                                    <p className="text-white/40 mb-4">Redirecting you to workspace...</p>
                                    <Loader2 className="w-6 h-6 text-accent-orange animate-spin mx-auto" />
                                </div>
                            ) : (
                                <form
                                    onSubmit={handleJoin}
                                    className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-5"
                                >
                                    <div className="text-center pb-2">
                                        <div className="inline-flex items-center justify-center w-14 h-14 bg-accent-orange/10 rounded-2xl mb-4">
                                            <UserPlus className="w-7 h-7 text-accent-orange" />
                                        </div>
                                        <h2 className="text-xl font-black mb-1">Join an Organisation</h2>
                                        <p className="text-white/40 text-sm">
                                            Enter the Organisation ID shared by your admin.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-white/70 mb-2">Organisation ID *</label>
                                        <input
                                            type="text"
                                            value={orgIdInput}
                                            onChange={e => setOrgIdInput(e.target.value)}
                                            placeholder="e.g., org_1234567890_abc"
                                            required
                                            disabled={joining}
                                            className="w-full bg-black/40 border border-white/10 focus:border-accent-orange rounded-xl px-4 py-3.5 text-white placeholder:text-white/20 outline-none transition-colors font-mono"
                                        />
                                    </div>

                                    {joinError && (
                                        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                            {joinError}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={joining || !orgIdInput.trim()}
                                        className="w-full flex items-center justify-center gap-2 py-4 bg-accent-orange hover:bg-orange-600 text-white font-black rounded-2xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {joining ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                                        {joining ? 'Joining...' : 'Join Organisation'}
                                    </button>
                                </form>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
