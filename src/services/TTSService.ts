import { getAuth } from 'firebase/auth';
import { firebaseApp } from '../config/firebase';

export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type TTSModel = 'tts-1' | 'tts-1-hd';

export interface TTSOptions {
    voice?: OpenAIVoice;
    model?: TTSModel;
    speed?: number;
}

export const getAuthToken = async () => {
    const auth = getAuth(firebaseApp);
    const user = auth.currentUser;
    if (!user) throw new Error("Authentication required");
    return await user.getIdToken();
};

export const apiFetch = async (endpoint: string, body: any) => {
    const token = await getAuthToken();
    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
        throw new Error(result.error?.message || `API Request Failed: ${response.status}`);
    }
    return result.data;
};

class TTSService {
    async generateNarrationAudio(
        narrationText: string,
        sessionId: string = `session-${Date.now()}`,
        options: TTSOptions = {}
    ): Promise<string> {
        console.log('🎙️ Generating TTS audio through secure backend limits...');
        const res = await apiFetch('/api/tts', { narrationText, sessionId, options });
        return res.audioUrl;
    }

    estimateDuration(text: string): number {
        const wordCount = text.split(/\s+/).length;
        const wordsPerMinute = 150;
        return Math.ceil((wordCount / wordsPerMinute) * 60);
    }

    validateText(text: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        if (text.length < 10) errors.push('Text too short (minimum 10 characters)');
        if (text.length > 4096) errors.push('Text too long (maximum 4096 characters)');
        if (!text.trim()) errors.push('Text cannot be empty');
        return { valid: errors.length === 0, errors };
    }

    getAvailableVoices(): Array<{ id: OpenAIVoice; name: string; description: string }> {
        return [
            { id: 'alloy', name: 'Alloy', description: 'Neutral, balanced voice' },
            { id: 'echo', name: 'Echo', description: 'Male voice' },
            { id: 'fable', name: 'Fable', description: 'British accent' },
            { id: 'onyx', name: 'Onyx', description: 'Deep male voice' },
            { id: 'nova', name: 'Nova', description: 'Female voice' },
            { id: 'shimmer', name: 'Shimmer', description: 'Feminine, warm voice' }
        ];
    }
}

export const ttsService = new TTSService();
