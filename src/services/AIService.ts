import { apiFetch } from './TTSService'; // Reuse apiFetch locally

export interface Scene {
    scene: string;
    scene_objective: string;
    primary_visuals: string;
    emotional_tone: string;
    transition_logic: string;
    shots?: Shot[];
}

export interface Shot {
    shot_number: number;
    description: string;
    duration_seconds?: number;
    camera_movement?: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    type?: 'greeting' | 'enhancement' | 'scenes' | 'scene_review';
}

export interface EnhancedStory {
    originalStory: string;
    enhancedPrompt: string;
    keyVisuals: string[];
    moodSuggestions: string[];
    cinematicElements: string[];
}

export const generateGreeting = async (): Promise<string> => {
    return "Hi I'm Vevo! Share your story, and I'll help bring it to life.";
};

export const generateClarifyingQuestions = async (userStory: string): Promise<string[]> => {
    try {
        const res = await apiFetch('/api/ai', { action: 'generateClarifyingQuestions', payload: { userStory } });
        return res.questions || [];
    } catch (error) {
        console.error('Failed to generate questions:', error);
        return [];
    }
};

export const enhanceStory = async (userStory: string): Promise<EnhancedStory> => {
    try {
        const res = await apiFetch('/api/ai', { action: 'enhanceStory', payload: { userStory } });
        return {
            originalStory: userStory,
            enhancedPrompt: res.enhancedPrompt || userStory,
            keyVisuals: res.keyVisuals || [],
            moodSuggestions: res.moodSuggestions || [],
            cinematicElements: res.cinematicElements || []
        };
    } catch (error) {
        console.error('Story enhancement failed:', error);
        return {
            originalStory: userStory,
            enhancedPrompt: userStory,
            keyVisuals: [], moodSuggestions: [], cinematicElements: []
        };
    }
};

export const analyzeScenes = async (fullPrompt: string, duration: number = 60): Promise<Scene[]> => {
    try {
        const res = await apiFetch('/api/ai', { action: 'analyzeScenes', payload: { fullPrompt, duration } });
        return res.scenes;
    } catch (error) {
        console.error('AI Analysis Failed:', error);
        throw error;
    }
};
