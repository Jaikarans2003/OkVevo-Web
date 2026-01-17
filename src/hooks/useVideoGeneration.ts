import { useState } from 'react';
import { MODELS } from '../config/models';
import { analyzeScenes } from '../services/AIService';
import { stitchVideosWithLambda } from '../services/LambdaStitchService';
import type { Scene } from '../services/AIService';

export function useVideoGeneration() {
    const [analyzedScenes, setAnalyzedScenes] = useState<Scene[] | null>(null);
    const [videoUrls, setVideoUrls] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');
    const [isStitching, setIsStitching] = useState(false);
    const [stitchedVideoUrl, setStitchedVideoUrl] = useState<string | null>(null);

    const analyzePrompt = async (inputText: string) => {
        if (!inputText.trim()) {
            setError('Please enter a description for your video');
            return;
        }

        setLoading(true);
        setError('');
        setStatus('Analyzing scene structure...');

        try {
            const scenes = await analyzeScenes(inputText);
            setAnalyzedScenes(scenes);
            setStatus('Analysis complete! Please review the scenes.');
        } catch (err: unknown) {
            console.error('Analysis error:', err);
            setError(err instanceof Error ? err.message : 'Analysis failed');
        } finally {
            setLoading(false);
        }
    };

    const generateVideosFromScenes = async (scenes: Scene[], guidanceScale: number) => {
        setLoading(true);
        setError('');
        setVideoUrls([]);
        setStatus('Initializing generation...');

        const modelConfig = MODELS['tunetales'];
        const generatedUrls: string[] = [];

        const sceneStatuses = ['Pending', 'Pending', 'Pending'];
        const updateSceneStatus = (idx: number, msg: string) => {
            sceneStatuses[idx] = msg;
            setStatus(`Scene 1: ${sceneStatuses[0]} | Scene 2: ${sceneStatuses[1]} | Scene 3: ${sceneStatuses[2]}`);
        };

        try {
            const createPredictionWithRetry = async (payload: Record<string, unknown>, sceneIndex: number, onStatus?: (msg: string) => void): Promise<Record<string, unknown>> => {
                const maxRetries = 5;
                let attempt = 0;

                while (attempt < maxRetries) {
                    try {
                        const response = await fetch(modelConfig.endpoint, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${process.env.NEXT_PUBLIC_REPLICATE_API_TOKEN}`,
                            },
                            body: JSON.stringify(payload),
                        });

                        if (response.status === 429) {
                            const errorText = await response.text();
                            let retrySeconds = 12;
                            try {
                                const jsonErr = JSON.parse(errorText);
                                if (jsonErr.retry_after) retrySeconds = Math.ceil(jsonErr.retry_after) + 2;
                            } catch (e) {
                                console.error(e);
                            }

                            console.warn(`Scene ${sceneIndex + 1} hit rate limit (429). Retrying in ${retrySeconds}s...`);
                            if (onStatus) onStatus(`Rate limited. Waiting ${retrySeconds}s...`);

                            await new Promise(resolve => setTimeout(resolve, retrySeconds * 1000));
                            attempt++;
                            continue;
                        }

                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`Error ${response.status}: ${errorText}`);
                        }

                        return await response.json();

                    } catch (err) {
                        console.error(`Attempt ${attempt + 1} failed:`, err);
                        if (attempt === maxRetries - 1) throw err;
                        if (onStatus) onStatus(`Retrying (${attempt + 1}/${maxRetries})...`);

                        await new Promise(resolve => setTimeout(resolve, 3000));
                        attempt++;
                    }
                }
                throw new Error(`Scene ${sceneIndex + 1} failed after ${maxRetries} retries.`);
            };

            const generateScene = async (scene: Scene, index: number) => {
                updateSceneStatus(index, 'Starting...');
                const richPrompt = `${scene.primary_visuals}. Emotional Tone: ${scene.emotional_tone}.`;

                const payload = modelConfig.payloadBuilder(richPrompt, {
                    guidanceScale,
                    enhancePrompt: false,
                    duration: 20,
                    aspectRatio: '16:9'
                });

                try {
                    let prediction: Record<string, unknown> = await createPredictionWithRetry(payload, index, (msg) => updateSceneStatus(index, msg));

                    updateSceneStatus(index, 'Processing...');

                    while (
                        prediction.status !== 'succeeded' &&
                        prediction.status !== 'failed' &&
                        prediction.status !== 'canceled'
                    ) {
                        await new Promise((resolve) => setTimeout(resolve, 3000));
                        const pollResponse = await fetch(`/api/replicate/predictions/${prediction.id}`, {
                            headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_REPLICATE_API_TOKEN}` },
                        });

                        if (pollResponse.status === 429) {
                            updateSceneStatus(index, 'Polling rate limit...');
                            await new Promise(resolve => setTimeout(resolve, 5000));
                            continue;
                        }

                        prediction = await pollResponse.json();

                        if (prediction.status === 'failed') {
                            updateSceneStatus(index, 'Failed');
                            const detailedError = (prediction.error as Record<string, unknown>)?.message || prediction.error || JSON.stringify(prediction.logs) || 'Unknown error';
                            console.error(`Scene ${index + 1} Replicate Error:`, prediction);
                            throw new Error(`Scene ${index + 1} failed: ${detailedError as string}`);
                        }

                        if (prediction.status !== 'succeeded') {
                            const friendlyStatus: string = prediction.status === 'processing' ? 'Rendering...' :
                                prediction.status === 'starting' ? 'Starting...' : String(prediction.status);
                            updateSceneStatus(index, friendlyStatus);
                        }
                    }

                    if (prediction.output) {
                        updateSceneStatus(index, 'Done!');
                        return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
                    }
                    throw new Error(`No output for scene ${index + 1}`);

                } catch (e) {
                    updateSceneStatus(index, 'Failed');
                    throw e;
                }
            };

            setStatus('Initializing scenes...');

            const p1 = generateScene(scenes[0], 0);
            await new Promise(r => setTimeout(r, 2000));
            const p2 = generateScene(scenes[1], 1);
            await new Promise(r => setTimeout(r, 2000));
            const p3 = generateScene(scenes[2], 2);

            const results = await Promise.all([p1, p2, p3]);

            generatedUrls.push(...results);

            setVideoUrls(generatedUrls);
            setStatus(`Success! All scenes complete.`);

        } catch (err: unknown) {
            console.error('Generation error:', err);
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
            if (generatedUrls.length === 3) {
                setStatus('Generation Complete');
            }
        }
    };

    const stitchVideosWithAWSLambda = async () => {
        setIsStitching(true);
        setError('');

        try {
            console.log('🔍 Debugging stitching start...');
            console.log('videoUrls array:', videoUrls);
            console.log('videoUrls length:', videoUrls.length);
            console.log('videoUrls content:', JSON.stringify(videoUrls, null, 2));

            // Pass actual Firebase Storage URLs
            const validUrls = videoUrls.filter(url => url !== null && url !== undefined && url.length > 0) as string[];

            console.log('✅ Valid URLs found:', validUrls.length);
            console.log('Valid URLs:', validUrls);

            if (validUrls.length < 3) {
                console.error('❌ Not enough videos. Expected 3, got:', validUrls.length);
                throw new Error(`Not all videos are ready for stitching. Found ${validUrls.length}/3 videos.`);
            }

            console.log('🚀 Triggering Lambda stitching with URLs...');
            const result = await stitchVideosWithLambda({
                videoUrls: validUrls,
                sessionId: `session-${Date.now()}`
            });

            if (result.success && result.videoUrl) {
                setStitchedVideoUrl(result.videoUrl);
                setStatus('Video stitched successfully! Ready to download.');
                console.log('✅ Stitched video URL:', result.videoUrl);
            } else {
                throw new Error(result.error || 'Stitching failed');
            }
        } catch (err: unknown) {
            console.error('Lambda stitching error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to stitch videos';
            setError(`Stitching failed: ${errorMessage}. Make sure FFmpeg layer is attached to Lambda.`);
            setStatus('');
        } finally {
            setIsStitching(false);
        }
    };

    const resetAnalysis = () => {
        setAnalyzedScenes(null);
        setVideoUrls([]);
        setError('');
        setStatus('');
        setIsStitching(false);
        setStitchedVideoUrl(null);
    };

    const updateAnalyzedScene = (index: number, field: keyof Scene, value: string) => {
        setAnalyzedScenes(prev => {
            if (!prev) return null;
            const newScenes = [...prev];
            newScenes[index] = { ...newScenes[index], [field]: value };
            return newScenes;
        });
    };

    return {
        analyzedScenes,
        videoUrls,
        loading,
        error,
        status,
        isStitching,
        stitchedVideoUrl,
        analyzePrompt,
        generateVideosFromScenes,
        stitchVideosWithAWSLambda,
        resetAnalysis,
        updateAnalyzedScene,
        setAnalyzedScenes
    };
}
