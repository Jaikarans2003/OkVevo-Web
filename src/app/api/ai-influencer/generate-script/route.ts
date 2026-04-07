import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { z } from 'zod';

// Helper function to adjust moments with proper gaps
function adjustMomentsWithGaps(
    rawMoments: any[],
    duration: number,
    expectedCount: number,
    gapDuration: number
): any[] {
    if (!rawMoments || rawMoments.length === 0) {
        throw new Error('No moments provided');
    }
    
    // Sort by start time
    const sorted = rawMoments.sort((a, b) => a.start - b.start);
    
    // Adjust timestamps to ensure gaps
    const adjusted = [];
    let currentTime = 0;
    
    for (let i = 0; i < Math.min(sorted.length, expectedCount); i++) {
        const moment = sorted[i];
        const momentDuration = Math.min(
            Math.max(moment.end - moment.start, 2), // Min 2 seconds
            5 // Max 5 seconds per moment
        );
        
        // Ensure moment doesn't exceed video duration
        if (currentTime + momentDuration > duration) {
            break;
        }
        
        adjusted.push({
            start: currentTime,
            end: currentTime + momentDuration,
            topic: moment.topic || `Moment ${i + 1}`,
            prompt: moment.prompt || moment.topic
        });
        
        // Add gap for next moment
        currentTime += momentDuration + gapDuration;
    }
    
    return adjusted;
}

// Fallback generator for moments with gaps
function generateFallbackMomentsWithGaps(
    duration: number,
    momentsCount: number,
    gapDuration: number,
    scriptText: string
): any[] {
    const moments = [];
    const momentDuration = 3; // Default 3 seconds per moment
    let currentTime = 0;
    
    for (let i = 0; i < momentsCount; i++) {
        if (currentTime + momentDuration > duration) {
            break;
        }
        
        moments.push({
            start: currentTime,
            end: currentTime + momentDuration,
            topic: i === 0 ? 'Opening' : i === momentsCount - 1 ? 'Closing' : `Moment ${i + 1}`,
            prompt: scriptText.substring(i * 100, (i + 1) * 100) || 'Visual moment'
        });
        
        currentTime += momentDuration + gapDuration;
    }
    
    return moments;
}

const GenerateScriptSchema = z.object({
    script: z.string().nullish(),
    topic: z.string().nullish(),
    duration: z.number().refine(val => [15, 30, 60].includes(val), {
        message: "Duration must be 15, 30, or 60 seconds"
    }),
    ttsPacing: z.enum(['calm', 'fast']).nullish()
});

