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
            alert('Stitching Unavailable: To fix video playback issues, we disabled generic browser isolation. Video Stitching requires enabled isolation. Please download clips individually for now.');
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
        <div className="mt-12 space-y-6">
            {/* Editor Toggle */}
            <div className="flex gap-4">
                <button
                    onClick={() => setShowEditor(!showEditor)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${showEditor
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                >
                    <Film className="w-4 h-4" />
                    {showEditor ? 'Simple View' : 'Edit Video'}
                </button>

                {/* Import Media Button */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all flex items-center gap-2"
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
                <div className="space-y-6">
                    {/* Video Preview */}
                    <div className="relative bg-gray-900 rounded-lg overflow-hidden border border-gray-800" style={{ aspectRatio: '16/9' }}>

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
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-gray-900/50">
                                <Loader2 className="w-12 h-12 mb-4 animate-spin text-blue-500" />
                                <span className="text-lg font-medium text-white">Generating Scene {currentVideoIndex + 1}...</span>
                                <span className="text-sm text-gray-400 mt-2">Please wait</span>
                            </div>
                        )}

                        {/* Scene Indicator Overlay */}
                        <div className="absolute top-4 left-4 bg-black bg-opacity-70 rounded px-2 py-1 text-xs font-mono space-y-1 z-10">
                            <div className="text-white">Scene {currentVideoIndex + 1}/{videoUrls.length}</div>
                            {videoUrls[currentVideoIndex] && <div className="text-yellow-400">Clip Duration: {videoDuration.toFixed(1)}s</div>}
                        </div>

                        {/* Video Controls Overlay */}
                        <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-50 rounded-lg p-4 z-10 backdrop-blur-sm">
                            <div className="flex items-center gap-4 mb-2">
                                {/* Previous Scene */}
                                <button
                                    onClick={() => setCurrentVideoIndex(Math.max(0, currentVideoIndex - 1))}
                                    disabled={currentVideoIndex === 0}
                                    className="text-white disabled:text-gray-600 hover:text-blue-400 transition-colors"
                                >
                                    Prev
                                </button>

                                <button
                                    onClick={handlePlayPause}
                                    disabled={!videoUrls[currentVideoIndex]}
                                    className="bg-white text-black p-2 rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                </button>

                                {/* Next Scene */}
                                <button
                                    onClick={() => setCurrentVideoIndex(Math.min(videoUrls.length - 1, currentVideoIndex + 1))}
                                    disabled={currentVideoIndex === videoUrls.length - 1}
                                    className="text-white disabled:text-gray-600 hover:text-blue-400 transition-colors"
                                >
                                    Next
                                </button>

                                {/* Status Text */}
                                <div className="flex-1 text-right text-xs text-gray-300">
                                    {videoUrls[currentVideoIndex] ? 'Ready' : 'Generating...'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Editing Tools */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Trim Controls */}
                        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Scissors className="w-5 h-5" />
                                Trim Video
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Start Time (seconds)</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max={videoDuration - 1}
                                        step="0.1"
                                        value={trimStart}
                                        onChange={(e) => setTrimStart(parseFloat(e.target.value))}
                                        className="w-full"
                                    />
                                    <div className="text-sm text-gray-300 mt-1">{trimStart.toFixed(1)}s</div>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">End Time (seconds)</label>
                                    <input
                                        type="range"
                                        min={trimStart + 1}
                                        max={videoDuration}
                                        step="0.1"
                                        value={trimEnd}
                                        onChange={(e) => setTrimEnd(parseFloat(e.target.value))}
                                        className="w-full"
                                    />
                                    <div className="text-sm text-gray-300 mt-1">{trimEnd.toFixed(1)}s</div>
                                </div>
                            </div>
                        </div>

                        {/* Crop Controls */}
                        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Crop className="w-5 h-5" />
                                Crop Video
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">X (%)</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="50"
                                        value={cropSettings.x}
                                        onChange={(e) => setCropSettings({ ...cropSettings, x: parseInt(e.target.value) })}
                                        className="w-full"
                                    />
                                    <div className="text-sm text-gray-300 mt-1">{cropSettings.x}%</div>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Y (%)</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="50"
                                        value={cropSettings.y}
                                        onChange={(e) => setCropSettings({ ...cropSettings, y: parseInt(e.target.value) })}
                                        className="w-full"
                                    />
                                    <div className="text-sm text-gray-300 mt-1">{cropSettings.y}%</div>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Width (%)</label>
                                    <input
                                        type="range"
                                        min="50"
                                        max="100"
                                        value={cropSettings.width}
                                        onChange={(e) => setCropSettings({ ...cropSettings, width: parseInt(e.target.value) })}
                                        className="w-full"
                                    />
                                    <div className="text-sm text-gray-300 mt-1">{cropSettings.width}%</div>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Height (%)</label>
                                    <input
                                        type="range"
                                        min="50"
                                        max="100"
                                        value={cropSettings.height}
                                        onChange={(e) => setCropSettings({ ...cropSettings, height: parseInt(e.target.value) })}
                                        className="w-full"
                                    />
                                    <div className="text-sm text-gray-300 mt-1">{cropSettings.height}%</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Timeline */}
                    {timelineItems.length > 0 && (
                        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <Film className="w-5 h-5" />
                                    Timeline
                                </h3>
                                <button
                                    onClick={handleDownloadEdited}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Export Video
                                </button>
                            </div>

                            {/* Timeline Controls */}
                            <div className="flex items-center gap-4 mb-4">
                                <label className="text-sm text-gray-400">Duration:</label>
                                <select
                                    value={timelineDuration}
                                    onChange={(e) => setTimelineDuration(parseInt(e.target.value))}
                                    className="bg-gray-800 text-white px-3 py-1 rounded text-sm"
                                >
                                    <option value={30}>30 seconds</option>
                                    <option value={60}>1 minute</option>
                                    <option value={120}>2 minutes</option>
                                </select>
                            </div>

                            {/* Horizontal Timeline Bar */}
                            <div
                                className="relative bg-gray-800 rounded-lg p-4 min-h-24 mb-4"
                                onDragOver={handleTimelineDragOver}
                                onDrop={handleTimelineDrop}
                            >
                                {/* Time markers */}
                                <div className="flex justify-between text-xs text-gray-500 mb-2">
                                    <span>0s</span>
                                    <span>{Math.floor(timelineDuration / 2)}s</span>
                                    <span>{timelineDuration}s</span>
                                </div>

                                {/* Timeline track */}
                                <div className="relative h-16 bg-gray-700 rounded border-2 border-dashed border-gray-600">
                                    {timelineItems.map((item) => {
                                        const leftPosition = (item.position / timelineDuration) * 100;
                                        const width = (item.duration / timelineDuration) * 100;

                                        return (
                                            <div
                                                key={item.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, item.id)}
                                                className={`absolute top-2 h-12 bg-blue-600 rounded border-2 border-blue-400 cursor-move flex items-center px-2 group ${draggedItem === item.id ? 'opacity-50' : ''
                                                    }`}
                                                style={{
                                                    left: `${leftPosition}%`,
                                                    width: `${Math.max(width, 8)}%`,
                                                    minWidth: '60px'
                                                }}
                                            >
                                                <div className="flex items-center gap-2 text-white text-xs overflow-hidden">
                                                    {item.type === 'video' ? <Video className="w-3 h-3 flex-shrink-0" /> : <Image className="w-3 h-3 flex-shrink-0" />}
                                                    <span className="truncate">{item.name}</span>
                                                </div>

                                                {/* Delete button */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeTimelineItem(item.id);
                                                    }}
                                                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-400 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>

                                                {/* Duration indicator */}
                                                <div className="absolute -bottom-1 left-0 right-0 text-center text-[10px] text-gray-300">
                                                    {item.duration}s
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {timelineItems.length === 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                                            Drag and drop files here to add to timeline
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* File Import Area */}
                            <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-gray-500 transition-colors">
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
                                    className="flex flex-col items-center gap-2 text-gray-400 hover:text-white transition-colors mx-auto"
                                >
                                    <Plus className="w-8 h-8" />
                                    <span className="text-sm">Click to add videos or photos</span>
                                    <span className="text-xs text-gray-500">or drag and drop files</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* Simple Video Player */
                <div className="border-2 border-gray-700 rounded-lg overflow-hidden relative">
                    {/* Render Video OR Loading State */}
                    {videoUrls[currentVideoIndex] ? (
                        <video
                            key={videoUrls[currentVideoIndex]}
                            src={videoUrls[currentVideoIndex]!}
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
                        <div className="w-full h-[500px] flex flex-col items-center justify-center text-gray-500 bg-gray-900/50">
                            <Loader2 className="w-12 h-12 mb-4 animate-spin text-blue-500" />
                            <span className="text-lg font-medium text-white">Generating Scene {currentVideoIndex + 1}...</span>
                            <span className="text-sm text-gray-400 mt-2">Please wait</span>
                        </div>
                    )}

                    {/* Simple Scene Indicator */}
                    <div className="absolute top-4 left-4 bg-black bg-opacity-70 rounded px-2 py-1 text-xs font-mono text-white pointer-events-none">
                        Scene {currentVideoIndex + 1}/{videoUrls.length}
                    </div>

                    {/* Download Buttons */}
                    <div className="bg-gray-900 p-4 space-y-3">
                        <button
                            onClick={handleDownload}
                            className="w-full bg-white text-black py-3 rounded-lg font-semibold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                        >
                            <Download className="w-5 h-5" />
                            Save Current Scene
                        </button>

                        <button
                            onClick={handleDownloadAll}
                            className="w-full bg-gray-800 text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition-all flex items-center justify-center gap-2 border border-gray-700"
                        >
                            <Download className="w-5 h-5" />
                            Download All 3 Scenes
                        </button>

                        <button
                            onClick={handleStitchAndDownload}
                            disabled={isStitching}
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-purple-500 hover:to-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isStitching ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Stitching Videos (This takes ~20s)...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
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
