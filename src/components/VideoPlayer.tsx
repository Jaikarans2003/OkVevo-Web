import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Download, Loader2 } from 'lucide-react';

interface VideoPlayerProps {
    videoUrls: (string | null)[];
    currentVideoIndex: number;
    setCurrentVideoIndex: (index: number) => void;
    onStitchVideos?: () => void;  // Optional - only for newly generated videos
    isStitching: boolean;
    stitchedVideoUrl: string | null;
}

export default function VideoPlayer({
    videoUrls,
    onStitchVideos,
    isStitching = false,
    stitchedVideoUrl = null
}: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasTriggeredStitch, setHasTriggeredStitch] = useState(false);

    // Auto-stitch when all videos are loaded
    useEffect(() => {
        // Check if we have exactly 3 videos and all are non-null URLs
        const hasAllVideos = videoUrls.length === 3 &&
            videoUrls.every(url => url !== null && url.length > 0);

        // Only trigger once when conditions are met
        if (hasAllVideos && !isStitching && !stitchedVideoUrl && !hasTriggeredStitch && onStitchVideos) {
            console.log('All 3 videos loaded with URLs, auto-stitching with Lambda...');
            setHasTriggeredStitch(true);
            onStitchVideos();
        }
    }, [videoUrls, isStitching, stitchedVideoUrl, hasTriggeredStitch, onStitchVideos]);

    const handlePlayPause = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleDownload = () => {
        if (!stitchedVideoUrl) return;
        const a = document.createElement('a');
        a.href = stitchedVideoUrl;
        a.download = 'brick2brick-final-movie.mp4';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    // Show loading state while stitching
    if (isStitching) {
        return (
            <div className="w-full bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 rounded-3xl shadow-2xl p-8 border border-purple-500/30">
                <div className="flex flex-col items-center justify-center space-y-6 min-h-[400px]">
                    <Loader2 className="w-16 h-16 text-custom-orange animate-spin" />
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-bold text-white">Stitching Your Video...</h3>
                        <p className="text-gray-400">AWS Lambda is creating smooth transitions with crossfade effects</p>
                        <p className="text-sm text-gray-500">This may take 1-2 minutes</p>
                    </div>
                </div>
            </div>
        );
    }

    // Show stitched video
    if (stitchedVideoUrl) {
        return (
            <div className="w-full bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 rounded-3xl shadow-2xl p-8 border border-purple-500/30">
                <div className="space-y-6">
                    {/* Video Display */}
                    <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-black border border-purple-500/20">
                        <video
                            ref={videoRef}
                            src={stitchedVideoUrl}
                            className="w-full aspect-video object-cover"
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            controls={false}
                        />
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between gap-4">
                        {/* Play/Pause Button */}
                        <button
                            onClick={handlePlayPause}
                            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg hover:shadow-purple-500/50 hover:scale-105"
                        >
                            {isPlaying ? (
                                <>
                                    <Pause className="w-5 h-5" />
                                    <span className="font-semibold">Pause</span>
                                </>
                            ) : (
                                <>
                                    <Play className="w-5 h-5" />
                                    <span className="font-semibold">Play</span>
                                </>
                            )}
                        </button>

                        {/* Download Button */}
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-custom-orange to-orange-600 text-white rounded-xl hover:from-orange-500 hover:to-orange-700 transition-all shadow-lg hover:shadow-orange-500/50 hover:scale-105 font-bold"
                        >
                            <Download className="w-5 h-5" />
                            <span>Download Full Video</span>
                        </button>
                    </div>

                    <div className="text-center text-sm text-gray-400">
                        ~58 seconds • Smooth crossfade transitions • Professional quality
                    </div>
                </div>
            </div>
        );
    }

    // Show waiting state (shouldn't normally be seen due to auto-stitch)
    return (
        <div className="w-full bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 rounded-3xl shadow-2xl p-8 border border-purple-500/30">
            <div className="flex flex-col items-center justify-center space-y-6 min-h-[400px]">
                <Loader2 className="w-16 h-16 text-purple-500 animate-spin" />
                <div className="text-center space-y-2">
                    <h3 className="text-2xl font-bold text-white">Preparing Your Video...</h3>
                    <p className="text-gray-400">Just a moment</p>
                </div>
            </div>
        </div>
    );
}
