import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { z } from 'zod';

const ProductShootsSchema = z.object({
    productImageBase64: z.string().min(1),
    shootScenario: z.string().min(5),
});

const PHOTOGRAPHY_SYSTEM_PROMPT = `You are an elite commercial product photographer. Generate exactly 4 distinct NANOBANANA PRO Master Prompts.
SHOT 1 — HERO SHOT: The money shot.
SHOT 2 — DETAIL/MACRO: Intimate close-up.
SHOT 3 — LIFESTYLE/CONTEXT: Environmental portrait.
SHOT 4 — ARTISTIC/CREATIVE: Bold editorial style.
Output ONLY valid JSON: [ { "name": "Hero Shot", "masterPrompt": "..." } ]`;

export const POST = apiHandler(async (request, ctx) => {
    const body = await request.json();
    const validation = ProductShootsSchema.safeParse(body);
    
    if (!validation.success) {
        throw new Error(`Invalid request format: ${validation.error.issues.map(i => i.message).join(', ')}`);
    }

    const { productImageBase64, shootScenario } = validation.data;

    const groqKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!groqKey && !geminiKey) {
        throw new Error('No AI API key configured (Groq or Gemini)');
    }

    const ensureDataUrl = (b64: string) => {
        if (b64.startsWith('data:')) return b64;
        return `data:image/jpeg;base64,${b64}`;
    };

    let rawResponse: string;

    if (groqKey) {
        rawResponse = await callGroqPhotography(groqKey, ensureDataUrl(productImageBase64), shootScenario);
    } else {
        rawResponse = await callGeminiPhotography(geminiKey!, productImageBase64, shootScenario);
    }

    let shots;
    try {
        const cleaned = rawResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        shots = JSON.parse(cleaned);
    } catch {
        throw new Error('Failed to parse photography prompts from AI response');
    }

    return apiSuccess({ shots });
}, { limitPerMin: 5 });

async function callGroqPhotography(apiKey: string, productUrl: string, scenario: string): Promise<string> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'meta-llama/llama-3.2-90b-vision-preview',
            messages: [
                { role: 'system', content: PHOTOGRAPHY_SYSTEM_PROMPT },
                { role: 'user', content: [
                    { type: 'text', text: `Shoot Scenario: "${scenario}"` },
                    { type: 'image_url', image_url: { url: productUrl } },
                ] },
            ],
        }),
    });

    if (!response.ok) throw new Error(`Groq API error ${response.status}`);
    const data = await response.json();
    return data.choices[0]?.message?.content || '[]';
}

async function callGeminiPhotography(apiKey: string, productB64: string, scenario: string): Promise<string> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const cleanBase64 = (b64: string) => {
        const match = b64.match(/^data:image\/(\w+);base64,(.+)$/);
        if (match) return { mimeType: `image/${match[1]}`, data: match[2] };
        return { mimeType: 'image/jpeg', data: b64 };
    };

    const product = cleanBase64(productB64);

    const result = await model.generateContent([
        { text: PHOTOGRAPHY_SYSTEM_PROMPT },
        { text: `Shoot Scenario: "${scenario}"` },
        { inlineData: { mimeType: product.mimeType, data: product.data } },
    ]);

    return result.response.text();
}
