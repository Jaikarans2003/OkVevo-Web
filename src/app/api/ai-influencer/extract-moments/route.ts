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

        // Number of images: 3 for 15s, 5 for 30s (one per ~5s segment)
        const momentCount = duration === 15 ? 3 : 5;
        const segmentLength = duration / momentCount;  // e.g. 5s per segment

        // Each image shows for MAX 2 seconds, centred in its speech segment
        const MAX_IMG_DURATION = 2;

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: { responseMimeType: 'application/json' }
        });

        // Build segment descriptions so Gemini knows the speech windows
        const segmentDescriptions = Array.from({ length: momentCount }, (_, i) => {
            const segStart = +(i * segmentLength).toFixed(2);
            const segEnd = +(Math.min((i + 1) * segmentLength, duration)).toFixed(2);
            return `Segment ${i + 1}: ${segStart}s–${segEnd}s`;
        }).join('\n');

        const prompt = `You are a visual content director for a short explainer video.

Analyze this ${duration}-second script and extract exactly ${momentCount} key visual moments — one per speech segment below.

Script:
"""
${script}
"""

Speech segments:
${segmentDescriptions}

For each segment, pick the SINGLE most visually impactful moment and write a cinematic image prompt.
The image should appear for exactly 1.5 seconds, starting at the point within the segment where the speech most closely matches the visual.

Rules:
- One moment per segment — use the segment boundaries above, do NOT overlap segments
- "start" and "end" must be within the segment's range, and end - start = 1.5 (exactly)
- Mark 1 moment as "fullscreen" (the most dramatic/important visual); all others are "split"
- Prompts must be 15-25 words, highly cinematic and specific
- Do NOT include people or faces — focus on environments, objects, data visualisations, technology

Return a JSON array ONLY (no markdown fences):
[
  {
    "time": "<start>-<end>s",
    "start": <number>,
    "end": <number>,
    "topic": "<3-5 word label>",
    "prompt": "Cinematic [subject], [visual details], ultra-realistic, dramatic lighting, 8K",
    "layout": "split"
  }
]`;

        console.log(`🎬 Extracting ${momentCount} visual moments (max ${MAX_IMG_DURATION}s each) from ${duration}s script...`);

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        let moments: ImageMoment[];
        try {
            moments = JSON.parse(text);
        } catch {
            const match = text.match(/\[[\s\S]*\]/);
            if (!match) throw new Error('Failed to parse visual moments from Gemini response');
            moments = JSON.parse(match[0]);
        }

        if (!Array.isArray(moments) || moments.length === 0) {
            throw new Error('Invalid moments response from Gemini');
        }

        // Post-process: clamp each moment to MAX_IMG_DURATION seconds, centred in its segment
        moments = moments.map((m, i) => {
            const segStart = i * segmentLength;
            const segEnd = Math.min((i + 1) * segmentLength, duration);
            const segMid = (segStart + segEnd) / 2;

            // Use model's start if it's within segment, otherwise use segment midpoint
            let start = (typeof m.start === 'number' && m.start >= segStart && m.start < segEnd)
                ? m.start : segMid - MAX_IMG_DURATION / 2;

            // Ensure the window fits within the segment and within video duration
            start = Math.max(segStart, Math.min(start, segEnd - MAX_IMG_DURATION));
            start = Math.max(0, start);
            const end = Math.min(start + MAX_IMG_DURATION, duration);

            return {
                ...m,
                start: +start.toFixed(2),
                end: +end.toFixed(2),
                time: `${start.toFixed(2)}-${end.toFixed(2)}s`,
            };
        });

        // Ensure exactly one fullscreen
        const hasFullscreen = moments.some(m => m.layout === 'fullscreen');
        if (!hasFullscreen) {
            moments[Math.floor(moments.length / 2)].layout = 'fullscreen';
        }

        console.log(`✅ Extracted ${moments.length} visual moments:`, moments.map(m => `${m.topic} [${m.start}s-${m.end}s]`));

        return NextResponse.json({ success: true, moments });

    } catch (error: any) {
        console.error('❌ Extract moments error:', error);
        return NextResponse.json(
            { error: 'Failed to extract moments', details: error.message },
            { status: 500 }
        );
    }
}
