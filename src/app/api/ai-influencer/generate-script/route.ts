import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

/**
 * AI Influencer Script Generation API Route (Phase 1)
 *
 * Uses Groq to analyze and generate script, then Gemini to extract visual moments.
 * Returns both script and moments for user to edit and confirm.
 *
 * POST /api/ai-influencer/generate-script
 * Body: { script?: string, topic?: string, duration: 15 | 30 }
 */

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { script, topic, duration } = body;

        const inputSource = script?.trim() || topic?.trim();

        if (!inputSource || !duration) {
            return NextResponse.json(
                { error: 'Missing required fields: (script or topic), duration' },
                { status: 400 }
            );
        }

        if (![15, 30].includes(duration)) {
            return NextResponse.json(
                { error: 'Duration must be 15 or 30 seconds' },
                { status: 400 }
            );
        }

        // Step 1: Generate Script with Groq
        const groqApiKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;
        if (!groqApiKey) {
            console.error('GROQ_API_KEY not configured');
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            );
        }

        const groq = new Groq({ apiKey: groqApiKey });
        const targetWordCount = Math.floor(duration * 2.5);
        const isRawScript = Boolean(script?.trim());

        const scriptPrompt = isRawScript
            ? `You are an expert scriptwriter for short-form video content.

The user has provided their raw script below. Your task is to analyze it, extract the core message, and transform it into a polished, professional ${duration}-second explainer/narrator script.

USER'S RAW SCRIPT:
"""
${inputSource}
"""

Requirements for the output script:
- Duration: exactly ${duration} seconds when read aloud at a natural pace
- Target word count: approximately ${targetWordCount} words (at ~150 words/min speaking pace)
- Tone: Professional, engaging, clear — like a confident TV narrator
- Structure: Hook (first 2-3 seconds) → Core message → Punchy conclusion
- Language: Conversational spoken English — no bullet points, no headers, no stage directions
- Preserve the key information from the original script but make it flow naturally
- Do NOT include any directions like "[pause]" or "(music)" — just pure narration text

Output ONLY the final narration script text. No explanations, no labels, no formatting.`
            : `Generate a compelling ${duration}-second explainer video script about "${inputSource}".

Requirements:
- Duration: ${duration} seconds
- Word count: approximately ${targetWordCount} words
- Tone: Professional, engaging, informative
- Structure: Hook → Problem → Solution → Call to Action
- Natural spoken language, not written text
- Suitable for a talking-head video format

Output only the narration text. No formatting, no sections, just the script.`;

        console.log('📝 Generating explainer script with Groq...');
        console.log(`   Mode: ${isRawScript ? 'RAW SCRIPT TRANSFORM' : 'TOPIC GENERATION'}`);
        console.log(`   Duration: ${duration}s (~${targetWordCount} words)`);
        console.log(`   Input length: ${inputSource.length} chars`);

        const scriptChat = await groq.chat.completions.create({
            messages: [{ role: 'user', content: scriptPrompt }],
            model: 'llama-3.3-70b-versatile',
        });

        let scriptText = scriptChat.choices[0]?.message?.content?.trim();
        if (!scriptText || scriptText.length === 0) {
            throw new Error('Groq did not return script text');
        }

        const wordCount = scriptText.split(/\s+/).length;
        console.log(`✅ Script generated: ${scriptText.length} chars, ~${wordCount} words`);

        // Step 2: Extract Visual Moments with Gemini
        const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
            console.error('GEMINI_API_KEY not configured');
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const momentsPrompt = `Given this ${duration}-second video script, extract 3-4 key visual moments that should be illustrated with images.

SCRIPT:
"""
${scriptText}
"""

For each moment, provide:
1. start: Start time in seconds (number)
2. end: End time in seconds (number)
3. topic: Brief description of the moment (string)
4. prompt: Detailed image generation prompt for that moment (string)

Output ONLY a JSON array in this exact format:
[
  { "start": 0, "end": 5, "topic": "Opening hook", "prompt": "detailed image prompt here" },
  { "start": 5, "end": 10, "topic": "Main point", "prompt": "detailed image prompt here" }
]

No other text, just the JSON array.`;

        console.log('🖼️ Extracting visual moments with Gemini...');
        const momentsResult = await geminiModel.generateContent(momentsPrompt);
        const momentsResponse = await momentsResult.response;
        let momentsText = momentsResponse.text().trim();

        // Clean up JSON response
        if (momentsText.startsWith('```json')) {
            momentsText = momentsText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (momentsText.startsWith('```')) {
            momentsText = momentsText.replace(/```\n?/g, '');
        }

        let moments = [];
        try {
            moments = JSON.parse(momentsText);
            if (!Array.isArray(moments)) {
                throw new Error('Moments is not an array');
            }
            console.log(`✅ Extracted ${moments.length} visual moments`);
        } catch (e) {
            console.error('Failed to parse moments JSON:', e);
            console.error('Raw response:', momentsText);
            // Fallback: create basic moments
            moments = [
                { start: 0, end: duration / 3, topic: 'Opening', prompt: scriptText.substring(0, 100) },
                { start: duration / 3, end: (duration * 2) / 3, topic: 'Middle', prompt: scriptText.substring(100, 200) },
                { start: (duration * 2) / 3, end: duration, topic: 'Closing', prompt: scriptText.substring(200, 300) },
            ];
        }

        return NextResponse.json({
            success: true,
            script: scriptText,
            moments,
            wordCount,
            characterCount: scriptText.length,
            mode: isRawScript ? 'script-transform' : 'topic-generation',
        });

    } catch (error: any) {
        console.error('❌ Script generation error:', error);
        return NextResponse.json(
            {
                error: 'Failed to generate script',
                details: error.message,
            },
            { status: 500 }
        );
    }
}
