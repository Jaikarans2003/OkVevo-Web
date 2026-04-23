'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Video, Volume2, Loader2, CheckCircle2 } from 'lucide-react';
import AvatarProfileCard from './AvatarProfileCard';
import { getUserAvatarProfiles, type AvatarProfile } from '@/services/AvatarProfileService';

interface AvatarSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectSaved: (profile: AvatarProfile) => void;
    onUploadNew: (videoFile: File, audioFile: File) => void;
    userId: string;
}

export default function AvatarSelectionModal({
    isOpen,
    onClose,
    onSelectSaved,
    onUploadNew,
    userId,
}: AvatarSelectionModalProps) {
    const [activeTab, setActiveTab] = useState<'saved' | 'upload'>('saved');
    const [profiles, setProfiles] = useState<AvatarProfile[]>([]);
    const [selectedProfile, setSelectedProfile] = useState<AvatarProfile | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Upload state
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && userId) {
            loadProfiles();
        }
    }, [isOpen, userId]);

    const loadProfiles = async () => {
        setLoading(true);
        try {
            const userProfiles = await getUserAvatarProfiles(userId);
            setProfiles(userProfiles);
            
            // Auto-switch to upload tab if no profiles
            if (userProfiles.length === 0) {
                setActiveTab('upload');
            }
        } catch (error) {
            console.error('Failed to load profiles:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectProfile = (profile: AvatarProfile) => {
        setSelectedProfile(profile);
    };

    const handleConfirmSaved = () => {
        if (selectedProfile) {
            onSelectSaved(selectedProfile);
            onClose();
        }
    };

    const handleConfirmUpload = () => {
        if (videoFile && audioFile) {
            onUploadNew(videoFile, audioFile);
            onClose();
        }
    };

    const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setVideoFile(file);
        }
    };

    const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAudioFile(file);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-4xl max-h-[85vh] bg-[#0B0B0D] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
                >
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-black uppercase tracking-wider text-white">
                                Select Avatar
                            </h2>
                            <p className="text-xs text-white/40 mt-1">
                                Choose from saved profiles or upload new
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        >
                            <X size={20} className="text-white/60" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="px-6 pt-4 flex gap-2 border-b border-white/5">
                        <button
                            onClick={() => setActiveTab('saved')}
                            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-lg transition-all ${
                                activeTab === 'saved'
                                    ? 'bg-orange-500/20 text-orange-400 border-b-2 border-orange-500'
                                    : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                            }`}
                        >
                            Saved Profiles ({profiles.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('upload')}
                            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-lg transition-all ${
                                activeTab === 'upload'
                                    ? 'bg-orange-500/20 text-orange-400 border-b-2 border-orange-500'
                                    : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                            }`}
                        >
                            Upload New
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        {activeTab === 'saved' ? (
                            <div>
                                {loading ? (
                                    <div className="flex items-center justify-center py-20">
                                        <Loader2 size={32} className="text-orange-400 animate-spin" />
                                    </div>
                                ) : profiles.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                                            <Video size={24} className="text-white/40" />
                                        </div>
                                        <p className="text-sm text-white/60 font-bold mb-2">
                                            No saved avatar profiles
                                        </p>
                                        <p className="text-xs text-white/30 mb-4">
                                            Create profiles in Avatar Profiles page
                                        </p>
                                        <button
                                            onClick={() => setActiveTab('upload')}
                                            className="px-4 py-2 bg-orange-500/20 text-orange-400 text-xs font-black uppercase tracking-wider rounded-lg hover:bg-orange-500/30 transition-all"
                                        >
                                            Upload New Instead
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {profiles.map((profile) => (
                                            <AvatarProfileCard
                                                key={profile.id}
                                                profile={profile}
                                                selectable
                                                selected={selectedProfile?.id === profile.id}
                                                onSelect={handleSelectProfile}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="max-w-xl mx-auto space-y-6">
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

                                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                                    <p className="text-xs text-yellow-200/80">
                                        <strong>Note:</strong> This upload is for one-time use only. To save for future use, visit the Avatar Profiles page.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between gap-4">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 text-xs font-black uppercase tracking-wider text-white/60 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        
                        {activeTab === 'saved' ? (
                            <button
                                onClick={handleConfirmSaved}
                                disabled={!selectedProfile}
                                className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-500 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:from-orange-500 hover:shadow-[0_0_25px_rgba(234,88,12,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
                            >
                                Use Selected Profile
                            </button>
                        ) : (
                            <button
                                onClick={handleConfirmUpload}
                                disabled={!videoFile || !audioFile}
                                className="px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-500 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:from-orange-500 hover:shadow-[0_0_25px_rgba(234,88,12,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
                            >
                                Continue with Upload
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
