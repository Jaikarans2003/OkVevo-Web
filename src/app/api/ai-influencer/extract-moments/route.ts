import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * POST /api/ai-influencer/extract-moments
 *
 * Uses Gemini to extract visual moments from the generated script,
 * assign timestamps, and produce a cinematic image prompt for each.
 *
 * Body: { script: string, duration: 15 | 30 }
 * Returns: { moments: ImageMoment[] }
 */

export interface ImageMoment {
    time: string;    // e.g. "0-4"
    start: number;   // seconds
    end: number;     // seconds
    topic: string;   // short label
    prompt: string;  // cinematic image generation prompt
    layout: 'split' | 'fullscreen'; // split = default, fullscreen = high-emphasis
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { script, duration } = body;

        if (!script || !duration) {
            return NextResponse.json(
                { error: 'Missing required fields: script, duration' },
                { status: 400 }
            );
        }

        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
        }

        const momentCount = duration === 15 ? 3 : 6;
        // Build time windows (distribute evenly across duration)
        const segmentLength = Math.floor(duration / momentCount);

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: { responseMimeType: 'application/json' }
        });

        const timeWindows = Array.from({ length: momentCount }, (_, i) => {
            const start = i * segmentLength;
            const end = i === momentCount - 1 ? duration : (i + 1) * segmentLength;
            return `${start}-${end}s`;
        }).join(', ');

        const prompt = `You are a visual content director for a short explainer video.

Analyze this ${duration}-second script and extract exactly ${momentCount} key visual moments.

Script:
"""
${script}
"""

For each moment, identify the most visually compelling concept being described, and write a cinematic image generation prompt.

Time windows to use: ${timeWindows}

Rules:
- Assign one moment per time window
- Mark 1 moment as "fullscreen" (the most dramatic/important visual moment)
- All others are "split"
- Make prompts highly cinematic, descriptive, and specific
- Do NOT include people or faces in prompts — focus on environments, objects, data visualizations, technology
- Each prompt should be 15-25 words

Return JSON array ONLY:
[
  {
    "time": "0-${segmentLength}",
    "start": 0,
    "end": ${segmentLength},
    "topic": "short topic label (3-5 words)",
    "prompt": "Cinematic [subject], [visual details], ultra-realistic, dramatic lighting, 8K",
    "layout": "split"
  }
]`;

        console.log(`🎬 Extracting ${momentCount} visual moments from ${duration}s script...`);

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        let moments: ImageMoment[];
        try {
            moments = JSON.parse(text);
        } catch {
            // Try to extract JSON array from response if wrapped in markdown
            const match = text.match(/\[[\s\S]*\]/);
            if (!match) throw new Error('Failed to parse visual moments from Gemini response');
            moments = JSON.parse(match[0]);
        }

        if (!Array.isArray(moments) || moments.length === 0) {
            throw new Error('Invalid moments response from Gemini');
        }

        // Ensure exactly one fullscreen
        const hasFullscreen = moments.some(m => m.layout === 'fullscreen');
        if (!hasFullscreen) {
            moments[Math.floor(moments.length / 2)].layout = 'fullscreen';
        }

        console.log(`✅ Extracted ${moments.length} visual moments:`, moments.map(m => m.topic));

        return NextResponse.json({ success: true, moments });

    } catch (error: any) {
        console.error('❌ Extract moments error:', error);
        return NextResponse.json(
            { error: 'Failed to extract moments', details: error.message },
            { status: 500 }
        );
    }
}
