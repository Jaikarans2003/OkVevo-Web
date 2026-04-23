'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '@/config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { 
    Plus, 
    Video, 
    Upload, 
    X, 
    AlertCircle, 
    Loader2, 
    CheckCircle2, 
    Volume2 
} from 'lucide-react';
import StudioNavbar from '@/components/workspace/StudioNavbar';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import AvatarProfileCard from '@/components/workspace/AvatarProfileCard';
import Image from 'next/image';
import {
    getUserAvatarProfiles,
    createAvatarProfile,
    deleteAvatarProfile,
    canAddProfile,
    type AvatarProfile,
    type UploadProgress,
} from '@/services/AvatarProfileService';

export default function AvatarProfilesPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [profiles, setProfiles] = useState<AvatarProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [canAdd, setCanAdd] = useState(true);
    
    // Upload state
    const [uploading, setUploading] = useState(false);
    const [avatarName, setAvatarName] = useState('');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
        videoProgress: 0,
        audioProgress: 0,
        thumbnailProgress: 0,
        stage: 'video'
    });
    const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
    const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
    
    const videoInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            if (u) {
                setUser(u);
                loadProfiles(u.uid);
            } else {
                router.push('/');
            }
        });
        return () => unsub();
    }, [router]);

    const loadProfiles = async (userId: string) => {
        setLoading(true);
        try {
            const [userProfiles, canAddMore] = await Promise.all([
                getUserAvatarProfiles(userId),
                canAddProfile(userId),
            ]);
            setProfiles(userProfiles);
            setCanAdd(canAddMore);
        } catch (err) {
            console.error('Failed to load profiles:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenUploadModal = () => {
        setShowUploadModal(true);
        setError(null);
        setAvatarName('');
        setVideoFile(null);
        setAudioFile(null);
        setVideoPreviewUrl(null);
        setAudioPreviewUrl(null);
    };

    const handleCloseUploadModal = () => {
        setShowUploadModal(false);
        setError(null);
        setAvatarName('');
        setVideoFile(null);
        setAudioFile(null);
        if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
        if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
        setVideoPreviewUrl(null);
        setAudioPreviewUrl(null);
    };

    const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
            const previewUrl = URL.createObjectURL(file);
            setVideoPreviewUrl(previewUrl);
            setVideoFile(file);
            setError(null);
        }
    };

    const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate MP3
            if (!file.type.includes('mp3') && !file.name.toLowerCase().endsWith('.mp3')) {
                setError('Audio file must be in MP3 format');
                return;
            }
            if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
            const previewUrl = URL.createObjectURL(file);
            setAudioPreviewUrl(previewUrl);
            setAudioFile(file);
            setError(null);
        }
    };

    const handleCreateProfile = async () => {
        if (!user?.uid || !avatarName || !videoFile || !audioFile) {
            setError('Please fill in all fields');
            return;
        }

        setUploading(true);
        setError(null);
        setUploadProgress({
            videoProgress: 0,
            audioProgress: 0,
            thumbnailProgress: 0,
            stage: 'video'
        });

        try {
            const newProfile = await createAvatarProfile(
                user.uid,
                avatarName,
                videoFile,
                audioFile,
                (progress) => {
                    setUploadProgress(progress);
                }
            );
            
            setProfiles(prev => [newProfile, ...prev]);
            setCanAdd(profiles.length + 1 < 5);
            handleCloseUploadModal();
        } catch (err: any) {
            setError(err.message || 'Failed to create avatar profile');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteProfile = async (profileId: string) => {
        if (!user?.uid) return;

        setDeletingId(profileId);
        try {
            await deleteAvatarProfile(user.uid, profileId);
            setProfiles(prev => prev.filter(p => p.id !== profileId));
            setCanAdd(true);
        } catch (err) {
            console.error('Failed to delete profile:', err);
        } finally {
            setDeletingId(null);
        }
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="mb-6 animate-pulse">
                        <Image
                            src="/OKVEVO WithOut BackGrounds/Orange.svg"
                            alt="OKVEVO Logo"
                            width={80}
                            height={80}
                            className="mx-auto"
                        />
                    </div>
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-white/60">Loading your Canvas</p>
                </div>
            </div>
        );
    }

    return (
        <SubscriptionGuard>
            <section className="relative min-h-screen bg-black text-white font-sans selection:bg-[#E2FF4D]/30 overflow-hidden">
                <StudioNavbar />

                {/* Background Video with Hue-Shift to Orange */}
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="fixed inset-0 w-full h-full object-cover opacity-50"
                    style={{ filter: 'hue-rotate(145deg) saturate(1.4) brightness(0.7)' }}
                >
                    <source src="/videos/bg-blue.mp4" type="video/mp4" />
                </video>

                {/* Global Textural Dot Grid (Stitch Aesthetic) */}
                <div className="fixed inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-20 z-0" />

                {/* Orange Ambient Light Overlay */}
                <div className="fixed inset-0 bg-orange-600/5 pointer-events-none z-0 mix-blend-overlay" />
                
                <div className="relative z-10 max-w-7xl mx-auto px-6 py-24">
                    {/* Header */}
                    <div className="mb-12">
                        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-4">
                            Avatar Profiles
                        </h1>
                        <p className="text-white/60 text-sm max-w-2xl">
                            Save your avatar videos and voice samples for quick reuse in AI Influencer projects. 
                        </p>
                    </div>

                    {/* Add New Button */}
                    <div className="mb-8">
                        <button
                            onClick={handleOpenUploadModal}
                            disabled={!canAdd}
                            className="px-6 py-4 bg-gradient-to-r from-orange-600 to-orange-500 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:from-orange-500 hover:shadow-[0_0_25px_rgba(234,88,12,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-xl"
                        >
                            <Plus size={16} />
                            Add New Avatar {!canAdd && '(Max 5 reached)'}
                        </button>
                    </div>

                    {/* Profiles Grid */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="mb-6 animate-pulse">
                                <Image
                                    src="/OKVEVO WithOut BackGrounds/Orange.svg"
                                    alt="OKVEVO Logo"
                                    width={64}
                                    height={64}
                                    className="mx-auto"
                                />
                            </div>
                            <p className="text-sm font-black uppercase tracking-[0.2em] text-white/60">Loading your Canvas</p>
                        </div>
                    ) : profiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                                <Video size={32} className="text-white/40" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">
                                No Avatar Profiles Yet
                            </h3>
                            <p className="text-sm text-white/40 mb-6 max-w-md">
                                Create your first avatar profile to save time on AI Influencer projects.
                            </p>
                            {/* <button
                                onClick={handleOpenUploadModal}
                                className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-500 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:from-orange-500 hover:shadow-[0_0_25px_rgba(234,88,12,0.3)] transition-all flex items-center gap-2 shadow-xl"
                            >
                                <Plus size={16} />
                                Create First Profile
                            </button> */}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                            {profiles.map((profile) => (
                                <AvatarProfileCard
                                    key={profile.id}
                                    profile={profile}
                                    onDelete={handleDeleteProfile}
                                    isDeleting={deletingId === profile.id}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Upload Modal */}
                <AnimatePresence>
                    {showUploadModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={handleCloseUploadModal}
                                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            />

                            {/* Modal */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative w-full max-w-2xl bg-[#0B0B0D] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                            >
                                {/* Header */}
                                <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-black uppercase tracking-wider text-white">
                                            Create Avatar Profile
                                        </h2>
                                        <p className="text-xs text-white/40 mt-1">
                                            Upload video and voice sample
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleCloseUploadModal}
                                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                                    >
                                        <X size={20} className="text-white/60" />
                                    </button>
                                </div>

                                {/* Content */}
                                <div className="p-6">
                                    {/* Error Message */}
                                    {error && (
                                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 mb-6">
                                            <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                                            <p className="text-sm text-red-200">{error}</p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* Left Column - Upload Controls */}
                                        <div className="space-y-6">
                                            {/* Avatar Name */}
                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-white/60 mb-3">
                                                    Avatar Name
                                                </label>
                                                <input
                                                    type="text"
                                                    value={avatarName}
                                                    onChange={(e) => setAvatarName(e.target.value)}
                                                    placeholder="e.g., Professional Avatar, Casual Look"
                                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
                                                    maxLength={50}
                                                />
                                                <p className="text-[10px] text-white/30 mt-2">
                                                    {avatarName.length}/50 characters
                                                </p>
                                            </div>

                                            {/* Video Upload */}
                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-white/60 mb-3">
                                                    Avatar Video
                                                </label>
                                                <input
                                                    ref={videoInputRef}
                                                    type="file"
                                                    accept="video/mp4,video/quicktime,video/webm"
                                                    onChange={handleVideoChange}
                                                    className="hidden"
                                                />
                                                <button
                                                    onClick={() => videoInputRef.current?.click()}
                                                    className="w-full p-6 border-2 border-dashed border-white/20 rounded-2xl hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group"
                                                >
                                                    {videoFile ? (
                                                        <div className="flex items-center gap-3">
                                                            <CheckCircle2 size={20} className="text-green-400" />
                                                            <div className="text-left flex-1">
                                                                <p className="text-sm font-bold text-white truncate">
                                                                    {videoFile.name}
                                                                </p>
                                                                <p className="text-xs text-white/40">
                                                                    {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-2">
                                                            <Video size={24} className="text-white/40 group-hover:text-orange-400 transition-colors" />
                                                            <p className="text-xs font-bold text-white/60 group-hover:text-white/80">
                                                                Click to upload video
                                                            </p>
                                                            <p className="text-[10px] text-white/30">
                                                                MP4, MOV, or WebM
                                                            </p>
                                                        </div>
                                                    )}
                                                </button>
                                            </div>

                                            {/* Audio Upload */}
                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-white/60 mb-3">
                                                    Voice Sample (MP3)
                                                </label>
                                                <input
                                                    ref={audioInputRef}
                                                    type="file"
                                                    accept="audio/mp3,audio/mpeg"
                                                    onChange={handleAudioChange}
                                                    className="hidden"
                                                />
                                                <button
                                                    onClick={() => audioInputRef.current?.click()}
                                                    className="w-full p-6 border-2 border-dashed border-white/20 rounded-2xl hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group"
                                                >
                                                    {audioFile ? (
                                                        <div className="flex items-center gap-3">
                                                            <CheckCircle2 size={20} className="text-green-400" />
                                                            <div className="text-left flex-1">
                                                                <p className="text-sm font-bold text-white truncate">
                                                                    {audioFile.name}
                                                                </p>
                                                                <p className="text-xs text-white/40">
                                                                    {(audioFile.size / 1024 / 1024).toFixed(1)} MB
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-2">
                                                            <Volume2 size={24} className="text-white/40 group-hover:text-orange-400 transition-colors" />
                                                            <p className="text-xs font-bold text-white/60 group-hover:text-white/80">
                                                                Click to upload audio
                                                            </p>
                                                            <p className="text-[10px] text-white/30">
                                                                MP3 format only
                                                            </p>
                                                        </div>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Right Column - Preview */}
                                        <div className="space-y-4">
                                            {/* Video Preview */}
                                            {videoPreviewUrl && (
                                                <div>
                                                    <label className="block text-xs font-black uppercase tracking-wider text-white/60 mb-3">
                                                        Video Preview
                                                    </label>
                                                    <div className="bg-black/40 rounded-xl overflow-hidden border border-white/10">
                                                        <video
                                                            src={videoPreviewUrl}
                                                            controls
                                                            className="w-full aspect-video"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Audio Preview */}
                                            {audioPreviewUrl && (
                                                <div>
                                                    <label className="block text-xs font-black uppercase tracking-wider text-white/60 mb-3">
                                                        Audio Preview
                                                    </label>
                                                    <div className="bg-black/40 rounded-xl p-4 border border-white/10">
                                                        <audio
                                                            src={audioPreviewUrl}
                                                            controls
                                                            className="w-full"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Placeholder when no files */}
                                            {!videoPreviewUrl && !audioPreviewUrl && (
                                                <div className="flex items-center justify-center h-full min-h-[300px] border-2 border-dashed border-white/10 rounded-xl">
                                                    <div className="text-center">
                                                        <Video size={48} className="text-white/20 mx-auto mb-3" />
                                                        <p className="text-sm text-white/40">
                                                            Preview will appear here
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Upload Progress */}
                                    {uploading && (
                                        <div className="space-y-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold text-white">
                                                    {uploadProgress.stage === 'video' && 'Uploading Video...'}
                                                    {uploadProgress.stage === 'audio' && 'Uploading Audio...'}
                                                    {(uploadProgress.stage === 'thumbnail' || uploadProgress.stage === 'saving') && 'Finalizing...'}
                                                    {uploadProgress.stage === 'complete' && 'Complete!'}
                                                </span>
                                                <span className="text-xs font-bold text-orange-400">
                                                    {uploadProgress.stage === 'video' && `${Math.round(uploadProgress.videoProgress)}%`}
                                                    {uploadProgress.stage === 'audio' && `${Math.round(uploadProgress.audioProgress)}%`}
                                                    {(uploadProgress.stage === 'thumbnail' || uploadProgress.stage === 'saving' || uploadProgress.stage === 'complete') && '100%'}
                                                </span>
                                            </div>
                                            
                                            {/* Video Progress Bar */}
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[10px] text-white/60">Video Upload</span>
                                                    <span className="text-[10px] text-white/40">{Math.round(uploadProgress.videoProgress)}%</span>
                                                </div>
                                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-gradient-to-r from-orange-600 to-orange-500 transition-all duration-300"
                                                        style={{ width: `${uploadProgress.videoProgress}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Audio Progress Bar */}
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[10px] text-white/60">Audio Upload</span>
                                                    <span className="text-[10px] text-white/40">{Math.round(uploadProgress.audioProgress)}%</span>
                                                </div>
                                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-gradient-to-r from-orange-600 to-orange-500 transition-all duration-300"
                                                        style={{ width: `${uploadProgress.audioProgress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between gap-4">
                                    <button
                                        onClick={handleCloseUploadModal}
                                        disabled={uploading}
                                        className="px-6 py-3 text-xs font-black uppercase tracking-wider text-white/60 hover:text-white transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    
                                    <button
                                        onClick={handleCreateProfile}
                                        disabled={!avatarName || !videoFile || !audioFile || uploading}
                                        className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-500 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:from-orange-500 hover:shadow-[0_0_25px_rgba(234,88,12,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-xl"
                                    >
                                        {uploading ? (
                                            <>
                                                <Loader2 size={14} className="animate-spin" />
                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={14} />
                                                Create Profile
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </section>
        </SubscriptionGuard>
    );
}
