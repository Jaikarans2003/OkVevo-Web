'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Video, Volume2, Calendar } from 'lucide-react';
import type { AvatarProfile } from '@/services/AvatarProfileService';

interface AvatarProfileCardProps {
    profile: AvatarProfile;
    onDelete?: (profileId: string) => void;
    onSelect?: (profile: AvatarProfile) => void;
    isDeleting?: boolean;
    selectable?: boolean;
    selected?: boolean;
}

export default function AvatarProfileCard({
    profile,
    onDelete,
    onSelect,
    isDeleting = false,
    selectable = false,
    selected = false,
}: AvatarProfileCardProps) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (showDeleteConfirm) {
            onDelete?.(profile.id);
            setShowDeleteConfirm(false);
        } else {
            setShowDeleteConfirm(true);
        }
    };

    const handleCardClick = () => {
        if (selectable && onSelect) {
            onSelect(profile);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={handleCardClick}
            className={`relative group bg-white/5 backdrop-blur-xl rounded-2xl border overflow-hidden transition-all ${
                selectable ? 'cursor-pointer hover:bg-white/10' : ''
            } ${
                selected 
                    ? 'border-orange-500/50 bg-orange-500/10' 
                    : 'border-white/10 hover:border-white/20'
            }`}
        >
            {/* Video Preview */}
            <div className="relative bg-black/40 overflow-hidden" style={{ aspectRatio: '9/16' }}>
                <video
                    ref={videoRef}
                    src={profile.videoUrl}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                />

                {/* Selected Badge */}
                {selected && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-orange-500 rounded-lg text-[9px] font-black uppercase tracking-wider text-white">
                        Selected
                    </div>
                )}
            </div>

            {/* Info Section */}
            <div className="p-4 space-y-3">
                {/* Name */}
                <h3 className="text-sm font-bold text-white truncate">
                    {profile.name}
                </h3>

                {/* Metadata */}
                <div className="flex items-center gap-3 text-[10px] text-white/40">
                    <div className="flex items-center gap-1">
                        <Video size={10} />
                        <span>Video</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Volume2 size={10} />
                        <span>Audio</span>
                    </div>
                </div>

                {/* Date */}
                <div className="flex items-center gap-1.5 text-[9px] text-white/30">
                    <Calendar size={9} />
                    <span>{formatDate(profile.createdAt)}</span>
                </div>
            </div>

            {/* Delete Button - initial hover state */}
            {onDelete && !selectable && !showDeleteConfirm && (
                <button
                    onClick={handleDeleteClick}
                    disabled={isDeleting}
                    className="absolute top-2 right-2 z-10 p-2 rounded-lg transition-all bg-black/60 text-white/60 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white disabled:opacity-50"
                    title="Delete profile"
                >
                    <Trash2 size={12} />
                </button>
            )}

            {/* Delete Confirm Overlay - button lives INSIDE so mouseleave doesn't fire on hover */}
            {onDelete && !selectable && showDeleteConfirm && (
                <div
                    className="absolute inset-0 z-10 flex items-center justify-center bg-black/75 backdrop-blur-sm rounded-2xl"
                    onMouseLeave={() => setShowDeleteConfirm(false)}
                >
                    <div className="text-center space-y-3 px-4">
                        <p className="text-xs font-bold text-white uppercase tracking-wider">Delete Avatar?</p>
                        <div className="flex gap-2 justify-center">
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}
                                className="px-3 py-1.5 text-[10px] font-black uppercase rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteClick}
                                disabled={isDeleting}
                                className="px-3 py-1.5 text-[10px] font-black uppercase rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-50 flex items-center gap-1"
                            >
                                {isDeleting ? (
                                    <div className="w-3 h-3 border border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Trash2 size={10} />
                                        Delete
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
