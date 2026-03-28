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
        const { script, topic, duration, ttsPacing } = body;

        const inputSource = script?.trim() || topic?.trim();

        if (!inputSource || !duration) {
            return NextResponse.json(
                { error: 'Missing required fields: (script or topic), duration' },
                { status: 400 }
            );
        }

        if (![15, 30, 60].includes(duration)) {
            return NextResponse.json(
                { error: 'Duration must be 15, 30, or 60 seconds' },
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

        const isFast = ttsPacing === 'fast';
        let minWords = 0;
        let maxWords = 0;
        let momentsCount = 0;
        let minDuration = 0;

        // Tone & Formatting Instructions
        const toneInstructions = isFast
            ? "High-energy, confident, punchy, and aggressive pacing. Hook-heavy delivery."
            : "Slower, deliberate speech with emotional depth, steady and profound delivery. Still uses full, rich sentences.";

        const formattingInstructions = isFast
            ? "Keep sentences punchy and continuous. Moderate pauses (not too many or you kill energy). Do not add excessive line breaks."
            : "Use occasional ellipses (...) for dramatic pauses, but do NOT replace actual content with ellipses. Each sentence must be a complete, meaningful thought. The pauses are between sentences, not instead of words.";

        if (duration === 15) {
            minDuration = 10;
            minWords = isFast ? 55 : 38;
            maxWords = isFast ? 63 : 48;
            momentsCount = 3;
        } else if (duration === 30) {
            minDuration = 25;
            minWords = isFast ? 120 : 80;
            maxWords = isFast ? 138 : 98;
            momentsCount = 5;
        } else if (duration === 60) {
            minDuration = 55;
            minWords = isFast ? 210 : 160;
            maxWords = isFast ? 228 : 183;
            momentsCount = 8;
        } else {
            // Fallback just in case
            minDuration = Math.max(0, duration - 5);
            minWords = Math.floor(duration * 2.0);
            maxWords = Math.floor(duration * 2.5);
            momentsCount = 3;
        }

        const isRawScript = Boolean(script?.trim());

        const buildPrompt = (retryInfo?: { prevWordCount: number }) => {
            const retryWarning = retryInfo
                ? `\n\n⚠️ CRITICAL: Your previous attempt only had ${retryInfo.prevWordCount} words, which is UNACCEPTABLE. The MINIMUM is ${minWords} words. You MUST write more content this time. Expand on the ideas, add descriptive details, use richer language. Do NOT use ellipses as a substitute for actual words.\n`
                : '';

            const baseRequirements = `
Requirements for the output script:
${retryWarning}
- Duration Target: MUST take strictly between ${minDuration} and ${duration} seconds to read aloud at a natural speaking pace (~2.5 words/second).
- ⚠️ MANDATORY WORD COUNT: The script MUST contain between ${minWords} and ${maxWords} words. This is NON-NEGOTIABLE.
  * Count every word carefully before outputting.
  * Scripts with fewer than ${minWords} words will be REJECTED.
  * Do NOT pad with filler — use substantive, meaningful content.
  * Ellipses (...) do NOT count as words. You must have ${minWords}+ actual spoken words.
- Tone: ${toneInstructions}
- Pacing & Formatting: ${formattingInstructions}
- Language: Conversational spoken English. No bullet points, no headers, no stage directions like "[pause]" or "(music)". Only the spoken text.
- IMPORTANT: Write COMPLETE, FULL sentences. Do not use sentence fragments or single-word phrases separated by ellipses. Each line should be a proper sentence with subject and verb.
`;

            if (isRawScript) {
                return `You are an expert scriptwriter for short-form video content.

The user has provided their raw script below. Your task is to analyze it, extract the core message, and transform it into a polished, professional ${duration}-second narrator script.

USER'S RAW SCRIPT:
"""
${inputSource}
"""
${baseRequirements}
- Structure: Hook (first 2-3 seconds) → Core message → Conclusion
- Preserve the key information from the original script but EXPAND it into full, rich narration.
- Do NOT just summarize — flesh out the ideas with vivid descriptions and complete thoughts.

REMEMBER: You MUST write at least ${minWords} words of actual spoken content. Count your words before submitting.

Output ONLY the final narration script text. No explanations, no labels.`;
            } else {
                return `Generate a compelling ${duration}-second video script about "${inputSource}".
${baseRequirements}
- Structure: Hook → Problem → Solution → Call to Action

REMEMBER: You MUST write at least ${minWords} words of actual spoken content. Count your words before submitting.

Output ONLY the final narration script text. No explanations, no labels.`;
            }
        };

        console.log('📝 Generating explainer script with Groq...');
        console.log(`   Mode: ${isRawScript ? 'RAW SCRIPT TRANSFORM' : 'TOPIC GENERATION'}`);
        console.log(`   Duration: ${duration}s (Target: ${minWords}-${maxWords} words)`);
        console.log(`   TTS Pacing: ${ttsPacing || 'calm'}`);
        console.log(`   Input length: ${inputSource.length} chars`);

        const MAX_RETRIES = 3;
        let scriptText = '';
        let wordCount = 0;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            const prompt = attempt === 1
                ? buildPrompt()
                : buildPrompt({ prevWordCount: wordCount });

            console.log(`   Attempt ${attempt}/${MAX_RETRIES}...`);

            const scriptChat = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama-3.3-70b-versatile',
                temperature: attempt > 1 ? 0.8 : 0.7,  // Slightly higher temp on retries
            });

            scriptText = scriptChat.choices[0]?.message?.content?.trim() || '';
            if (!scriptText || scriptText.length === 0) {
                if (attempt === MAX_RETRIES) throw new Error('Groq did not return script text');
                console.warn(`   ⚠️ Empty response on attempt ${attempt}, retrying...`);
                continue;
            }

            // Count only actual words (not ellipses or standalone punctuation)
            wordCount = scriptText
                .replace(/\.{2,}/g, ' ')   // Remove ellipses
                .replace(/[—–-]{2,}/g, ' ') // Remove em-dashes
                .split(/\s+/)
                .filter(w => w.length > 0 && !/^[.…,;:!?]+$/.test(w))
                .length;

            console.log(`   Attempt ${attempt}: ${scriptText.length} chars, ~${wordCount} actual words`);

            if (wordCount >= minWords) {
                console.log(`✅ Script meets word count requirement (${wordCount} >= ${minWords})`);
                break;
            }

            if (attempt < MAX_RETRIES) {
                console.warn(`   ⚠️ Script too short (${wordCount} < ${minWords}), retrying...`);
            } else {
                console.warn(`   ⚠️ Script still short after ${MAX_RETRIES} attempts (${wordCount} words). Proceeding anyway.`);
            }
        }

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

        const momentsPrompt = `Given this ${duration}-second video script, extract exactly ${momentsCount} key visual moments that should be illustrated with images.

SCRIPT:
"""
${scriptText}
"""

For each moment, provide:
1. start: Start time in seconds (number)
2. end: End time in seconds (number)
3. topic: Brief description of the moment (string)
4. prompt: Detailed image generation prompt for that moment (string)

Output ONLY a JSON array with exactly ${momentsCount} objects in this exact format:
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
