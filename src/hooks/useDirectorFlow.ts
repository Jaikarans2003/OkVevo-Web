
import { useState, useCallback } from 'react';
import { narrationService, DirectNarrationResult } from '../services/NarrationService';
import { analyzeScenes } from '../services/AIService';
import type { Scene } from '../services/AIService';
import { fetchVideosFromStorage, fetchStitchedVideos } from '../services/StorageService';
import { dispatchStitchingJob } from '../services/SQSStitchService';

export type DirectorFlowState =
    | 'idle'
    | 'naming'
    | 'scripting'
    | 'duration'
    | 'aspect_ratio'
    | 'genre'
    | 'generating_scenes'
    | 'scene_review'
    | 'generating_narration'
    | 'fetching_videos'
    | 'generating_audio'
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
    type?: 'text' | 'choice' | 'scene_review' | 'progress' | 'result';
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
    const [analyzedScenes, setAnalyzedScenes] = useState<Scene[] | null>(null);
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

    // Update a single field in an analyzed scene (for editable cards)
    const updateScene = useCallback((index: number, field: keyof Scene, value: string) => {
        setAnalyzedScenes(prev =>
            prev ? prev.map((scene, i) => i === index ? { ...scene, [field]: value } : scene) : prev
        );
    }, []);

    // ── Real generation pipeline ──────────────────────────────────────────────
    const runGenerationPipeline = useCallback(async (
        currentProject: DirectorProject,
        scenes: Scene[]
    ) => {
        setPipelineError(null);

        try {
            // ── Step 1: Narration script from scenes ──────────────────────
            setPipelineStep('Generating narration script...');
            setCurrentState('generating_narration');

            const combinedScript = scenes.map(s => s.primary_visuals).join('\n');
            const narrationResult: DirectNarrationResult = await narrationService.generateDirectNarration(
                `Project: ${currentProject.name}\nScript: ${currentProject.script}\nStyle: ${currentProject.genre}\nDuration: ${currentProject.duration}\nAspect Ratio: ${currentProject.aspectRatio}\nScene Visuals:\n${combinedScript}`
            );

            // ── Step 2: Fetch footage ─────────────────────────────────────
            setPipelineStep('Fetching scene footage...');
            setCurrentState('fetching_videos');

            const videoUrls = await fetchVideosFromStorage();
            const selectedUrls = videoUrls.slice(0, 3);
            if (selectedUrls.length < 3) {
                throw new Error('Not enough videos in storage. Need at least 3.');
            }
            setProject(prev => ({ ...prev, videoUrls: selectedUrls }));

            // ── Step 3: TTS audio ─────────────────────────────────────────
            setPipelineStep('Generating audio narration...');
            setCurrentState('generating_audio');

            const { ttsService } = await import('../services/TTSService');
            const sessionId = `director-${Date.now()}`;
            const audioUrl = await ttsService.generateNarrationAudio(
                narrationResult.narration.fullNarration,
                sessionId
            );
            setProject(prev => ({ ...prev, audioUrl }));

            // ── Step 4: SQS stitching + poll ──────────────────────────────
            setPipelineStep('Stitching your cinematic scene...');
            setCurrentState('stitching');

            const result = await dispatchStitchingJob(selectedUrls, audioUrl);
            if (!result.success || !result.jobId) {
                throw new Error(result.error || 'SQS dispatch failed');
            }

            const maxAttempts = 24;
            let stitchedUrl: string | null = null;
            for (let i = 0; i < maxAttempts; i++) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                try {
                    const stitchedVideos = await fetchStitchedVideos();
                    const match = stitchedVideos.find(url => url.includes(result.jobId!));
                    if (match) { stitchedUrl = match; break; }
                } catch (pollErr) {
                    console.error('Polling error:', pollErr);
                }
            }

            if (!stitchedUrl) throw new Error('Stitching timed out. Please try again.');

            setProject(prev => ({ ...prev, stitchedVideoUrl: stitchedUrl! }));
            setPipelineStep('Complete');
            addMessage("Your cinematic scene is ready! Take a look.", 'assistant', 'result');
            setCurrentState('complete');

        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            console.error('Director pipeline error:', error);
            setPipelineError(msg);
            addMessage(`Generation failed: ${msg}`, 'assistant');
            setCurrentState('scene_review'); // allow retry
        }
    }, [addMessage]);

    // Called when user confirms the scene review (replaces old "review → YES")
    const handleSceneConfirmation = useCallback(() => {
        if (!analyzedScenes) return;
        addMessage("Initializing cinematic engine…", 'assistant', 'progress');
        runGenerationPipeline(project, analyzedScenes);
    }, [analyzedScenes, project, addMessage, runGenerationPipeline]);

    // ── Wizard step handler ───────────────────────────────────────────────────
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

            case 'genre': {
                const finalProject = { ...project, genre: input };
                setProject(finalProject);
                setCurrentState('generating_scenes');
                addMessage("Excellent choices. Analyzing your script and generating cinematic scenes…", 'assistant');

                try {
                    const durationSeconds = parseInt(finalProject.duration.replace(/[^0-9]/g, '')) || 30;
                    const fullPrompt = `${finalProject.script} Style: ${input}. Aspect Ratio: ${finalProject.aspectRatio}.`;
                    const scenes = await analyzeScenes(fullPrompt, durationSeconds);
                    setAnalyzedScenes(scenes);
                    addMessage("Your scenes are ready! Review and edit them below, then click Confirm & Generate.", 'assistant', 'scene_review');
                    setCurrentState('scene_review');
                } catch (err) {
                    const msg = err instanceof Error ? err.message : 'Scene generation failed';
                    addMessage(`Could not generate scenes: ${msg}. Please try again.`, 'assistant');
                    setCurrentState('genre');
                }
                break;
            }

            case 'scene_review': {
                const lower = input.toLowerCase();
                if (lower.includes('yes') || lower.includes('proceed') || lower.includes('confirm')) {
                    handleSceneConfirmation();
                } else {
                    addMessage("Click the \"Confirm & Generate\" button in the scene card above, or type \"proceed\" to continue.", 'assistant');
                }
                break;
            }

            default:
                break;
        }
    }, [currentState, project, addMessage, handleSceneConfirmation]);

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
        setProject({ name: '', script: '', duration: '', aspectRatio: '', genre: '', videoUrls: [] });
        setAnalyzedScenes(null);
        setPipelineError(null);
        setPipelineStep('');
    }, []);

    return {
        messages,
        currentState,
        project,
        analyzedScenes,
        pipelineStep,
        pipelineError,
        handleNext,
        handleSceneConfirmation,
        updateScene,
        resetFlow,
    };
}
