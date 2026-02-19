
import { useState, useCallback } from 'react';
import { narrationService, DirectNarrationResult } from '../services/NarrationService';
import { analyzeScenes } from '../services/AIService';
import type { Scene } from '../services/AIService';
import { fetchVideosFromStorage, fetchStitchedVideos, uploadCharacterSheets } from '../services/StorageService';
import { dispatchStitchingJob } from '../services/SQSStitchService';

export type DirectorFlowState =
    | 'idle'
    | 'naming'
    | 'scripting'
    | 'duration'
    | 'aspect_ratio'
    | 'genre'
    | 'character_sheets'
    | 'generating_scenes'
    | 'scene_review'
    | 'generating_narration'
    | 'fetching_videos'
    | 'generating_audio'
    | 'stitching'
    | 'complete';

export interface CharacterSheet {
    name: string;
    description: string;
    imageDataUrl?: string; // base-64 data URL (jpg/jpeg/png)
}

export interface DirectorProject {
    name: string;
    script: string;
    duration: string;
    aspectRatio: string;
    genre: string;
    characterSheets: CharacterSheet[];
    videoUrls: string[];
    audioUrl?: string;
    stitchedVideoUrl?: string;
}

export interface Message {
    id: string;
    role: 'assistant' | 'user';
    content: string;
    type?: 'text' | 'choice' | 'scene_review' | 'progress' | 'result' | 'character_sheets';
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
        characterSheets: [],
        videoUrls: [],
    });
    const [analyzedScenes, setAnalyzedScenes] = useState<Scene[] | null>(null);

    // ── Character sheet helpers ───────────────────────────────────────────────
    const addCharacterSheet = useCallback(() => {
        setProject(prev => ({
            ...prev,
            characterSheets: [...prev.characterSheets, { name: '', description: '' }],
        }));
    }, []);

    const removeCharacterSheet = useCallback((index: number) => {
        setProject(prev => ({
            ...prev,
            characterSheets: prev.characterSheets.filter((_, i) => i !== index),
        }));
    }, []);

    const updateCharacterSheet = useCallback((index: number, field: keyof CharacterSheet, value: string) => {
        setProject(prev => ({
            ...prev,
            characterSheets: prev.characterSheets.map((sheet, i) =>
                i === index ? { ...sheet, [field]: value } : sheet
            ),
        }));
    }, []);

    const setCharacterSheets = useCallback((sheets: CharacterSheet[]) => {
        setProject(prev => ({ ...prev, characterSheets: sheets }));
    }, []);
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
                setProject(prev => ({ ...prev, genre: input }));
                addMessage(
                    "Great choice! Would you like to upload character sheets? You can add images, names, and descriptions for your characters — or skip this step entirely.",
                    'assistant',
                    'character_sheets'
                );
                setCurrentState('character_sheets');
                break;
            }

            // character_sheets is handled by submitCharacterSheets below

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

    // Dedicated handler for the character-sheets step.
    // Receives `sheets` directly to avoid stale-closure issues with `project` state.
    const submitCharacterSheets = useCallback(async (sheets: CharacterSheet[]) => {
        addMessage(sheets.length ? `Added ${sheets.length} character sheet(s).` : 'Skipping character sheets.', 'user');
        setCurrentState('generating_scenes');

        // Upload images to Firebase Storage (only if any sheets have an image)
        let sheetsWithUrls = sheets;
        const sheetsWithImages = sheets.filter(s => s.imageDataUrl);
        if (sheetsWithImages.length > 0) {
            addMessage(`Uploading ${sheetsWithImages.length} character sheet image(s) to storage…`, 'assistant');
            const sessionId = `director-${Date.now()}`;
            try {
                const uploaded = await uploadCharacterSheets(sheets, sessionId);
                // Merge download URLs back into sheets
                sheetsWithUrls = sheets.map((s, i) => ({
                    ...s,
                    imageDataUrl: uploaded[i]?.downloadUrl ?? s.imageDataUrl,
                }));
            } catch (uploadErr) {
                console.error('Character sheet upload error (non-fatal):', uploadErr);
                // Non-fatal — continue with local data URLs
            }
        }

        // Persist (possibly enriched) sheets to project state
        setProject(prev => ({ ...prev, characterSheets: sheetsWithUrls }));

        addMessage("Excellent. Analyzing your script and generating cinematic scenes…", 'assistant');

        try {
            const durationSeconds = parseInt(project.duration.replace(/[^0-9]/g, '')) || 30;
            const characterContext = sheetsWithUrls.length
                ? '\nCharacters:\n' + sheetsWithUrls
                    .filter(c => c.name)
                    .map(c => `- ${c.name}: ${c.description}`)
                    .join('\n')
                : '';
            const fullPrompt = `${project.script} Style: ${project.genre}. Aspect Ratio: ${project.aspectRatio}.${characterContext}`;
            const scenes = await analyzeScenes(fullPrompt, durationSeconds);
            setAnalyzedScenes(scenes);
            addMessage("Your scenes are ready! Review and edit them below, then click Confirm & Generate.", 'assistant', 'scene_review');
            setCurrentState('scene_review');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Scene generation failed';
            addMessage(`Could not generate scenes: ${msg}. Please try again.`, 'assistant');
            setCurrentState('character_sheets');
        }
    }, [project, addMessage]);

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
        setProject({ name: '', script: '', duration: '', aspectRatio: '', genre: '', characterSheets: [], videoUrls: [] });
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
        submitCharacterSheets,
    };
}
