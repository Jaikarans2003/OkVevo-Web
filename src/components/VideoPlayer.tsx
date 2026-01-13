import React, { useRef, useState } from 'react';
import { Film, Image, Play, Pause, Download, Video, Scissors, Crop, X, Plus, Loader2, Sparkles } from 'lucide-react';
import { videoStitcher } from '../services/VideoStitcherService';

interface VideoPlayerProps {
    videoUrls: (string | null)[]; // Update type to accept nulls
    currentVideoIndex: number;
    setCurrentVideoIndex: React.Dispatch<React.SetStateAction<number>>;
}

export default function VideoPlayer({ videoUrls, currentVideoIndex, setCurrentVideoIndex }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // UI State
    const [isPlaying, setIsPlaying] = useState(false);
    const [showEditor, setShowEditor] = useState(true);

    // Editing State
    const [videoDuration, setVideoDuration] = useState(0);
    const [trimStart, setTrimStart] = useState(0);
    const [trimEnd, setTrimEnd] = useState(0);
    const [cropSettings, setCropSettings] = useState({ x: 0, y: 0, width: 100, height: 100 });
    const [draggedItem, setDraggedItem] = useState<string | null>(null);

    // Stitching State
    const [isStitching, setIsStitching] = useState(false);
    const [activeBlobUrl, setActiveBlobUrl] = useState<string | null>(null);
    const [isLoadingBlob, setIsLoadingBlob] = useState(false);

    // Fetch Blob when current video changes (to bypass COOP/COEP)
    // Commented out for Firebase Storage compatibility - using direct URLs instead
    React.useEffect(() => {
        const url = videoUrls[currentVideoIndex];
        if (!url) {
            setActiveBlobUrl(null);
            return;
        }

        // Use the URL directly instead of fetching as blob
        setActiveBlobUrl(url);
        setIsLoadingBlob(false);
    }, [currentVideoIndex, videoUrls]);

    // Timeline State
    const [timelineItems, setTimelineItems] = useState<Array<{
        id: string;
        type: 'video' | 'image';
        url: string;
        startTime: number;
        duration: number;
        name: string;
        position: number;
    }>>([]);
    const [timelineDuration, setTimelineDuration] = useState(30);

    // Helpers
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

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setVideoDuration(videoRef.current.duration);
            setTrimEnd(videoRef.current.duration);
        }
    };

    const handleDownloadingHelper = (url: string | null, name: string) => {
        if (!url) return;
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleDownload = () => {
        const url = videoUrls[currentVideoIndex];
        handleDownloadingHelper(url, `tunetales-scene-${currentVideoIndex + 1}.mp4`);
    };

    const handleDownloadEdited = () => {
        const url = videoUrls[currentVideoIndex];
        handleDownloadingHelper(url, `tunetales-edited-${Date.now()}.mp4`);
    };

    const handleDownloadAll = () => {
        videoUrls.forEach((url, index) => {
            if (url) {
                setTimeout(() => {
                    handleDownloadingHelper(url, `tunetales-scene-${index + 1}.mp4`);
                }, index * 500);
            }
        });
    };

    const handleStitchAndDownload = async () => {
        const validUrls = videoUrls.filter((u): u is string => u !== null);
        if (validUrls.length < 2) return;

        setIsStitching(true);
        try {
            const finalUrl = await videoStitcher.stitchVideos(validUrls);
            handleDownloadingHelper(finalUrl, `tunetales-full-movie-${Date.now()}.mp4`);
        } catch (error) {
            console.error('Stitching failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Stitching Failed: ${errorMessage}. \n\nNote: If the error mentions 'SharedArrayBuffer', please fully restart your terminal/server to apply security headers.`);
        } finally {
            setIsStitching(false);
        }
    };

    // Timeline helpers
    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            Array.from(files).forEach((file) => {
                const url = URL.createObjectURL(file);
                const newItem = {
                    id: Date.now().toString() + Math.random(),
                    type: file.type.startsWith('video/') ? 'video' as const : 'image' as const,
                    url,
                    startTime: 0,
                    duration: 5,
                    name: file.name,
                    position: 0
                };
                setTimelineItems(prev => [...prev, newItem]);
            });
        }
    };

    const removeTimelineItem = (id: string) => {
        setTimelineItems(prev => prev.filter(item => item.id !== id));
    };

    const handleDragStart = (e: React.DragEvent, itemId: string) => {
        setDraggedItem(itemId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleTimelineDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const position = (x / rect.width) * timelineDuration;

        if (draggedItem) {
            setTimelineItems(prev =>
                prev.map(item =>
                    item.id === draggedItem
                        ? { ...item, position: Math.max(0, Math.min(timelineDuration - item.duration, position)) }
                        : item
                )
            );
        }
    };

    const handleTimelineDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDraggedItem(null);
    };


    return (
        <div className="mt-12 space-y-8">
            {/* Editor Toggle */}
            <div className="flex gap-4">
                <button
                    onClick={() => setShowEditor(!showEditor)}
                    className={`px-4 py-2 rounded-xl font-semibold transition-all flex items-center gap-2 ${showEditor
                        ? 'bg-orange-gradient text-white hover:shadow-lg hover:shadow-orange-brand-600/30'
                        : 'bg-black text-gray-brand-300 hover:bg-gray-brand-900 hover:text-white'
                        } transform hover:scale-105 active:scale-95`}
                >
                    <Film className="w-4 h-4" />
                    {showEditor ? 'Simple View' : 'Edit Video'}
                </button>

                {/* Import Media Button */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-gradient-to-r from-orange-brand-600 to-orange-brand-700 text-white rounded-xl font-semibold hover:from-orange-brand-700 hover:to-orange-brand-800 transition-all flex items-center gap-2 transform hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-orange-brand-900/30"
                >
                    <Plus className="w-4 h-4" />
                    Import Media
                </button>

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="video/*,image/*"
                    onChange={handleFileImport}
                    className="hidden"
                />
            </div>

            {showEditor ? (
                /* Video Editor Interface */
                <div className="space-y-8">
                    {/* Video Preview */}
                    <div className="relative bg-black rounded-xl overflow-hidden border border-orange-brand-800/30 shadow-2xl shadow-orange-brand-900/20" style={{ aspectRatio: '16/9' }}>

                        {/* Render Video OR Loading State */}
                        {videoUrls[currentVideoIndex] ? (
                            <video
                                key={videoUrls[currentVideoIndex]} // Force re-render on source change
                                ref={videoRef}
                                src={videoUrls[currentVideoIndex]!}
                                autoPlay
                                onEnded={() => {
                                    if (currentVideoIndex < videoUrls.length - 1) {
                                        setCurrentVideoIndex(prev => prev + 1);
                                    } else {
                                        setIsPlaying(false);
                                    }
                                }}
                                onLoadedMetadata={handleLoadedMetadata}
                                className="w-full h-full object-contain"
                                style={{
                                    clipPath: `inset(${cropSettings.y}% ${100 - cropSettings.x - cropSettings.width}% ${100 - cropSettings.y - cropSettings.height}% ${cropSettings.x}%)`
                                }}
                            />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-brand-400 bg-black">
                                <Loader2 className="w-16 h-16 mb-6 animate-spin text-orange-brand-500" />
                                <span className="text-xl font-bold text-orange-brand-300">Generating Scene {currentVideoIndex + 1}...</span>
                                <span className="text-sm text-gray-brand-500 mt-3">Please wait</span>
                            </div>
                        )}

                        {/* Scene Indicator Overlay */}
                        <div className="absolute top-6 left-6 bg-black rounded-lg px-4 py-2 text-sm font-mono space-y-1 z-10 border border-orange-brand-800/50 backdrop-blur-sm">
                            <div className="text-white font-bold">Scene {currentVideoIndex + 1}/{videoUrls.length}</div>
                            {videoUrls[currentVideoIndex] && <div className="text-orange-brand-300">Duration: {videoDuration.toFixed(1)}s</div>}
                        </div>

                        {/* Video Controls Overlay */}
                        <div className="absolute bottom-6 left-6 right-6 bg-black rounded-xl p-5 z-10 backdrop-blur-sm border border-orange-brand-800/50">
                            <div className="flex items-center gap-6 mb-3">
                                {/* Previous Scene */}
                                <button
                                    onClick={() => setCurrentVideoIndex(Math.max(0, currentVideoIndex - 1))}
                                    disabled={currentVideoIndex === 0}
                                    className="text-white disabled:text-gray-brand-600 hover:text-orange-brand-400 transition-all duration-300 font-semibold px-3 py-1 rounded-lg hover:bg-orange-brand-900/30"
                                >
                                    Prev
                                </button>

                                <button
                                    onClick={handlePlayPause}
                                    disabled={!videoUrls[currentVideoIndex]}
                                    className="bg-orange-gradient text-white p-3 rounded-full hover:shadow-lg hover:shadow-orange-brand-600/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-110 active:scale-95"
                                >
                                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                                </button>

                                {/* Next Scene */}
                                <button
                                    onClick={() => setCurrentVideoIndex(Math.min(videoUrls.length - 1, currentVideoIndex + 1))}
                                    disabled={currentVideoIndex === videoUrls.length - 1}
                                    className="text-white disabled:text-gray-brand-600 hover:text-orange-brand-400 transition-all duration-300 font-semibold px-3 py-1 rounded-lg hover:bg-orange-brand-900/30"
                                >
                                    Next
                                </button>

                                {/* Status Text */}
                                <div className="flex-1 text-right text-sm text-orange-brand-300 font-medium">
                                    {videoUrls[currentVideoIndex] ? 'Ready' : 'Generating...'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Editing Tools */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Trim Controls */}
                        <div className="bg-black p-6 rounded-xl border border-orange-brand-800/30 shadow-xl shadow-orange-brand-900/20">
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-3 text-orange-brand-300">
                                <Scissors className="w-6 h-6" />
                                Trim Video
                            </h3>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm text-gray-brand-400 mb-3 font-medium">Start Time (seconds)</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max={videoDuration - 1}
                                        step="0.1"
                                        value={trimStart}
                                        onChange={(e) => setTrimStart(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-gray-brand-700 rounded-lg appearance-none cursor-pointer slider"
                                        style={{
                                            background: `linear-gradient(to right, #f97316 0%, #f97316 ${(trimStart / (videoDuration - 1)) * 100}%, #374151 ${(trimStart / (videoDuration - 1)) * 100}%, #374151 100%)`
                                        }}
                                    />
                                    <div className="text-sm text-orange-brand-300 mt-2 font-semibold">{trimStart.toFixed(1)}s</div>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-brand-400 mb-3 font-medium">End Time (seconds)</label>
                                    <input
                                        type="range"
                                        min={trimStart + 1}
                                        max={videoDuration}
                                        step="0.1"
                                        value={trimEnd}
                                        onChange={(e) => setTrimEnd(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-gray-brand-700 rounded-lg appearance-none cursor-pointer slider"
                                        style={{
                                            background: `linear-gradient(to right, #f97316 0%, #f97316 ${((trimEnd - trimStart - 1) / (videoDuration - trimStart - 1)) * 100}%, #374151 ${((trimEnd - trimStart - 1) / (videoDuration - trimStart - 1)) * 100}%, #374151 100%)`
                                        }}
                                    />
                                    <div className="text-sm text-orange-brand-300 mt-2 font-semibold">{trimEnd.toFixed(1)}s</div>
                                </div>
                            </div>
                        </div>

                        {/* Crop Controls */}
                        <div className="bg-black p-6 rounded-xl border border-orange-brand-800/30 shadow-xl shadow-orange-brand-900/20">
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-3 text-orange-brand-300">
                                <Crop className="w-6 h-6" />
                                Crop Video
                            </h3>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm text-gray-brand-400 mb-3 font-medium">X (%)</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="50"
                                        value={cropSettings.x}
                                        onChange={(e) => setCropSettings({ ...cropSettings, x: parseInt(e.target.value) })}
                                        className="w-full h-2 bg-gray-brand-700 rounded-lg appearance-none cursor-pointer slider"
                                        style={{
                                            background: `linear-gradient(to right, #f97316 0%, #f97316 ${(cropSettings.x / 50) * 100}%, #374151 ${(cropSettings.x / 50) * 100}%, #374151 100%)`
                                        }}
                                    />
                                    <div className="text-sm text-orange-brand-300 mt-2 font-semibold">{cropSettings.x}%</div>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-brand-400 mb-3 font-medium">Y (%)</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="50"
                                        value={cropSettings.y}
                                        onChange={(e) => setCropSettings({ ...cropSettings, y: parseInt(e.target.value) })}
                                        className="w-full h-2 bg-gray-brand-700 rounded-lg appearance-none cursor-pointer slider"
                                        style={{
                                            background: `linear-gradient(to right, #f97316 0%, #f97316 ${(cropSettings.y / 50) * 100}%, #374151 ${(cropSettings.y / 50) * 100}%, #374151 100%)`
                                        }}
                                    />
                                    <div className="text-sm text-orange-brand-300 mt-2 font-semibold">{cropSettings.y}%</div>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-brand-400 mb-3 font-medium">Width (%)</label>
                                    <input
                                        type="range"
                                        min="50"
                                        max="100"
                                        value={cropSettings.width}
                                        onChange={(e) => setCropSettings({ ...cropSettings, width: parseInt(e.target.value) })}
                                        className="w-full h-2 bg-gray-brand-700 rounded-lg appearance-none cursor-pointer slider"
                                        style={{
                                            background: `linear-gradient(to right, #f97316 0%, #f97316 ${((cropSettings.width - 50) / 50) * 100}%, #374151 ${((cropSettings.width - 50) / 50) * 100}%, #374151 100%)`
                                        }}
                                    />
                                    <div className="text-sm text-orange-brand-300 mt-2 font-semibold">{cropSettings.width}%</div>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-brand-400 mb-3 font-medium">Height (%)</label>
                                    <input
                                        type="range"
                                        min="50"
                                        max="100"
                                        value={cropSettings.height}
                                        onChange={(e) => setCropSettings({ ...cropSettings, height: parseInt(e.target.value) })}
                                        className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer slider"
                                        style={{
                                            background: `linear-gradient(to right, #f97316 0%, #f97316 ${((cropSettings.height - 50) / 50) * 100}%, #374151 ${((cropSettings.height - 50) / 50) * 100}%, #374151 100%)`
                                        }}
                                    />
                                    <div className="text-sm text-orange-brand-300 mt-2 font-semibold">{cropSettings.height}%</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Timeline */}
                    {timelineItems.length > 0 && (
                        <div className="bg-black p-6 rounded-xl border border-orange-brand-800/30 shadow-xl shadow-orange-brand-900/20">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold flex items-center gap-3 text-orange-brand-300">
                                    <Film className="w-6 h-6" />
                                    Timeline
                                </h3>
                                <button
                                    onClick={handleDownloadEdited}
                                    className="bg-orange-gradient hover:shadow-lg hover:shadow-orange-brand-600/30 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3"
                                >
                                    <Download className="w-5 h-5" />
                                    Export Video
                                </button>
                            </div>

                            {/* Timeline Controls */}
                            <div className="flex items-center gap-6 mb-6">
                                <label className="text-sm text-gray-brand-400 font-medium">Duration:</label>
                                <select
                                    value={timelineDuration}
                                    onChange={(e) => setTimelineDuration(parseInt(e.target.value))}
                                    className="bg-black text-white px-4 py-2 rounded-lg text-sm border border-orange-brand-800/30 focus:border-orange-brand-600 focus:outline-none transition-colors"
                                >
                                    <option value={30}>30 seconds</option>
                                    <option value={60}>1 minute</option>
                                    <option value={120}>2 minutes</option>
                                </select>
                            </div>

                            {/* Horizontal Timeline Bar */}
                            <div
                                className="relative bg-black rounded-xl p-6 min-h-32 mb-6 border border-orange-brand-800/30"
                                onDragOver={handleTimelineDragOver}
                                onDrop={handleTimelineDrop}
                            >
                                {/* Time markers */}
                                <div className="flex justify-between text-xs text-gray-brand-500 mb-4 font-medium">
                                    <span className="text-orange-brand-400">0s</span>
                                    <span className="text-orange-brand-400">{Math.floor(timelineDuration / 2)}s</span>
                                    <span className="text-orange-brand-400">{timelineDuration}s</span>
                                </div>

                                {/* Timeline track */}
                                <div className="relative h-20 bg-black rounded-xl border-2 border-dashed border-orange-brand-700/50">
                                    {timelineItems.map((item) => {
                                        const leftPosition = (item.position / timelineDuration) * 100;
                                        const width = (item.duration / timelineDuration) * 100;

                                        return (
                                            <div
                                                key={item.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, item.id)}
                                                className={`absolute top-3 h-14 bg-gradient-to-r from-orange-brand-600 to-orange-brand-500 rounded-lg border-2 border-orange-brand-400 cursor-move flex items-center px-3 group ${draggedItem === item.id ? 'opacity-50' : ''
                                                    }`}
                                                style={{
                                                    left: `${leftPosition}%`,
                                                    width: `${Math.max(width, 8)}%`,
                                                    minWidth: '80px'
                                                }}
                                            >
                                                <div className="flex items-center gap-3 text-white text-sm font-medium overflow-hidden">
                                                    {item.type === 'video' ? <Video className="w-4 h-4 flex-shrink-0" /> : <Image className="w-4 h-4 flex-shrink-0" />}
                                                    <span className="truncate">{item.name}</span>
                                                </div>

                                                {/* Delete button */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeTimelineItem(item.id);
                                                    }}
                                                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-400 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>

                                                {/* Duration indicator */}
                                                <div className="absolute -bottom-2 left-0 right-0 text-center text-[10px] text-orange-brand-200 font-semibold">
                                                    {item.duration}s
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {timelineItems.length === 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center text-gray-brand-500 text-sm font-medium">
                                            Drag and drop files here to add to timeline
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* File Import Area */}
                            <div className="border-2 border-dashed border-orange-brand-700/50 rounded-xl p-8 text-center hover:border-orange-brand-600 transition-all bg-black">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept="video/*,image/*"
                                    onChange={handleFileImport}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex flex-col items-center gap-3 text-gray-brand-400 hover:text-orange-brand-300 transition-all mx-auto group"
                                >
                                    <Plus className="w-10 h-10 group-hover:scale-110 transition-transform" />
                                    <span className="text-base font-medium">Click to add videos or photos</span>
                                    <span className="text-sm text-gray-brand-500">or drag and drop files</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* Simple Video Player */
                <div className="border-2 border-orange-brand-800/30 rounded-xl overflow-hidden relative bg-black shadow-xl shadow-orange-brand-900/20">
                    {/* Render Video OR Loading State */}
                    {activeBlobUrl ? (
                        <video
                            key={activeBlobUrl}
                            src={activeBlobUrl}
                            controls
                            autoPlay
                            onEnded={() => {
                                if (currentVideoIndex < videoUrls.length - 1) {
                                    setCurrentVideoIndex(prev => prev + 1);
                                }
                            }}
                            className="w-full"
                            style={{ maxHeight: '500px' }}
                        >
                            Your browser does not support the video tag.
                        </video>
                    ) : (
                        <div className="w-full h-[500px] flex flex-col items-center justify-center text-gray-brand-400 bg-black">
                            <Loader2 className="w-16 h-16 mb-6 animate-spin text-orange-brand-500" />
                            <span className="text-xl font-bold text-orange-brand-300">
                                {isLoadingBlob ? 'Loading Video...' : `Generating Scene ${currentVideoIndex + 1}...`}
                            </span>
                            <span className="text-sm text-gray-400 mt-2">Please wait</span>
                        </div>
                    )}

                    {/* Simple Scene Indicator */}
                    <div className="absolute top-6 left-6 bg-black rounded-xl px-4 py-2 text-sm font-bold text-white pointer-events-none border border-orange-brand-700/50 backdrop-blur-sm">
                        Scene {currentVideoIndex + 1}/{videoUrls.length}
                    </div>

                    {/* Download Buttons */}
                    <div className="bg-black p-6 space-y-4">
                        <button
                            onClick={handleDownload}
                            className="w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-3 transform hover:scale-105 active:scale-95"
                        >
                            <Download className="w-6 h-6" />
                            Save Current Scene
                        </button>

                        <button
                            onClick={handleDownloadAll}
                            className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-brand-900 transition-all flex items-center justify-center gap-3 border border-orange-brand-800/50 transform hover:scale-105 active:scale-95"
                        >
                            <Download className="w-6 h-6" />
                            Download All 3 Scenes
                        </button>

                        <button
                            onClick={handleStitchAndDownload}
                            disabled={isStitching}
                            className="w-full bg-gradient-to-r from-orange-brand-600 to-orange-brand-500 text-white py-4 rounded-xl font-bold hover:from-orange-brand-500 hover:to-orange-brand-400 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-orange-brand-600/30"
                        >
                            {isStitching ? (
                                <>
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    Stitching Videos (This takes ~20s)...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-6 h-6" />
                                    Download Full Movie (Merged)
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
