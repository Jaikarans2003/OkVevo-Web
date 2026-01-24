import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Scene } from './AIService';

export interface NarrationSegment {
    text: string;
    startTime: number;  // seconds
    endTime: number;    // seconds
    sceneIndex: number; // which scene (0, 1, 2)
}

export interface NarrationScript {
    fullNarration: string;
    segments: NarrationSegment[];
    estimatedDuration: number; // total duration in seconds
}

export interface DirectNarrationResult {
    narration: NarrationScript;
    internalScenes: Scene[];  // Generated internally for video generation
}

/**
 * NarrationService
 * 
 * Generates optimized narration scripts from scenes for TTS audio generation.
 * Combines documentary style with story-driven narrative.
 */
class NarrationService {
    /**
     * 🚀 OPTIMIZED: Generate 1-minute narration directly from user script
     * Single Gemini API call - generates narration + internal scene structure
     * This replaces the need for separate scene analysis + narration steps
     * 
     * @param userScript - User's original story/script
     * @returns DirectNarrationResult with narration and internal scenes
     */
    async generateDirectNarration(userScript: string): Promise<DirectNarrationResult> {
        try {
            const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error("Missing NEXT_PUBLIC_GEMINI_API_KEY");
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.7
                }
            });

            const prompt = `You are a professional narrator and video director. Transform this user script into a compelling 1-minute narration for a video.

User Script: "${userScript}"

Your task:
1. Create a **documentary-style, story-driven narration** (150-180 words total)
2. Internally break the story into 3 cinematic scenes (20s each) for video generation
3. Create narration segments that match each scene
4. Optimize text for TTS (natural speech, proper punctuation)

Requirements:
- **Engaging narrative voice** - observational yet story-driven
- **Smooth flow** - transitions between segments feel natural  
- **TTS-friendly** - use commas for pauses, avoid complex words
- **60-second pacing** - ~30 words per 20-second segment

Return JSON:
{
  "narration": {
    "fullNarration": "complete narration as one flowing text",
    "segments": [
      {
        "text": "narration for scene 1",
        "startTime": 0,
        "endTime": 20,
        "sceneIndex": 0
      },
      {
        "text": "narration for scene 2", 
        "startTime": 20,
        "endTime": 40,
        "sceneIndex": 1
      },
      {
        "text": "narration for scene 3",
        "startTime": 40,
        "endTime": 60,
        "sceneIndex": 2
      }
    ],
    "estimatedDuration": 60
  },
  "internalScenes": [
    {
      "scene": "Scene 1 (0-20s)",
      "scene_objective": "brief objective",
      "primary_visuals": "detailed visual description for video generation (follows LTX-2 prompting guide)",
      "emotional_tone": "mood",
      "transition_logic": "transition type"
    },
    {
      "scene": "Scene 2 (20-40s)",
      "scene_objective": "brief objective",
      "primary_visuals": "detailed visual description",
      "emotional_tone": "mood",
      "transition_logic": "transition type"
    },
    {
      "scene": "Scene 3 (40-60s)",
      "scene_objective": "brief objective",
      "primary_visuals": "detailed visual description",
      "emotional_tone": "mood",
      "transition_logic": "transition type"
    }
  ]
}`;

            console.log('🎬 Generating narration directly from user script (single API call)...');
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const content = response.text();

            if (!content) {
                throw new Error("No content received from Gemini");
            }

            const parsed = JSON.parse(content);

            // Validate structure
            if (!parsed.narration || !parsed.internalScenes) {
                throw new Error("Invalid response structure");
            }

            if (parsed.narration.segments?.length !== 3 || parsed.internalScenes?.length !== 3) {
                throw new Error("Expected 3 segments and 3 scenes");
            }

            console.log('✅ Direct narration generated:', {
                words: parsed.narration.fullNarration.split(' ').length,
                segments: parsed.narration.segments.length,
                scenes: parsed.internalScenes.length
            });

            return {
                narration: parsed.narration,
                internalScenes: parsed.internalScenes
            };

        } catch (error) {
            console.error('❌ Direct narration generation failed:', error);
            throw new Error(`Failed to generate narration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * LEGACY: Generate a 1-minute narration script from pre-analyzed scenes
     * (Kept for backward compatibility - prefer generateDirectNarration instead)
     * 
     * @param scenes - Array of 3 scenes (20s each)
     * @param originalScript - User's original story
     * @returns NarrationScript with timing metadata
     */
    async generateNarrationFromScenes(
        scenes: Scene[],
        originalScript: string
    ): Promise<NarrationScript> {
        try {
            const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error("Missing NEXT_PUBLIC_GEMINI_API_KEY");
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.7
                }
            });

            const prompt = `You are a professional narrator creating a 1-minute voice-over script for a short film. 

Original Story: "${originalScript}"

Scene Breakdown:
${scenes.map((scene, idx) => `
Scene ${idx + 1} (${idx * 20}-${(idx + 1) * 20}s): ${scene.scene_objective}
Visuals: ${scene.primary_visuals}
Tone: ${scene.emotional_tone}
`).join('\n')}

Create a compelling 1-minute narration script (approximately 150-180 words) that:

1. **Documentary Style**: Maintains an observational, engaging narrative voice
2. **Story-Driven**: Follows the emotional arc and key moments of the story
3. **Timed Segments**: Divide the narration into 3 segments matching the 3 scenes (0-20s, 20-40s, 40-60s)
4. **TTS Optimized**: 
   - Use natural speech patterns with proper punctuation
   - Include pauses with commas and periods
   - Avoid complex words or tongue-twisters
   - Aim for ~30 words per 20-second segment
5. **Flow**: Ensure smooth transitions between segments
6. **Engagement**: Create intrigue, emotion, and story progression

Return JSON:
{
  "fullNarration": "complete narration text as one string",
  "segments": [
    {
      "text": "narration for scene 1",
      "startTime": 0,
      "endTime": 20,
      "sceneIndex": 0
    },
    {
      "text": "narration for scene 2",
      "startTime": 20,
      "endTime": 40,
      "sceneIndex": 1
    },
    {
      "text": "narration for scene 3",
      "startTime": 40,
      "endTime": 60,
      "sceneIndex": 2
    }
  ],
  "estimatedDuration": 60
}`;

            console.log('🎬 Generating narration script...');
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const content = response.text();

            if (!content) {
                throw new Error("No content received from Gemini");
            }

            const parsed = JSON.parse(content);

            // Validate structure
            if (!parsed.fullNarration || !parsed.segments || parsed.segments.length !== 3) {
                throw new Error("Invalid narration structure received");
            }

            console.log('✅ Narration script generated:', {
                words: parsed.fullNarration.split(' ').length,
                segments: parsed.segments.length
            });

            return {
                fullNarration: parsed.fullNarration,
                segments: parsed.segments,
                estimatedDuration: parsed.estimatedDuration || 60
            };

        } catch (error) {
            console.error('❌ Narration generation failed:', error);
            throw new Error(`Failed to generate narration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Re-generate narration with custom modifications
     * 
     * @param previousNarration - Previous narration script
     * @param userFeedback - User's feedback for improvements
     * @returns Updated NarrationScript
     */
    async regenerateNarration(
        previousNarration: NarrationScript,
        userFeedback: string
    ): Promise<NarrationScript> {
        try {
            const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error("Missing NEXT_PUBLIC_GEMINI_API_KEY");
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.7
                }
            });

            const prompt = `You are refining a narration script based on user feedback.

Previous Narration: "${previousNarration.fullNarration}"

User Feedback: "${userFeedback}"

Create an improved version that:
1. Addresses the user's feedback
2. Maintains the same structure (3 segments, 20s each)
3. Keeps approximately the same length (150-180 words)
4. Preserves timing metadata

Return the same JSON format as before with updated content.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const content = response.text();

            if (!content) {
                throw new Error("No content received from Gemini");
            }

            const parsed = JSON.parse(content);

            return {
                fullNarration: parsed.fullNarration,
                segments: parsed.segments,
                estimatedDuration: parsed.estimatedDuration || 60
            };

        } catch (error) {
            console.error('❌ Narration regeneration failed:', error);
            throw error;
        }
    }
}

export const narrationService = new NarrationService();
