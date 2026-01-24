import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '../config/firebase';

export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type TTSModel = 'tts-1' | 'tts-1-hd';

export interface TTSOptions {
    voice?: OpenAIVoice;
    model?: TTSModel;
    speed?: number; // 0.25 to 4.0
}

/**
 * TTSService
 * 
 * Handles OpenAI Text-to-Speech API integration for generating narration audio.
 * Automatically uploads generated audio to Firebase Storage.
 */
class TTSService {
    private apiKey: string;
    private storage: ReturnType<typeof getStorage>;

    constructor() {
        const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("Missing NEXT_PUBLIC_OPENAI_API_KEY in environment variables");
        }
        this.apiKey = apiKey;
        this.storage = getStorage(firebaseApp);
    }

    /**
     * Generate audio narration from text using OpenAI TTS
     * 
     * @param narrationText - The narration script text
     * @param sessionId - Unique session identifier for file naming
     * @param options - TTS configuration options
     * @returns Firebase Storage URL for the generated audio
     */
    async generateNarrationAudio(
        narrationText: string,
        sessionId: string = `session-${Date.now()}`,
        options: TTSOptions = {}
    ): Promise<string> {
        try {
            console.log('🎙️ Generating TTS audio...', {
                textLength: narrationText.length,
                voice: options.voice || 'shimmer'
            });

            // Note: OpenAI doesn't have a "coral" voice, using "shimmer" as feminine alternative
            // Available voices: alloy, echo, fable, onyx, nova, shimmer
            const voice = options.voice || 'shimmer'; // Using shimmer as requested "coral" equivalent
            const model = options.model || 'tts-1-hd'; // High quality
            const speed = options.speed || 1.0; // Normal speed

            // Call OpenAI TTS API
            const response = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    voice,
                    input: narrationText,
                    response_format: 'mp3',
                    speed
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI TTS API failed: ${response.status} - ${errorText}`);
            }

            // Get audio blob
            const audioBlob = await response.blob();
            console.log('✅ Audio generated:', {
                size: `${(audioBlob.size / 1024).toFixed(2)} KB`,
                type: audioBlob.type
            });

            // Upload to Firebase Storage
            const audioUrl = await this.uploadAudioToStorage(audioBlob, sessionId);
            console.log('✅ Audio uploaded to Firebase:', audioUrl);

            return audioUrl;

        } catch (error) {
            console.error('❌ TTS generation failed:', error);
            throw new Error(`Failed to generate audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Upload audio blob to Firebase Storage
     * 
     * @param audioBlob - Audio file blob
     * @param sessionId - Session identifier for file naming
     * @returns Public download URL
     */
    private async uploadAudioToStorage(
        audioBlob: Blob,
        sessionId: string
    ): Promise<string> {
        try {
            const timestamp = Date.now();
            const filename = `narration-${sessionId}-${timestamp}.mp3`;
            const storageRef = ref(this.storage, `audio/${filename}`);

            console.log('📤 Uploading audio to Firebase Storage...');

            // Upload with metadata
            await uploadBytes(storageRef, audioBlob, {
                contentType: 'audio/mpeg',
                customMetadata: {
                    sessionId,
                    generatedAt: new Date().toISOString()
                }
            });

            // Get public download URL
            const downloadURL = await getDownloadURL(storageRef);

            return downloadURL;

        } catch (error) {
            console.error('❌ Audio upload failed:', error);
            throw new Error(`Failed to upload audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Estimate audio duration based on text length
     * Average speaking rate: ~150 words per minute
     * 
     * @param text - Narration text
     * @returns Estimated duration in seconds
     */
    estimateDuration(text: string): number {
        const wordCount = text.split(/\s+/).length;
        const wordsPerMinute = 150; // Average speaking rate
        const durationMinutes = wordCount / wordsPerMinute;
        return Math.ceil(durationMinutes * 60);
    }

    /**
     * Validate text for TTS (check length, special characters, etc.)
     * 
     * @param text - Text to validate
     * @returns Validation result
     */
    validateText(text: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Check minimum length
        if (text.length < 10) {
            errors.push('Text too short (minimum 10 characters)');
        }

        // Check maximum length (OpenAI limit: 4096 characters)
        if (text.length > 4096) {
            errors.push('Text too long (maximum 4096 characters)');
        }

        // Check for empty text
        if (!text.trim()) {
            errors.push('Text cannot be empty');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get available voices with descriptions
     */
    getAvailableVoices(): Array<{ id: OpenAIVoice; name: string; description: string }> {
        return [
            { id: 'alloy', name: 'Alloy', description: 'Neutral, balanced voice' },
            { id: 'echo', name: 'Echo', description: 'Male voice' },
            { id: 'fable', name: 'Fable', description: 'British accent' },
            { id: 'onyx', name: 'Onyx', description: 'Deep male voice' },
            { id: 'nova', name: 'Nova', description: 'Female voice' },
            { id: 'shimmer', name: 'Shimmer', description: 'Feminine, warm voice (similar to "coral")' }
        ];
    }
}

export const ttsService = new TTSService();
