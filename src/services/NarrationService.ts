import { apiFetch } from './TTSService';
import type { Scene } from './AIService';

export interface NarrationSegment {
    text: string;
    startTime: number;  
    endTime: number;    
    sceneIndex: number; 
}

export interface NarrationScript {
    fullNarration: string;
    segments: NarrationSegment[];
    estimatedDuration: number; 
}

export interface DirectNarrationResult {
    narration: NarrationScript;
    internalScenes: Scene[];  
}

class NarrationService {
    async generateDirectNarration(userScript: string): Promise<DirectNarrationResult> {
        try {
            console.log('🎬 Generating narration directly from user script securely...');
            const res = await apiFetch('/api/narration', { action: 'generateDirectNarration', payload: { userScript } });
            return {
                narration: res.narration,
                internalScenes: res.internalScenes
            };
        } catch (error) {
            console.error('❌ Direct narration generation failed:', error);
            throw error;
        }
    }

    async generateNarrationFromScenes(scenes: Scene[], originalScript: string): Promise<NarrationScript> {
        try {
            const res = await apiFetch('/api/narration', { action: 'generateNarrationFromScenes', payload: { scenes, originalScript } });
            return {
                fullNarration: res.fullNarration,
                segments: res.segments,
                estimatedDuration: res.estimatedDuration || 60
            };
        } catch (error) {
            console.error('❌ Narration generation failed:', error);
            throw error;
        }
    }

    async regenerateNarration(previousNarration: NarrationScript, userFeedback: string): Promise<NarrationScript> {
        try {
            const res = await apiFetch('/api/narration', { action: 'regenerateNarration', payload: { previousNarration, userFeedback } });
            return {
                fullNarration: res.fullNarration,
                segments: res.segments,
                estimatedDuration: res.estimatedDuration || 60
            };
        } catch (error) {
            console.error('❌ Narration regeneration failed:', error);
            throw error;
        }
    }
}

export const narrationService = new NarrationService();