export const POST = apiHandler(async (request, ctx) => {
    const body = await request.json();
    const validation = GenerateScriptSchema.safeParse(body);
    
    if (!validation.success) {
        throw new Error(`Invalid fields: ${validation.error.issues.map(i => i.path.join('.') + ' ' + i.message).join(', ')}`);
    }

    const { script, topic, duration, ttsPacing } = validation.data;
    const inputSource = script?.trim() || topic?.trim();

    if (!inputSource) {
        throw new Error('Missing required field: script or topic');
    }

    // Step 1: Generate Script with Groq
    const groqApiKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;
    if (!groqApiKey) {
        throw new Error('Server configuration error: missing Groq key');
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
        minDuration = 13;
        minWords = isFast ? 45 : 34;
        maxWords = isFast ? 52 : 40;
        momentsCount = 3;
    } else if (duration === 30) {
        minDuration = 28;
        minWords = isFast ? 90 : 68;
        maxWords = isFast ? 105 : 82;
        momentsCount = 5;
    } else if (duration === 60) {
        minDuration = 57;
        minWords = isFast ? 120 : 92;
        maxWords = isFast ? 140 : 110;
        momentsCount = 8;
    }

    const isRawScript = Boolean(script?.trim());

    const buildPrompt = (retryInfo?: { prevWordCount: number }) => {
        const wps = isFast ? '3.0 to 3.5' : '2.3 to 2.8';
        const retryWarning = retryInfo
            ? `\n\n⚠️ CRITICAL: Your previous attempt only had ${retryInfo.prevWordCount} words, which is FAILING the requirement. The MUST-HAVE MINIMUM is ${minWords} words. You MUST write more content this time. Expand on the ideas, add vivid descriptive details, and use more sophisticated, complete sentences.\n`
            : '';

        const baseRequirements = `
Requirements for the output script:
${retryWarning}
- Duration Target: MUST take strictly between ${minDuration} and ${duration} seconds to read aloud.
- ⚠️ MANDATORY WORD COUNT: The script MUST contain between ${minWords} and ${maxWords} words. This is a HARD CONSTRAINT.
- Tone: ${toneInstructions}
- Pacing & Formatting: ${formattingInstructions}
- Language: Professional spoken English. Only the spoken narration.
`;

        if (isRawScript) {
            return `You are an elite scriptwriter. Transform the user's raw script provided below into a high-tier ${duration}-second narrator script.
USER'S RAW SCRIPT:
"""
${inputSource}
"""
${baseRequirements}
Output ONLY the final narration script text. No intro, no outbound fluff, no labels.`;
        } else {
            return `Create a high-tier, viral ${duration}-second video script about "${inputSource}".
${baseRequirements}
Output ONLY the final narration script text. No intro, no labels.`;
        }
    };

    const MAX_RETRIES = 4;
    let scriptText = '';
    let wordCount = 0;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const prompt = attempt === 1
            ? buildPrompt()
            : buildPrompt({ prevWordCount: wordCount });

        const scriptChat = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: attempt > 1 ? 0.85 : 0.7,
        });

        let rawOutput = scriptChat.choices[0]?.message?.content?.trim() || '';
        scriptText = rawOutput
            .replace(/^(here is|sure|here's|this is|okay|alright|below is|the following is|script for).*?:/gi, '')
            .replace(/^["']|["']$/g, '')
            .trim();

        if (!scriptText || scriptText.length === 0) {
            if (attempt === MAX_RETRIES) throw new Error('Groq did not return script text');
            continue;
        }

        wordCount = scriptText
            .replace(/\.{2,}/g, ' ')
            .replace(/[—–-]{2,}/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 0 && !/^[.…,;:!?]+$/.test(w))
            .length;

        if (wordCount >= minWords && wordCount <= maxWords + 5) {
            break;
        }
    }

    // Step 2: Extract Visual Moments with Gemini
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!geminiApiKey) {
        throw new Error('Server configuration error: missing Gemini key');
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const gapDuration = duration === 30 ? 3 : 2;

    const momentsPrompt = `Given this ${duration}-second video script, extract exactly ${momentsCount} key visual moments.

IMPORTANT: Leave ${gapDuration}-second gaps between visual moments for smooth transitions. Visual moments should NOT be continuous.

SCRIPT:
"""
${scriptText}
"""

Output ONLY a JSON array with exactly ${momentsCount} objects following this pattern:
- Each moment should have variable duration (2-5 seconds) based on content importance
- Leave ${gapDuration}-second gaps between moments
- Example format: [ { "start": 0, "end": 3, "topic": "Opening hook", "prompt": "detailed image prompt here" }, { "start": 5, "end": 8, "topic": "Next moment", "prompt": "..." } ]`;

    const momentsResult = await geminiModel.generateContent(momentsPrompt);
    const momentsResponse = await momentsResult.response;
    let momentsText = momentsResponse.text().trim();

    if (momentsText.startsWith('```json')) {
        momentsText = momentsText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (momentsText.startsWith('```')) {
        momentsText = momentsText.replace(/```\n?/g, '');
    }

    let moments = [];
    
    try {
        moments = JSON.parse(momentsText);
        
        // Validate and adjust moments to ensure proper gaps
        moments = adjustMomentsWithGaps(moments, duration, momentsCount, gapDuration);
        
    } catch (e) {
        // Fallback: Generate moments with proper gaps
        moments = generateFallbackMomentsWithGaps(duration, momentsCount, gapDuration, scriptText);
    }

    // Step 3: Analyze Script Mood with Gemini
    const moodPrompt = `Analyze the following video script and classify its overall mood/tone into EXACTLY ONE category.

SCRIPT:
"""
${scriptText}
"""

Categories:
- Chill: Relaxed, calm, laid-back tone
- Dramatic: Intense, emotional, high-stakes content
- Energetic: High-energy, exciting, fast-paced
- Funny: Humorous, comedic, lighthearted
- Happy: Positive, uplifting, joyful
- Suspense: Mysterious, tense, anticipation-building

Output ONLY the category name (one word). No explanation, no extra text.`;

    const moodResult = await geminiModel.generateContent(moodPrompt);
    const moodResponse = await moodResult.response;
    let moodText = moodResponse.text().trim();

    // Normalize and validate mood
    const validMoods = ['Chill', 'Dramatic', 'Energetic', 'Funny', 'Happy', 'Suspense'];
    let mood = validMoods.find(m => moodText.toLowerCase().includes(m.toLowerCase())) || 'Chill';

    console.log(`🎭 Script mood detected: ${mood}`);

    return apiSuccess({
        script: scriptText,
        moments,
        mood,
        wordCount,
        characterCount: scriptText.length,
        mode: isRawScript ? 'script-transform' : 'topic-generation',
    });
}, { limitPerMin: 10 }); // Layer 1 per-user limit as requested in section 3

