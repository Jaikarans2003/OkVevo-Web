import { NextRequest, NextResponse } from 'next/server';

const VISION_ORCHESTRATOR_SYSTEM_PROMPT = `You are a Professional Product Photographer and Prompt Engineer. Your task is to analyze two input images: a Hero Product and a Scene Environment.

1. Identify the Primary Lighting Source (Direction, Intensity, Color Temperature) of the Scene.
2. Identify the Camera Perspective (Eye level, Low angle, Bokeh/Depth of Field).
3. Generate a technical NANOBANANA PRO Master Prompt that instructs the model to:
   - Place the [Hero Product] into the [Scene Environment] with matched global illumination.
   - Apply contact shadows and ambient occlusion where the product meets the surface.
   - Match the reflections on the product surface to the surrounding environment.
   - Ensure the focal length and grain of the product match the background scene for a 100% photorealistic composite.

Output ONLY the final Master Prompt as a single cohesive paragraph. Do not include any preamble, explanation, or numbered steps — just the prompt itself.`;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { heroImageBase64, sceneImageBase64 } = body;

        if (!heroImageBase64 || !sceneImageBase64) {
            return NextResponse.json(
                { success: false, error: 'Both heroImageBase64 and sceneImageBase64 are required' },
                { status: 400 }
            );
        }

        // ── Try Groq first (vision-capable, generous free tier) ──
        const groqKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
        // ── Fallback to Gemini ──
        const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

        if (!groqKey && !geminiKey) {
            return NextResponse.json(
                { success: false, error: 'No AI API key configured (Groq or Gemini)' },
                { status: 500 }
            );
        }

        // Ensure base64 images have proper data URL prefix
        const ensureDataUrl = (b64: string) => {
            if (b64.startsWith('data:')) return b64;
            return `data:image/jpeg;base64,${b64}`;
        };

        const heroUrl = ensureDataUrl(heroImageBase64);
        const sceneUrl = ensureDataUrl(sceneImageBase64);

        console.log('🔬 Vision Orchestrator: Analyzing hero product + scene environment...');

        let masterPrompt: string;

        if (groqKey) {
            masterPrompt = await callGroq(groqKey, heroUrl, sceneUrl);
        } else {
            masterPrompt = await callGemini(geminiKey!, heroImageBase64, sceneImageBase64);
        }

        console.log('✅ Vision Orchestrator: Master prompt generated successfully');

        return NextResponse.json({
            success: true,
            masterPrompt,
        });

    } catch (error) {
        console.error('Vision Orchestrator error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
            },
            { status: 500 }
        );
    }
}

// ── Groq Vision API (OpenAI-compatible) ─────────────────────────
async function callGroq(apiKey: string, heroUrl: string, sceneUrl: string): Promise<string> {
    const MAX_RETRIES = 3;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (attempt > 0) {
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`⏳ Rate limited — retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`);
                await new Promise(r => setTimeout(r, delay));
            }

            console.log('🔬 Using Groq (meta-llama/llama-4-scout-17b-16e-instruct)...');

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
                            content: VISION_ORCHESTRATOR_SYSTEM_PROMPT,
                        },
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: 'Image 1 — The Hero Product:' },
                                { type: 'image_url', image_url: { url: heroUrl } },
                                { type: 'text', text: 'Image 2 — The Scene / Ambience:' },
                                { type: 'image_url', image_url: { url: sceneUrl } },
                                { type: 'text', text: 'Now analyze both images and generate the NANOBANANA PRO Master Prompt.' },
                            ],
                        },
                    ],
                    max_tokens: 1024,
                    temperature: 0.7,
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
            return data.choices[0]?.message?.content || 'No prompt generated';

        } catch (err) {
            lastError = err;
            const errMsg = err instanceof Error ? err.message : String(err);
            if (!errMsg.includes('429')) throw err;
        }
    }
    throw lastError || new Error('Rate limit exceeded after retries');
}

// ── Gemini Fallback ─────────────────────────────────────────────
async function callGemini(apiKey: string, heroB64: string, sceneB64: string): Promise<string> {
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
                { text: VISION_ORCHESTRATOR_SYSTEM_PROMPT },
                { text: 'Image 1 — The Hero Product:' },
                { inlineData: { mimeType: hero.mimeType, data: hero.data } },
                { text: 'Image 2 — The Scene / Ambience:' },
                { inlineData: { mimeType: scene.mimeType, data: scene.data } },
                { text: 'Now analyze both images and generate the NANOBANANA PRO Master Prompt.' },
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
