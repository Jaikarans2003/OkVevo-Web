import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { tryGeminiWithFallback, fallbackToGroq } from '@/lib/server/ai-server';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Input Schemas
const ActionSchema = z.object({
    action: z.enum(['analyzeScenes', 'enhanceStory', 'generateClarifyingQuestions']),
    payload: z.any()
});

export const POST = apiHandler(async (req) => {
    const body = await req.json();
    
    // Validate Input Structure
    const validation = ActionSchema.safeParse(body);
    if (!validation.success) {
        throw new Error(`Invalid request format: ${validation.error.issues[0].message}`);
    }

    const { action, payload } = validation.data;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Server misconfiguration: missing AI keys");

    switch (action) {
        case 'analyzeScenes': {
            const { fullPrompt, duration } = z.object({ fullPrompt: z.string().min(10), duration: z.number().optional() }).parse(payload);
            try {
                const scenes = await tryGeminiWithFallback(fullPrompt, duration);
                return apiSuccess({ scenes });
            } catch (err) {
                // Execute fallback strategy from user requirements: Gemini -> Groq
                console.log("Falling back to Groq for analyzeScenes...");
                const scenes = await fallbackToGroq(fullPrompt);
                return apiSuccess({ scenes });
            }
        }
        
        case 'enhanceStory': {
            const { userStory } = z.object({ userStory: z.string().min(5) }).parse(payload);
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel(
                { model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } },
                { timeout: 10000 }
            );
            
            const prompt = `You are a creative storytelling assistant following the LTX-2 Prompting Guide. Enhance this user story into a single, flowing cinematic paragraph: "${userStory}"\nReturn JSON: { "originalStory": "...", "enhancedPrompt": "...", "keyVisuals": [], "moodSuggestions": [], "cinematicElements": [] }`;
            
            const result = await model.generateContent(prompt);
            const parsed = JSON.parse(result.response.text());
            return apiSuccess(parsed);
        }

        case 'generateClarifyingQuestions': {
            const { userStory } = z.object({ userStory: z.string().min(5) }).parse(payload);
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel(
                { model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } },
                { timeout: 10000 }
            );
            
            const prompt = `Story: "${userStory}"\nAsk exactly 3 short, specific questions to clarify visual details for a video. Return JSON: { "questions": ["Q1?","Q2?","Q3?"] }`;
            
            const result = await model.generateContent(prompt);
            const qs = JSON.parse(result.response.text()).questions;
            return apiSuccess({ questions: qs || [] });
        }

        default:
            throw new Error("Invalid action provided");
    }
}, { limitPerMin: 10 }); // 10req/min as per user requirements
