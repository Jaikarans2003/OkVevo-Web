import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { z } from 'zod';

const VisionOrchestratorSchema = z.object({
    heroImageBase64: z.string().optional(),
    sceneImageBase64: z.string().optional(),
    userPrompt: z.string().optional(),
    referenceImageBase64: z.string().optional(),
    referenceImageUrl: z.string().url().optional(),
    refinementPrompt: z.string().optional(),
});

const VISION_ORCHESTRATOR_SYSTEM_PROMPT = `You are a Professional Product Photographer and Prompt Engineer. Your task is to analyze two input images: a Hero Product and a Scene Environment.

1. Identify the Primary Lighting Source (Direction, Intensity, Color Temperature) of the Scene.
2. Identify the Camera Perspective (Eye level, Low angle, Bokeh/Depth of Field).
3. Generate a technical NANOBANANA PRO Master Prompt that instructs the model to:
   - Place the [Hero Product] into the [Scene Environment] with matched global illumination.
   - Apply contact shadows and ambient occlusion where the product meets the surface.
   - Match the reflections on the product surface to the surrounding environment.
   - Ensure the focal length and grain of the product match the background scene for a 100% photorealistic composite.

Output ONLY the final Master Prompt as a single cohesive paragraph. Do not include any preamble, explanation, or numbered steps — just the prompt itself.`;

const REFINEMENT_SYSTEM_PROMPT = `You are a Professional Product Photographer and Prompt Engineer. You are given an existing AI-generated composite image and a user's refinement request.

Your task is to:
1. Analyze the current composite image — identify the product, scene, lighting, camera angle, and overall composition.
2. Understand the user's requested changes (e.g. lighting adjustments, repositioning, style changes).
3. Generate an updated NANOBANANA PRO Master Prompt that reproduces the existing composite but with the user's requested modifications applied.

The new Master Prompt must be self-contained — it should fully describe the desired output image including all original details plus the requested changes.

Output ONLY the final Master Prompt as a single cohesive paragraph. Do not include any preamble, explanation, or numbered steps — just the prompt itself.`;

export const POST = apiHandler(async (request, ctx) => {
    const body = await request.json();
    const validation = VisionOrchestratorSchema.safeParse(body);
    
    if (!validation.success) {
        throw new Error(`Invalid request format: ${validation.error.issues[0].message}`);
    }

    const { heroImageBase64, sceneImageBase64, userPrompt, referenceImageBase64, referenceImageUrl, refinementPrompt } = validation.data;

    // ── Determine mode: initial composition vs. refinement ──
    const isRefinement = (!!referenceImageBase64 || !!referenceImageUrl) && !!refinementPrompt;

    if (!isRefinement && (!heroImageBase64 || !sceneImageBase64 || !userPrompt)) {
        throw new Error('Provide hero+scene images AND userPrompt for initial composition, or referenceImage+refinementPrompt for refinement');
    }

    // ── Try Groq first (vision-capable, generous free tier) ──
    const groqKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;
    // ── Fallback to Gemini ──
    const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!groqKey && !geminiKey) {
        throw new Error('No AI API key configured (Groq or Gemini)');
    }

    // Ensure base64 images have proper data URL prefix
    const ensureDataUrl = (b64: string) => {
        if (b64.startsWith('data:')) return b64;
        return `data:image/jpeg;base64,${b64}`;
    };

    let masterPrompt: string;

    if (isRefinement) {
        // ── Refinement mode ──
        let refB64 = referenceImageBase64;
        if (!refB64 && referenceImageUrl) {
            const imgRes = await fetch(referenceImageUrl);
            const buffer = Buffer.from(await imgRes.arrayBuffer());
            const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
            refB64 = `data:${contentType};base64,${buffer.toString('base64')}`;
        }
        const refUrl = ensureDataUrl(refB64!);

        if (groqKey) {
            masterPrompt = await callGroqRefine(groqKey, refUrl, refinementPrompt!);
        } else {
            masterPrompt = await callGeminiRefine(geminiKey!, refB64!, refinementPrompt!);
        }
    } else {
        // ── Initial composition mode ──
        const heroUrl = ensureDataUrl(heroImageBase64!);
        const sceneUrl = ensureDataUrl(sceneImageBase64!);

        if (groqKey) {
            masterPrompt = await callGroq(groqKey, heroUrl, sceneUrl, userPrompt!);
        } else {
            masterPrompt = await callGemini(geminiKey!, heroImageBase64!, sceneImageBase64!, userPrompt!);
        }
    }

    return apiSuccess({ masterPrompt });
}, { limitPerMin: 5 });

// ── Groq Vision API ──
async function callGroq(apiKey: string, heroUrl: string, sceneUrl: string, userPrompt?: string): Promise<string> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'meta-llama/llama-3.2-90b-vision-preview',
            messages: [
                { role: 'system', content: VISION_ORCHESTRATOR_SYSTEM_PROMPT },
                { role: 'user', content: [
                    { type: 'text', text: `Instructions: "${userPrompt}"` },
                    { type: 'image_url', image_url: { url: heroUrl } },
                    { type: 'image_url', image_url: { url: sceneUrl } },
                ] },
            ],
        }),
    });

    if (!response.ok) throw new Error(`Groq API error ${response.status}`);
    const data = await response.json();
    return data.choices[0]?.message?.content || 'No prompt generated';
}

// ── Gemini Fallback ──
async function callGemini(apiKey: string, heroB64: string, sceneB64: string, userPrompt: string): Promise<string> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const cleanBase64 = (b64: string) => {
        const match = b64.match(/^data:image\/(\w+);base64,(.+)$/);
        if (match) return { mimeType: `image/${match[1]}`, data: match[2] };
        return { mimeType: 'image/jpeg', data: b64 };
    };

    const hero = cleanBase64(heroB64);
    const scene = cleanBase64(sceneB64);

    const result = await model.generateContent([
        { text: VISION_ORCHESTRATOR_SYSTEM_PROMPT },
        { text: `Instructions: "${userPrompt}"` },
        { inlineData: { mimeType: hero.mimeType, data: hero.data } },
        { inlineData: { mimeType: scene.mimeType, data: scene.data } },
    ]);

    return result.response.text();
}

// ── Groq Refinement ──
async function callGroqRefine(apiKey: string, refUrl: string, refinementPrompt: string): Promise<string> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'meta-llama/llama-3.2-90b-vision-preview',
            messages: [
                { role: 'system', content: REFINEMENT_SYSTEM_PROMPT },
                { role: 'user', content: [
                    { type: 'text', text: `Refinement request: "${refinementPrompt}"` },
                    { type: 'image_url', image_url: { url: refUrl } },
                ] },
            ],
        }),
    });

    if (!response.ok) throw new Error(`Groq API error ${response.status}`);
    const data = await response.json();
    return data.choices[0]?.message?.content || 'No prompt generated';
}

// ── Gemini Refinement ──
async function callGeminiRefine(apiKey: string, refB64: string, refinementPrompt: string): Promise<string> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const cleanBase64 = (b64: string) => {
        const match = b64.match(/^data:image\/(\w+);base64,(.+)$/);
        if (match) return { mimeType: `image/${match[1]}`, data: match[2] };
        return { mimeType: 'image/jpeg', data: b64 };
    };

    const ref = cleanBase64(refB64);

    const result = await model.generateContent([
        { text: REFINEMENT_SYSTEM_PROMPT },
        { text: `Refinement request: "${refinementPrompt}"` },
        { inlineData: { mimeType: ref.mimeType, data: ref.data } },
    ]);

    return result.response.text();
}

