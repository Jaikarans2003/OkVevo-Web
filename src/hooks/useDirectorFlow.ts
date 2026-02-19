
import { useState, useCallback } from 'react';
import { narrationService } from '../services/NarrationService';
import { fetchVideosFromStorage, fetchStitchedVideos } from '../services/StorageService';
import { dispatchStitchingJob } from '../services/SQSStitchService';

export type DirectorFlowState =
    | 'idle'
    | 'naming'
    | 'scripting'
    | 'duration'
    | 'aspect_ratio'
    | 'genre'
    | 'review'
    | 'generating_narration'
    | 'generating_audio'
    | 'fetching_videos'
    | 'stitching'
    | 'complete';

export interface DirectorProject {
    name: string;
    script: string;
    duration: string;
    aspectRatio: string;
    genre: string;
    videoUrls: string[];
    audioUrl?: string;
    stitchedVideoUrl?: string;
}

export interface Message {
    id: string;
    role: 'assistant' | 'user';
    content: string;
    type?: 'text' | 'choice' | 'review' | 'progress' | 'result';
    timestamp: number;
}

export function useDirectorFlow() {
    const [currentState, setCurrentState] = useState<DirectorFlowState>('naming');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: "Hi I'm VEVO your creative assistant. Let's create something cinematic. First, what should we name this project?",
            timestamp: Date.now()
        }
    ]);
    const [project, setProject] = useState<DirectorProject>({
        name: '',
        script: '',
        duration: '',
        aspectRatio: '',
        genre: '',
        videoUrls: [],
    });
    const [pipelineError, setPipelineError] = useState<string | null>(null);
    const [pipelineStep, setPipelineStep] = useState<string>('');

    const addMessage = useCallback((content: string, role: 'assistant' | 'user', type: Message['type'] = 'text') => {
        const newMessage: Message = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            content,
            role,
            type,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, newMessage]);
    }, []);

    const runGenerationPipeline = useCallback(async (currentProject: DirectorProject) => {
        setPipelineError(null);

        try {
            // ── Step 1: Narration ──────────────────────────────────────────
            setPipelineStep('Generating narration script...');
            setCurrentState('generating_narration');

            const narrationResult = await narrationService.generateDirectNarration(
                `Project: ${currentProject.name}\nScript: ${currentProject.script}\nStyle: ${currentProject.genre}\nDuration: ${currentProject.duration}\nAspect Ratio: ${currentProject.aspectRatio}`
            );

            // ── Step 2: Fetch videos ───────────────────────────────────────
            setPipelineStep('Fetching scene footage...');
            setCurrentState('fetching_videos');

            const videoUrls = await fetchVideosFromStorage();
            const selectedUrls = videoUrls.slice(0, 3);
            if (selectedUrls.length < 3) {
                throw new Error('Not enough videos in storage. Need at least 3.');
            }
            setProject(prev => ({ ...prev, videoUrls: selectedUrls }));

            // ── Step 3: TTS Audio ──────────────────────────────────────────
            setPipelineStep('Generating audio narration...');
            setCurrentState('generating_audio');

            const { ttsService } = await import('../services/TTSService');
            const sessionId = `director-${Date.now()}`;
            const audioUrl = await ttsService.generateNarrationAudio(
                narrationResult.narration.fullNarration,
                sessionId
            );
            setProject(prev => ({ ...prev, audioUrl }));

            // ── Step 4: Dispatch SQS stitching job ─────────────────────────
            setPipelineStep('Stitching your cinematic scene...');
            setCurrentState('stitching');

            const result = await dispatchStitchingJob(selectedUrls, audioUrl);
            if (!result.success || !result.jobId) {
                throw new Error(result.error || 'SQS dispatch failed');
            }

            // Poll for stitched video
            const maxAttempts = 24;
            let stitchedUrl: string | null = null;
            for (let i = 0; i < maxAttempts; i++) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                try {
                    const stitchedVideos = await fetchStitchedVideos();
                    const match = stitchedVideos.find(url => url.includes(result.jobId!));
                    if (match) {
                        stitchedUrl = match;
                        break;
                    }
                } catch (pollErr) {
                    console.error('Polling error:', pollErr);
                }
            }

            if (!stitchedUrl) {
                throw new Error('Stitching is taking longer than expected. Please try again.');
            }

            setProject(prev => ({ ...prev, stitchedVideoUrl: stitchedUrl! }));
            setPipelineStep('Complete');
            addMessage("Your cinematic scene is ready! Take a look.", 'assistant', 'result');
            setCurrentState('complete');

        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            console.error('Director pipeline error:', error);
            setPipelineError(msg);
            addMessage(`Generation failed: ${msg}`, 'assistant');
            setCurrentState('review'); // allow retry
        }
    }, [addMessage]);

    const handleNext = useCallback(async (input: string) => {
        addMessage(input, 'user');

        switch (currentState) {
            case 'naming':
                setProject(prev => ({ ...prev, name: input }));
                addMessage(`Great, "${input}" it is! Now, describe the scene you want to create or paste your script here.`, 'assistant');
                setCurrentState('scripting');
                break;

            case 'scripting':
                setProject(prev => ({ ...prev, script: input }));
                addMessage("Perfect. How long should this video be? Select a duration:", 'assistant', 'choice');
                setCurrentState('duration');
                break;

            case 'duration':
                setProject(prev => ({ ...prev, duration: input }));
                addMessage("Understood. What's the target aspect ratio?", 'assistant', 'choice');
                setCurrentState('aspect_ratio');
                break;

            case 'aspect_ratio':
                setProject(prev => ({ ...prev, aspectRatio: input }));
                addMessage("And finally, what's the cinematic style or genre for this project?", 'assistant', 'choice');
                setCurrentState('genre');
                break;

            case 'genre':
                const finalProject = { ...project, genre: input };
                setProject(finalProject);
                addMessage("Excellent choices. Here's a summary of your project:", 'assistant', 'review');
                setCurrentState('review');
                break;

            case 'review':
                if (input.toLowerCase().includes('yes') || input.toLowerCase().includes('proceed')) {
                    addMessage("Initializing cinematic engine…", 'assistant', 'progress');
                    // Run pipeline — capture current project with genre from the previous step
                    setProject(prev => {
                        const updated = { ...prev };
                        // Start pipeline with the fully updated project
                        runGenerationPipeline(updated);
                        return updated;
                    });
                } else {
                    addMessage("What would you like to change? You can describe the update and type 'YES' again when ready.", 'assistant');
                }
                break;

            default:
                break;
        }
    }, [currentState, project, addMessage, runGenerationPipeline]);

    const resetFlow = useCallback(() => {
        setMessages([
            {
                id: '1',
                role: 'assistant',
                content: "Welcome to Director Mode. Let's create something cinematic. First, what should we name this project?",
                timestamp: Date.now()
            }
        ]);
        setCurrentState('naming');
        setProject({
            name: '',
            script: '',
            duration: '',
            aspectRatio: '',
            genre: '',
            videoUrls: [],
        });
        setPipelineError(null);
        setPipelineStep('');
    }, []);

    return {
        messages,
        currentState,
        project,
        pipelineStep,
        pipelineError,
        handleNext,
        resetFlow,
    };
}
