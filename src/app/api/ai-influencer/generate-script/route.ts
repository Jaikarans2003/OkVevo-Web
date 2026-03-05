import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * AI Influencer Script Generation API Route
 *
 * Accepts a user's raw script and transforms it into a polished
 * explainer/narrative script calibrated to the target duration.
 * Falls back to topic-based generation if no raw script is provided.
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

        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY not configured');
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const targetWordCount = Math.floor(duration * 2.5);
        const isRawScript = Boolean(script?.trim());

        const prompt = isRawScript
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

        console.log('📝 Generating explainer script with Gemini...');
        console.log(`   Mode: ${isRawScript ? 'RAW SCRIPT TRANSFORM' : 'TOPIC GENERATION'}`);
        console.log(`   Duration: ${duration}s (~${targetWordCount} words)`);
        console.log(`   Input length: ${inputSource.length} chars`);

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let scriptText = response.text();

        if (!scriptText || scriptText.trim().length === 0) {
            throw new Error('Gemini did not return script text');
        }

        scriptText = scriptText.trim();
        const wordCount = scriptText.split(/\s+/).length;
        console.log(`✅ Script generated: ${scriptText.length} chars, ~${wordCount} words`);

        return NextResponse.json({
            success: true,
            script: scriptText,
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
