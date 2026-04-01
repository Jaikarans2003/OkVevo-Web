import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

const NarrationSchema = z.object({
    action: z.enum(['generateDirectNarration', 'generateNarrationFromScenes', 'regenerateNarration']),
    payload: z.any()
});

export const POST = apiHandler(async (req) => {
    const body = await req.json();
    const validation = NarrationSchema.safeParse(body);
    if (!validation.success) {
        throw new Error(`Invalid request format: ${validation.error.issues[0].message}`);
    }

    const { action, payload } = validation.data;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel(
        { model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json", temperature: 0.7 } },
        { timeout: 10000 } // 10s timeout strategy for Gemini
    );

    if (action === 'generateDirectNarration') {
        const { userScript } = z.object({ userScript: z.string().min(10) }).parse(payload);
        const prompt = `You are a professional narrator and video director. Transform this user script into a compelling 1-minute narration for a video.\nUser Script: "${userScript}"\nReturn JSON: { "narration": { "fullNarration": "...", "segments": [{"text": "...", "startTime": 0, "endTime": 20, "sceneIndex": 0}, {"text": "...", "startTime": 20, "endTime": 40, "sceneIndex": 1}, {"text": "...", "startTime": 40, "endTime": 60, "sceneIndex": 2}], "estimatedDuration": 60 }, "internalScenes": [{"scene": "Scene 1 (0-20s)", "scene_objective": "...", "primary_visuals": "...", "emotional_tone": "...", "transition_logic": "..."}] }`;
        const result = await model.generateContent(prompt);
        return apiSuccess(JSON.parse(result.response.text()));
    }

    if (action === 'generateNarrationFromScenes') {
        const { scenes, originalScript } = z.object({ scenes: z.array(z.any()), originalScript: z.string() }).parse(payload);
        const prompt = `You are a professional narrator creating a 1-minute voice-over script.\nOriginal Story: "${originalScript}"\nReturn JSON: { "fullNarration": "...", "segments": [{"text": "...", "startTime": 0, "endTime": 20, "sceneIndex": 0}], "estimatedDuration": 60 }`;
        const result = await model.generateContent(prompt);
        return apiSuccess(JSON.parse(result.response.text()));
    }

    if (action === 'regenerateNarration') {
        const { previousNarration, userFeedback } = z.object({ previousNarration: z.any(), userFeedback: z.string() }).parse(payload);
        const prompt = `Refine narration based on user feedback.\nPrevious: "${previousNarration.fullNarration}"\nFeedback: "${userFeedback}"\nReturn the same JSON format as before with updated content.`;
        const result = await model.generateContent(prompt);
        return apiSuccess(JSON.parse(result.response.text()));
    }

    throw new Error("Invalid narration action");
}, { limitPerMin: 10 }); // 10/min per user Layer 1 rate limit as per specs
