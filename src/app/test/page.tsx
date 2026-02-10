'use client';

import { useState } from 'react';
import { narrationService } from '@/services/NarrationService';
import { ttsService } from '@/services/TTSService';
import { fetchMockAIGeneratedVideos } from '@/services/StorageService';
import { dispatchStitchingJob } from '@/services/SQSStitchService';

export default function TestPage() {
    const [logs, setLogs] = useState<string[]>([]);
    const [narration, setNarration] = useState<any>(null);
    const [audioUrl, setAudioUrl] = useState<string>('');
    const [videoUrls, setVideoUrls] = useState<string[]>([]);
    const [jobId, setJobId] = useState<string>('');
    const [finalVideoUrl, setFinalVideoUrl] = useState<string>('');
    const [loading, setLoading] = useState<string>('');

    const log = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
        const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : '🎬';
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, `[${timestamp}] ${emoji} ${message}`]);
    };

    const clearLogs = () => {
        setLogs([]);
        setNarration(null);
        setAudioUrl('');
        setVideoUrls([]);
        setJobId('');
        setFinalVideoUrl('');
    };

    // Test 1: Narration Generation
    const testNarration = async () => {
        try {
            setLoading('narration');
            log('Starting narration generation...');

            const testScript = "A brave astronaut discovers an alien civilization living in underground crystal caves that glow with mysterious energy.";

            const result = await narrationService.generateDirectNarration(testScript);

            setNarration(result);
            log(`Narration generated! Word count: ${result.narration.fullNarration.split(' ').length}`, 'success');
            log(`Segments: ${result.narration.segments.length}`, 'info');
            log(`Internal scenes: ${result.internalScenes.length}`, 'info');

        } catch (error: any) {
            log(`Error: ${error.message}`, 'error');
        } finally {
            setLoading('');
        }
    };

    // Test 2: TTS Audio Generation
    const testTTS = async () => {
        if (!narration) {
            log('Please generate narration first!', 'error');
            return;
        }

        try {
            setLoading('tts');
            log('Generating TTS audio...');

            const sessionId = 'test-' + Date.now();
            const url = await ttsService.generateNarrationAudio(
                narration.narration.fullNarration,
                sessionId
            );

            setAudioUrl(url);
            log(`Audio generated successfully!`, 'success');
            log(`URL: ${url}`, 'info');

        } catch (error: any) {
            log(`Error: ${error.message}`, 'error');
        } finally {
            setLoading('');
        }
    };

    // Test 3: Fetch Mock Videos
    const testMockVideos = async () => {
        try {
            setLoading('videos');
            log('Fetching mock videos...');

            const videos = await fetchMockAIGeneratedVideos(3);

            setVideoUrls(videos);
            log(`Fetched ${videos.length} mock videos`, 'success');
            videos.forEach((url, i) => log(`Video ${i + 1}: ${url.split('/').pop()}`, 'info'));

        } catch (error: any) {
            log(`Error: ${error.message}`, 'error');
        } finally {
            setLoading('');
        }
    };

    // Test 4: Dispatch Stitching Job
    const testSQSDispatch = async () => {
        if (!audioUrl || videoUrls.length === 0) {
            log('Please generate audio and fetch videos first!', 'error');
            return;
        }

        try {
            setLoading('sqs');
            log('Dispatching stitching job to SQS...');

            const response = await dispatchStitchingJob(videoUrls, audioUrl);

            if (response.success && response.jobId) {
                setJobId(response.jobId);
                log(`Job dispatched successfully!`, 'success');
                log(`Job ID: ${response.jobId}`, 'info');
                log('Lambda will process in 2-3 minutes...', 'info');
            } else {
                throw new Error(response.error || 'Failed to dispatch job');
            }

        } catch (error: any) {
            log(`Error: ${error.message}`, 'error');
        } finally {
            setLoading('');
        }
    };

    // Test 5: Check Final Video
    const checkFinalVideo = async () => {
        if (!jobId) {
            log('Please dispatch a job first!', 'error');
            return;
        }

        try {
            setLoading('check');
            log('Checking for final video...');

            const response = await fetch(`/api/check-stitched-video?jobId=${jobId}`);
            const data = await response.json();

            if (data.ready) {
                setFinalVideoUrl(data.url);
                log('Video is ready!', 'success');
                log(`URL: ${data.url}`, 'info');
            } else {
                log('Video still processing...', 'info');
            }

        } catch (error: any) {
            log(`Error: ${error.message}`, 'error');
        } finally {
            setLoading('');
        }
    };

    // Run All Tests - Sequential with data passing
    const runAllTests = async () => {
        clearLogs();
        setLoading('narration');

        try {
            // Step 1: Generate narration
            log('Starting narration generation...');
            const testScript = "A brave astronaut discovers an alien civilization living in underground crystal caves that glow with mysterious energy.";
            const narrationResult = await narrationService.generateDirectNarration(testScript);
            setNarration(narrationResult);
            log(`Narration generated! Word count: ${narrationResult.narration.fullNarration.split(' ').length}`, 'success');
            log(`Segments: ${narrationResult.narration.segments.length}`, 'info');
            log(`Internal scenes: ${narrationResult.internalScenes.length}`, 'info');

            // Step 2: Generate TTS audio
            setLoading('tts');
            await new Promise(resolve => setTimeout(resolve, 500));
            log('Generating TTS audio...');
            const sessionId = 'test-' + Date.now();
            const generatedAudioUrl = await ttsService.generateNarrationAudio(
                narrationResult.narration.fullNarration,
                sessionId
            );
            setAudioUrl(generatedAudioUrl);
            log(`Audio generated successfully!`, 'success');
            log(`URL: ${generatedAudioUrl}`, 'info');

            // Step 3: Fetch mock videos
            setLoading('videos');
            await new Promise(resolve => setTimeout(resolve, 500));
            log('Fetching mock videos...');
            const videos = await fetchMockAIGeneratedVideos(3);
            setVideoUrls(videos);
            log(`Fetched ${videos.length} mock videos`, 'success');
            videos.forEach((url, i) => log(`Video ${i + 1}: ${url.split('/').pop()?.split('?')[0]}`, 'info'));

            // Step 4: Dispatch to SQS
            setLoading('sqs');
            await new Promise(resolve => setTimeout(resolve, 500));
            log('Dispatching stitching job to SQS...');
            const response = await dispatchStitchingJob(videos, generatedAudioUrl);

            if (response.success && response.jobId) {
                setJobId(response.jobId);
                log(`Job dispatched successfully!`, 'success');
                log(`Job ID: ${response.jobId}`, 'info');
                log('Lambda will process in 2-3 minutes...', 'info');
                log('✅ All tests completed! Click "Check Video" in 2-3 minutes.', 'success');
            } else {
                throw new Error(response.error || 'Failed to dispatch job');
            }

        } catch (error: any) {
            log(`Error: ${error.message}`, 'error');
        } finally {
            setLoading('');
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-4xl font-bold mb-2">🧪 Backend Testing Dashboard</h1>
                <p className="text-gray-400 mb-8">Test the complete AI narration + video pipeline</p>

                {/* Control Buttons */}
                <div className="bg-gray-800 rounded-lg p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <button
                            onClick={testNarration}
                            disabled={loading === 'narration'}
                            className="bg-custom-orange hover:bg-orange-700 disabled:bg-gray-600 px-4 py-2 rounded font-medium transition"
                        >
                            {loading === 'narration' ? '⏳' : '1️⃣'} Narration
                        </button>
                        <button
                            onClick={testTTS}
                            disabled={loading === 'tts' || !narration}
                            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-4 py-2 rounded font-medium transition"
                        >
                            {loading === 'tts' ? '⏳' : '2️⃣'} TTS Audio
                        </button>
                        <button
                            onClick={testMockVideos}
                            disabled={loading === 'videos'}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded font-medium transition"
                        >
                            {loading === 'videos' ? '⏳' : '3️⃣'} Mock Videos
                        </button>
                        <button
                            onClick={testSQSDispatch}
                            disabled={loading === 'sqs' || !audioUrl || videoUrls.length === 0}
                            className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 px-4 py-2 rounded font-medium transition"
                        >
                            {loading === 'sqs' ? '⏳' : '4️⃣'} Dispatch SQS
                        </button>
                        <button
                            onClick={checkFinalVideo}
                            disabled={loading === 'check' || !jobId}
                            className="bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 px-4 py-2 rounded font-medium transition"
                        >
                            {loading === 'check' ? '⏳' : '5️⃣'} Check Video
                        </button>
                        <button
                            onClick={clearLogs}
                            className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded font-medium transition"
                        >
                            🗑️ Clear
                        </button>
                    </div>
                    <button
                        onClick={runAllTests}
                        disabled={!!loading}
                        className="mt-4 w-full bg-gradient-to-r from-custom-orange to-purple-600 hover:from-orange-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 px-6 py-3 rounded-lg font-bold text-lg transition"
                    >
                        {loading ? '⏳ Running...' : '🚀 Run All Tests'}
                    </button>
                </div>

                {/* Results Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Narration Result */}
                    {narration && (
                        <div className="bg-gray-800 rounded-lg p-6">
                            <h3 className="text-lg font-semibold mb-3">📝 Narration Result</h3>
                            <div className="space-y-2 text-sm">
                                <p className="text-gray-300">{narration.narration.fullNarration}</p>
                                <div className="mt-4 space-y-1 text-xs">
                                    {narration.narration.segments.map((seg: any, i: number) => (
                                        <div key={i} className="bg-gray-700 p-2 rounded">
                                            <span className="text-custom-orange">Segment {i + 1}</span>{' '}
                                            ({seg.startTime}s - {seg.endTime}s): {seg.text}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Audio Player */}
                    {audioUrl && (
                        <div className="bg-gray-800 rounded-lg p-6">
                            <h3 className="text-lg font-semibold mb-3">🔊 Audio Player</h3>
                            <audio src={audioUrl} controls className="w-full mb-3" />
                            <p className="text-xs text-gray-400 break-all">{audioUrl}</p>
                        </div>
                    )}

                    {/* Mock Videos */}
                    {videoUrls.length > 0 && (
                        <div className="bg-gray-800 rounded-lg p-6">
                            <h3 className="text-lg font-semibold mb-3">🎥 Mock Videos ({videoUrls.length})</h3>
                            <div className="space-y-2 text-xs">
                                {videoUrls.map((url, i) => (
                                    <div key={i} className="bg-gray-700 p-2 rounded">
                                        Video {i + 1}: {url.split('/').pop()?.split('?')[0]}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Job Status */}
                    {jobId && (
                        <div className="bg-gray-800 rounded-lg p-6">
                            <h3 className="text-lg font-semibold mb-3">📋 Job Status</h3>
                            <p className="text-sm mb-2">
                                <span className="text-gray-400">Job ID:</span>{' '}
                                <span className="font-mono text-xs">{jobId}</span>
                            </p>
                            <p className="text-xs text-yellow-400">
                                ⏳ Lambda processing takes 2-3 minutes...
                            </p>
                        </div>
                    )}
                </div>

                {/* Final Video Preview */}
                {finalVideoUrl && (
                    <div className="bg-gradient-to-r from-green-900 to-orange-900 rounded-lg p-6 mb-6">
                        <h3 className="text-2xl font-bold mb-4">🎉 Final Stitched Video</h3>
                        <video
                            src={finalVideoUrl}
                            controls
                            className="w-full max-w-md mx-auto rounded-lg shadow-2xl"
                            autoPlay
                        />
                        <p className="text-center text-xs text-gray-300 mt-3 break-all">{finalVideoUrl}</p>
                    </div>
                )}

                {/* Logs Console */}
                <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-3">📊 Test Logs</h3>
                    <div className="bg-black rounded p-4 font-mono text-xs h-96 overflow-y-auto">
                        {logs.length === 0 ? (
                            <p className="text-gray-500">No logs yet. Run a test to see output.</p>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} className="mb-1 text-gray-300">
                                    {log}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
