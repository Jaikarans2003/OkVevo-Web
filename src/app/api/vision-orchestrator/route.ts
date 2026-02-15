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

const REFINEMENT_SYSTEM_PROMPT = `You are a Professional Product Photographer and Prompt Engineer. You are given an existing AI-generated composite image and a user's refinement request.

Your task is to:
1. Analyze the current composite image — identify the product, scene, lighting, camera angle, and overall composition.
2. Understand the user's requested changes (e.g. lighting adjustments, repositioning, style changes).
3. Generate an updated NANOBANANA PRO Master Prompt that reproduces the existing composite but with the user's requested modifications applied.

The new Master Prompt must be self-contained — it should fully describe the desired output image including all original details plus the requested changes.

Output ONLY the final Master Prompt as a single cohesive paragraph. Do not include any preamble, explanation, or numbered steps — just the prompt itself.`;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { heroImageBase64, sceneImageBase64, userPrompt, referenceImageBase64, referenceImageUrl, refinementPrompt } = body;

        // ── Determine mode: initial composition vs. refinement ──
        const isRefinement = (!!referenceImageBase64 || !!referenceImageUrl) && !!refinementPrompt;

        if (!isRefinement && (!heroImageBase64 || !sceneImageBase64)) {
            return NextResponse.json(
                { success: false, error: 'Provide hero+scene images for initial composition, or referenceImage+refinementPrompt for refinement' },
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

        let masterPrompt: string;

        if (isRefinement) {
            // ── Refinement mode: single reference image + change request ──
            console.log('🔄 Vision Orchestrator [REFINEMENT]: Processing change request...');
            console.log('📝 Refinement request:', refinementPrompt);

            // Get reference image as base64 — fetch from URL server-side if needed
            let refB64 = referenceImageBase64;
            if (!refB64 && referenceImageUrl) {
                console.log('🔄 Fetching reference image from URL (server-side)...');
                const imgRes = await fetch(referenceImageUrl);
                const buffer = Buffer.from(await imgRes.arrayBuffer());
                const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
                refB64 = `data:${contentType};base64,${buffer.toString('base64')}`;
            }

            const refUrl = ensureDataUrl(refB64);

            if (groqKey) {
                masterPrompt = await callGroqRefine(groqKey, refUrl, refinementPrompt);
            } else {
                masterPrompt = await callGeminiRefine(geminiKey!, refB64, refinementPrompt);
            }
        } else {
            // ── Initial composition mode: hero + scene ──
            console.log('🔬 Vision Orchestrator: Analyzing hero product + scene environment...');

            const heroUrl = ensureDataUrl(heroImageBase64);
            const sceneUrl = ensureDataUrl(sceneImageBase64);

            if (groqKey) {
                masterPrompt = await callGroq(groqKey, heroUrl, sceneUrl, userPrompt);
            } else {
                masterPrompt = await callGemini(geminiKey!, heroImageBase64, sceneImageBase64, userPrompt);
            }
        }

        console.log('✅ Vision Orchestrator: Master prompt generated successfully');
        console.log('📝 Master Prompt:\n', masterPrompt);

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
async function callGroq(apiKey: string, heroUrl: string, sceneUrl: string, userPrompt?: string): Promise<string> {
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
                                ...(userPrompt ? [{ type: 'text' as const, text: `The user has provided these placement instructions: "${userPrompt}". Incorporate these instructions into the Master Prompt.` }] : []),
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
async function callGemini(apiKey: string, heroB64: string, sceneB64: string, userPrompt?: string): Promise<string> {
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
                ...(userPrompt ? [{ text: `The user has provided these placement instructions: "${userPrompt}". Incorporate these instructions into the Master Prompt.` }] : []),
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

// ── Groq Refinement (single image + change request) ─────────────
async function callGroqRefine(apiKey: string, refUrl: string, refinementPrompt: string): Promise<string> {
    const MAX_RETRIES = 3;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (attempt > 0) {
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`⏳ Rate limited — retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`);
                await new Promise(r => setTimeout(r, delay));
            }

            console.log('🔄 Using Groq [REFINEMENT] (meta-llama/llama-4-scout-17b-16e-instruct)...');

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
                            content: REFINEMENT_SYSTEM_PROMPT,
                        },
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: `The user wants the following changes: "${refinementPrompt}"` },
                                { type: 'text', text: 'Here is the current composite image:' },
                                { type: 'image_url', image_url: { url: refUrl } },
                                { type: 'text', text: 'Analyze the current image and generate an updated NANOBANANA PRO Master Prompt that incorporates the requested changes.' },
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

// ── Gemini Refinement (single image + change request) ───────────
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
                { text: REFINEMENT_SYSTEM_PROMPT },
                { text: `The user wants the following changes: "${refinementPrompt}"` },
                { text: 'Here is the current composite image:' },
                { inlineData: { mimeType: ref.mimeType, data: ref.data } },
                { text: 'Analyze the current image and generate an updated NANOBANANA PRO Master Prompt that incorporates the requested changes.' },
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
