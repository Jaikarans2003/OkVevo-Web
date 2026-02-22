import { NextRequest, NextResponse } from 'next/server';

/**
 * Product Shoots API Route — Photography Master Prompt Generation
 *
 * Analyzes a product image and shoot scenario to generate 4 professional
 * photography Master Prompts, each from a different perspective:
 *   1. Hero Shot — dramatic front-facing with professional lighting
 *   2. Detail/Macro — close-up texture and craftsmanship
 *   3. Lifestyle/Context — product in its natural scenario setting
 *   4. Artistic/Creative — creative composition with dramatic elements
 *
 * Uses Groq (primary) or Gemini (fallback) vision models.
 */

const PHOTOGRAPHY_SYSTEM_PROMPT = `You are an elite commercial product photographer with 20 years of experience shooting for brands like Apple, Rolex, and Nike. You specialize in creating stunning product photography that sells.

You will receive:
1. A product image — analyze its shape, material, texture, color, and surface properties
2. A shoot scenario description from the client

Your task: Generate exactly 4 distinct NANOBANANA PRO Master Prompts, each representing a different professional photography approach. Think like you're setting up 4 different shots in a real studio/location.

For EACH shot, you MUST specify:
- Exact camera angle (e.g., "15° low angle, slightly left of center")
- Lens/focal length (e.g., "85mm f/1.4", "100mm macro")
- Lighting setup (key light, fill light, rim light, practicals — direction, intensity, color temperature)
- Depth of field and focus point
- Background/environment details matching the scenario
- Color grading and mood
- Any props or environmental elements

The 4 shots must be:

SHOT 1 — HERO SHOT: The money shot. Front-facing or 3/4 angle. Dramatic three-point lighting setup. The product is the absolute star. Slight low angle to make it feel powerful and aspirational. Sharp focus on the product with tasteful background blur.

SHOT 2 — DETAIL/MACRO: Intimate close-up revealing texture, craftsmanship, and material quality. Shallow depth of field (f/2.8 or wider). Directional side lighting to emphasize surface texture and create micro-shadows. Show what makes this product premium.

SHOT 3 — LIFESTYLE/CONTEXT: The product in its natural habitat, matching the shoot scenario. Environmental portrait style. Product is prominent but the setting tells a story. Natural or mixed lighting. Wider focal length (35-50mm). The viewer should feel the atmosphere.

SHOT 4 — ARTISTIC/CREATIVE: A bold, editorial-style composition. Play with dramatic shadows, reflections, unusual angles (top-down or extreme low), or creative lighting (colored gels, hard shadows, light painting). This shot should stop someone mid-scroll.

CRITICAL RULES:
- Output ONLY valid JSON, no markdown, no code fences, no explanation
- Each prompt must be a single cohesive paragraph that fully describes the image to generate
- Include the product in every shot — describe it based on what you see in the image
- Match the scenario/environment the client described
- Every prompt must result in a photorealistic, high-end commercial photograph

Output format (STRICT JSON, nothing else):
[
  { "name": "Hero Shot", "masterPrompt": "..." },
  { "name": "Detail Close-Up", "masterPrompt": "..." },
  { "name": "Lifestyle Context", "masterPrompt": "..." },
  { "name": "Artistic Creative", "masterPrompt": "..." }
]`;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { productImageBase64, shootScenario } = body;

        if (!productImageBase64 || !shootScenario) {
            return NextResponse.json(
                { success: false, error: 'productImageBase64 and shootScenario are required' },
                { status: 400 }
            );
        }

        const groqKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

        if (!groqKey && !geminiKey) {
            return NextResponse.json(
                { success: false, error: 'No AI API key configured (Groq or Gemini)' },
                { status: 500 }
            );
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

        // Parse the JSON response
        let shots;
        try {
            // Strip any markdown code fences if present
            const cleaned = rawResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            shots = JSON.parse(cleaned);
        } catch {
            console.error('Failed to parse photography prompts JSON:', rawResponse);
            return NextResponse.json(
                { success: false, error: 'Failed to parse photography prompts from AI response' },
                { status: 500 }
            );
        }

        console.log(`✅ Photography Orchestrator: Generated ${shots.length} shot prompts`);

        return NextResponse.json({
            success: true,
            shots,
        });

    } catch (error) {
        console.error('Product Shoots API error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            },
            { status: 500 }
        );
    }
}

// ── Groq Vision API ─────────────────────────────────────────────
async function callGroqPhotography(apiKey: string, productUrl: string, scenario: string): Promise<string> {
    const MAX_RETRIES = 3;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (attempt > 0) {
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`⏳ Rate limited — retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`);
                await new Promise(r => setTimeout(r, delay));
            }

            console.log('📸 Using Groq for Photography Prompt Generation...');

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
                    messages: [
                        {
                            role: 'system',
                            content: PHOTOGRAPHY_SYSTEM_PROMPT,
                        },
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: `Shoot Scenario: "${scenario}"` },
                                { type: 'text', text: 'Here is the product to photograph:' },
                                { type: 'image_url', image_url: { url: productUrl } },
                                { type: 'text', text: 'Analyze this product carefully and generate the 4 photography Master Prompts as specified. Output ONLY the JSON array.' },
                            ],
                        },
                    ],
                    max_tokens: 3000,
                    temperature: 0.8,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errMsg = JSON.stringify(errorData);
                if (response.status === 429) {
                    throw new Error(`429: ${errMsg}`);
                }
                throw new Error(`Groq API error ${response.status}: ${errMsg}`);
            }

            const data = await response.json();
            return data.choices[0]?.message?.content || '[]';

        } catch (err) {
            lastError = err;
            const errMsg = err instanceof Error ? err.message : String(err);
            if (!errMsg.includes('429')) throw err;
        }
    }
    throw lastError || new Error('Rate limit exceeded after retries');
}

// ── Gemini Fallback ─────────────────────────────────────────────
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

    const MAX_RETRIES = 3;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (attempt > 0) {
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`⏳ Rate limited — retrying in ${delay / 1000}s...`);
                await new Promise(r => setTimeout(r, delay));
            }

            const result = await model.generateContent([
                { text: PHOTOGRAPHY_SYSTEM_PROMPT },
                { text: `Shoot Scenario: "${scenario}"` },
                { text: 'Here is the product to photograph:' },
                { inlineData: { mimeType: product.mimeType, data: product.data } },
                { text: 'Analyze this product carefully and generate the 4 photography Master Prompts as specified. Output ONLY the JSON array.' },
            ]);

            return result.response.text();
        } catch (err) {
            lastError = err;
            const errMsg = err instanceof Error ? err.message : String(err);
            if (!errMsg.includes('429') && !errMsg.includes('Too Many Requests')) throw err;
        }
    }
    throw lastError || new Error('Gemini rate limit exceeded after retries');
}
