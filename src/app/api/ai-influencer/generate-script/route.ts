import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * AI Influencer Script Generation API Route
 * 
 * Generates an explainer script using Gemini API based on topic and duration.
 * 
 * POST /api/ai-influencer/generate-script
 */

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { topic, duration } = body;

        if (!topic || !duration) {
            return NextResponse.json(
                { error: 'Missing required fields: topic, duration' },
                { status: 400 }
            );
        }

        if (![15, 30].includes(duration)) {
            return NextResponse.json(
                { error: 'Duration must be 15 or 30 seconds' },
                { status: 400 }
            );
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY not configured');
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

        const wordCount = Math.floor(duration * 2.5);

        const prompt = `Generate a compelling ${duration}-second explainer video script about "${topic}".

Requirements:
- Duration: ${duration} seconds
- Word count: approximately ${wordCount} words
- Tone: Professional, engaging, informative
- Perspective: Narrator/Explainer (third-person or educational)
- Structure: Hook (10%) → Problem (20%) → Solution (50%) → Call to Action (20%)
- The script should be natural spoken language, not written text
- Include brief pauses for visual transitions
- Make it suitable for a talking-head video format

Output only the narration text that will be spoken. No formatting, no sections, just the script text.`;

        console.log('📝 Generating script with Gemini...');
        console.log(`   Topic: "${topic}"`);
        console.log(`   Duration: ${duration}s (~${wordCount} words)`);

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let scriptText = response.text();

        if (!scriptText || scriptText.trim().length === 0) {
            throw new Error('Gemini did not return script text');
        }

        scriptText = scriptText.trim();
        console.log(`✅ Script generated: ${scriptText.length} chars, ~${scriptText.split(/\s+/).length} words`);

        return NextResponse.json({
            success: true,
            script: scriptText,
            wordCount: scriptText.split(/\s+/).length,
            characterCount: scriptText.length
        });

    } catch (error: any) {
        console.error('❌ Script generation error:', error);
        return NextResponse.json(
            { 
                error: 'Failed to generate script',
                details: error.message 
            },
            { status: 500 }
        );
    }
}
