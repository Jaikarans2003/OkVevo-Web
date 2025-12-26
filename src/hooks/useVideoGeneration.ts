import { useState } from 'react';
import { MODELS } from '../config/models';
import { analyzeScenes } from '../services/AIService';
import type { Scene } from '../services/AIService';

export function useVideoGeneration() {
    const [analyzedScenes, setAnalyzedScenes] = useState<Scene[] | null>(null);
    const [videoUrls, setVideoUrls] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');

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

        // Tunetales model config
        const modelConfig = MODELS['tunetales'];
        const generatedUrls: string[] = [];

        // Track per-scene status
        const sceneStatuses = ['Pending', 'Pending', 'Pending'];
        const updateSceneStatus = (idx: number, msg: string) => {
            sceneStatuses[idx] = msg;
            // Update global status string
            setStatus(`Scene 1: ${sceneStatuses[0]} | Scene 2: ${sceneStatuses[1]} | Scene 3: ${sceneStatuses[2]}`);
        };

        try {
            // Helper to handle rate limits (429) gracefully
            const createPredictionWithRetry = async (payload: any, sceneIndex: number, onStatus?: (msg: string) => void): Promise<any> => {
                const maxRetries = 5; // Increased retries for strict rate limits
                let attempt = 0;

                while (attempt < maxRetries) {
                    try {
                        const response = await fetch(modelConfig.endpoint, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${import.meta.env.VITE_REPLICATE_API_TOKEN}`,
                            },
                            body: JSON.stringify(payload),
                        });

                        // Rate Limit Handling
                        if (response.status === 429) {
                            const errorText = await response.text();
                            let retrySeconds = 12; // Default safe wait
                            try {
                                const jsonErr = JSON.parse(errorText);
                                if (jsonErr.retry_after) retrySeconds = Math.ceil(jsonErr.retry_after) + 2;
                                else if (jsonErr.detail && jsonErr.detail.includes('retry_after')) {
                                    // Sometimes detail string has it? No, usually in separate field.
                                }
                            } catch { }

                            console.warn(`Scene ${sceneIndex + 1} hit rate limit (429). Retrying in ${retrySeconds}s...`);
                            if (onStatus) onStatus(`Rate limited. Waiting ${retrySeconds}s...`);

                            await new Promise(resolve => setTimeout(resolve, retrySeconds * 1000));
                            attempt++;
                            continue; // Retry logic
                        }

                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`Error ${response.status}: ${errorText}`);
                        }

                        return await response.json();

                    } catch (err: any) {
                        console.error(`Attempt ${attempt + 1} failed:`, err);
                        if (attempt === maxRetries - 1) throw err;
                        if (onStatus) onStatus(`Retrying (${attempt + 1}/${maxRetries})...`);

                        await new Promise(resolve => setTimeout(resolve, 3000)); // Basic network backoff
                        attempt++;
                    }
                }
                throw new Error(`Scene ${sceneIndex + 1} failed after ${maxRetries} retries.`);
            };

            // 2. Generate 3 videos with robust retry logic
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
                    let prediction = await createPredictionWithRetry(payload, index, (msg) => updateSceneStatus(index, msg));

                    updateSceneStatus(index, 'Processing...');

                    // Poll for completion
                    while (
                        prediction.status !== 'succeeded' &&
                        prediction.status !== 'failed' &&
                        prediction.status !== 'canceled'
                    ) {
                        await new Promise((resolve) => setTimeout(resolve, 3000));
                        const pollResponse = await fetch(`/api/replicate/predictions/${prediction.id}`, {
                            headers: { 'Authorization': `Bearer ${import.meta.env.VITE_REPLICATE_API_TOKEN}` },
                        });

                        // Handle Rate Limit during polling too
                        if (pollResponse.status === 429) {
                            updateSceneStatus(index, 'Polling rate limit...');
                            await new Promise(resolve => setTimeout(resolve, 5000));
                            continue;
                        }

                        prediction = await pollResponse.json();

                        if (prediction.status === 'failed') {
                            updateSceneStatus(index, 'Failed');
                            // Expose the actual error details from Replicate
                            const detailedError = prediction.error?.message || prediction.error || JSON.stringify(prediction.logs) || 'Unknown error';
                            console.error(`Scene ${index + 1} Replicate Error:`, prediction);
                            throw new Error(`Scene ${index + 1} failed: ${detailedError}`);
                        }

                        // Show detailed status if simplified
                        if (prediction.status !== 'succeeded') {
                            // Map 'processing' -> 'Rendering...'
                            const friendlyStatus = prediction.status === 'processing' ? 'Rendering...' :
                                prediction.status === 'starting' ? 'Starting...' : prediction.status;
                            updateSceneStatus(index, friendlyStatus);
                        }
                    }

                    if (prediction.output) {
                        updateSceneStatus(index, 'Done!');
                        return Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
                    }
                    throw new Error(`No output for scene ${index + 1}`);

                } catch (e: any) {
                    updateSceneStatus(index, 'Failed');
                    throw e;
                }
            };

            setStatus('Initializing scenes...');

            // Execute generations
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

    const resetAnalysis = () => {
        setAnalyzedScenes(null);
        setVideoUrls([]);
        setError('');
        setStatus('');
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
        analyzePrompt,
        generateVideosFromScenes,
        resetAnalysis,
        updateAnalyzedScene // Export new function
    };
}
