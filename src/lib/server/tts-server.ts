import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '../../config/firebase'; // Reusing existing app initialization
import { callWithRetry } from './ai-server';

// Redefining types as needed for backend execution
export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type TTSModel = 'tts-1' | 'tts-1-hd';

export interface TTSOptions {
    voice?: OpenAIVoice;
    model?: TTSModel;
    speed?: number;
}

export const generateNarrationAudioServer = async (
    narrationText: string,
    sessionId: string = `session-${Date.now()}`,
    options: TTSOptions = {}
): Promise<string> => {
    const apiKey = process.env.OPENAI_API_KEY; // Secure backend key!
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY in environment variables");

    const voice = options.voice || 'shimmer';
    const model = options.model || 'tts-1-hd';
    const speed = options.speed || 1.0;

    // Retry wrapper standardizing API 5xx issues
    const audioBlob = await callWithRetry(async () => {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ model, voice, input: narrationText, response_format: 'mp3', speed }),
            // Fetch timeout handles hanging API responses
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI TTS API failed: ${response.status} - ${errorText}`);
        }
        return await response.blob();
    }, 3, 2000); // 3 retries, starting at 2s

    // Upload to Firebase Storage
    const storage = getStorage(firebaseApp);
    const timestamp = Date.now();
    const filename = `narration-${sessionId}-${timestamp}.mp3`;
    const storageRef = ref(storage, `audio/${filename}`);

    await uploadBytes(storageRef, audioBlob, {
        contentType: 'audio/mpeg',
        customMetadata: { sessionId, generatedAt: new Date().toISOString() }
    });

    return await getDownloadURL(storageRef);
};
