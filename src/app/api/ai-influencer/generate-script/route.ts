import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { z } from 'zod';

// Helper function to count words accurately
function countWords(text: string): number {
    return text
        .replace(/\.{2,}/g, ' ')      // Replace ellipses with space
        .replace(/[—–-]{2,}/g, ' ')   // Replace dashes with space
        .replace(/[^\w\s']/g, ' ')    // Remove punctuation except apostrophes
        .split(/\s+/)
        .filter(w => w.length > 0)
        .length;
}

// Helper function to truncate text to word limit at sentence boundaries
function truncateToWordLimit(text: string, maxWords: number): string {
    const words = text.split(/\s+/);
    if (words.length <= maxWords) return text;
    
    // Truncate to maxWords
    const truncated = words.slice(0, maxWords).join(' ');
    
    // Try to end at a sentence boundary
    const lastPeriod = truncated.lastIndexOf('.');
    const lastExclamation = truncated.lastIndexOf('!');
    const lastQuestion = truncated.lastIndexOf('?');
    
    const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
    
    // If we found a sentence ending in the last 20% of text, use it
    if (lastSentenceEnd > truncated.length * 0.8) {
        return truncated.substring(0, lastSentenceEnd + 1);
    }
    
    // Otherwise, just add ellipsis
    return truncated + '...';
}

// Helper function to sanitize prompts by replacing flagged words with safe alternatives
function sanitizePrompt(prompt: string): string {
    // Map of flagged words to safe contextual replacements
    const wordReplacements: Record<string, string> = {
        // Body parts -> Safe alternatives
        'hips': 'posture',
        'hip': 'posture',
        'curves': 'silhouette',
        'curve': 'silhouette',
        'curvy': 'graceful',
        'curvaceous': 'graceful',
        'thighs': 'lower body',
        'legs': 'lower body',
        'skin': 'complexion',
        'flesh': 'form',
        'body': 'figure',
        'belly': 'midsection',
        'stomach': 'midsection',
        'abdomen': 'midsection',
        'chest': 'torso',
        'bust': 'upper body',
        'breasts': 'upper body',
        'bosom': 'upper body',
        'cleavage': 'neckline',
        'waist': 'torso',
        'midriff': 'torso',
        
        // Suggestive descriptors -> Professional alternatives
        'tight': 'fitted',
        'revealing': 'stylish',
        'bare': 'minimal',
        'exposed': 'visible',
        'naked': 'natural',
        'nude': 'natural',
        'intimate': 'personal',
        'sensual': 'elegant',
        'sexy': 'attractive',
        'seductive': 'captivating',
        'provocative': 'bold',
        
        // Camera angles with body focus -> Safe alternatives
        'close-up of body': 'medium shot',
        'close-up body': 'medium shot',
        'body close-up': 'medium shot',
        'detailed body': 'full frame',
        'body detail': 'full frame',
        'body shot': 'full-body view'
    };
    
    let sanitized = prompt;
    
    // Replace flagged words with safe alternatives (case-insensitive)
    Object.entries(wordReplacements).forEach(([flagged, safe]) => {
        const regex = new RegExp(`\\b${flagged}\\b`, 'gi');
        sanitized = sanitized.replace(regex, safe);
    });
    
    // Clean up multiple spaces
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    return sanitized;
}

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
        
        // Sanitize the prompt to remove flagged words
        const originalPrompt = moment.prompt || moment.topic;
        const sanitizedPrompt = sanitizePrompt(originalPrompt);
        
        adjusted.push({
            start: currentTime,
            end: currentTime + momentDuration,
            topic: moment.topic || `Moment ${i + 1}`,
            prompt: sanitizedPrompt
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
    let targetWords = 0;
    let targetChars = 0;
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
        targetWords = isFast ? 116 : 92;
        targetChars = isFast ? 641 : 563;
        minWords = targetWords - 2;
        maxWords = targetWords + 2;
        momentsCount = 8;
    }

    const isRawScript = Boolean(script?.trim());

    const buildPrompt = (retryInfo?: { prevWordCount: number }) => {
        const wps = isFast ? '3.0 to 3.5' : '2.3 to 2.8';
        const retryWarning = retryInfo
            ? `\n\n⚠️ CRITICAL: Your previous attempt only had ${retryInfo.prevWordCount} words, which is FAILING the requirement. The MUST-HAVE MINIMUM is ${minWords} words. You MUST write more content this time. Expand on the ideas, add vivid descriptive details, and use more sophisticated, complete sentences.\n`
            : '';

        const strictLimitWarning = `
🚨 ABSOLUTE HARD LIMIT: Your script MUST NOT exceed ${maxWords} words.
- If you write ${maxWords + 1} words or more, your script will be REJECTED and TRUNCATED.
- Target range: ${minWords}-${maxWords} words
- Ideal target: ${Math.floor((minWords + maxWords) / 2)} words
- This is NON-NEGOTIABLE. Quality over quantity. Stay within limits.
`;

        const strictRequirements = duration === 60 && targetWords > 0
            ? `
${strictLimitWarning}
- ⚠️ STRICT TARGET: EXACTLY ${targetWords} words and ${targetChars} characters (±2 words tolerance).
- Duration Target: MUST take strictly between ${minDuration} and ${duration} seconds to read aloud.
`
            : `
${strictLimitWarning}
- Duration Target: MUST take strictly between ${minDuration} and ${duration} seconds to read aloud.
- ⚠️ MANDATORY WORD COUNT: The script MUST contain between ${minWords} and ${maxWords} words. This is a HARD CONSTRAINT.
`;

        const baseRequirements = `
Requirements for the output script:
${retryWarning}${strictRequirements}- Tone: ${toneInstructions}
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

        wordCount = countWords(scriptText);
        const charCount = scriptText.length;
        
        // Check if exceeds hard maximum - if so, retry or truncate
        if (wordCount > maxWords + 5) {
            console.warn(`⚠️ Attempt ${attempt}: ${wordCount} words exceeds limit (max: ${maxWords})`);
            if (attempt < MAX_RETRIES) {
                continue; // Retry with stricter prompt
            }
        }
        
        // For 60s videos, enforce strict word and character targets
        if (duration === 60 && targetWords > 0) {
            const wordInRange = wordCount >= minWords && wordCount <= maxWords;
            const charInRange = Math.abs(charCount - targetChars) <= 50; // ±50 chars tolerance
            
            if (wordInRange && charInRange) {
                console.log(`✅ 60s script meets strict targets: ${wordCount} words, ${charCount} chars`);
                break;
            } else if (attempt === MAX_RETRIES) {
                console.warn(`⚠️ Final attempt: ${wordCount} words (target: ${targetWords}), ${charCount} chars (target: ${targetChars})`);
                break;
            }
        } else {
            // For other durations, use word count only
            if (wordCount >= minWords && wordCount <= maxWords + 5) {
                break;
            }
        }
    }

    // Post-generation validation and truncation
    const originalWordCount = wordCount;
    let wasTruncated = false;
    
    if (wordCount > maxWords) {
        console.log(`🔪 Truncating script from ${wordCount} to ${maxWords} words`);
        scriptText = truncateToWordLimit(scriptText, maxWords);
        wordCount = countWords(scriptText);
        wasTruncated = true;
    }

    // Step 2: Extract Visual Moments with Groq (fallback to Gemini)
    const gapDuration = duration === 30 ? 3 : 2;

    const momentsPrompt = `Given this ${duration}-second video script, extract exactly ${momentsCount} key visual moments.

IMPORTANT: Leave ${gapDuration}-second gaps between visual moments for smooth transitions. Visual moments should NOT be continuous.

SCRIPT:
"""
${scriptText}
"""

CRITICAL SAFETY RULES FOR IMAGE PROMPTS:
- Prompts MUST be RELEVANT to the script content while being safe for AI image generation
- STAY CONTEXTUAL: Include key topics from the script (e.g., pregnancy, yoga, fitness, health, etc.)
- AVOID FLAGGED WORDS: Never use suggestive combinations like "close-up of hips", "tight clothing on body", "revealing curves", "bare skin", "intimate body parts"
- SAFE BODY REFERENCES: You CAN mention "pregnant woman", "belly", "back support", "posture" in medical/educational contexts
- CAMERA ANGLES: "close-up of face/expression" is OK, but avoid "close-up of body/hips/curves"
- FOCUS ON: Activity, setting, medical/educational context, facial expressions, full-body scenes, objects, environment
- For pregnancy topics: "pregnant woman doing yoga", "pregnancy support pillow", "prenatal exercise scene"
- For fitness topics: "person in workout attire doing exercise", "gym training scene", "athletic activity"
- For fashion topics: "person wearing [style] outfit", "fashion portrait", "styled look"
- Keep prompts SPECIFIC to script content, not generic stock photos
- Examples of GOOD prompts: "pregnant woman practicing gentle yoga on mat", "prenatal yoga instructor demonstrating pose", "pregnancy support pillow on bed"
- Examples of BAD prompts: "close-up of pregnant belly curves", "tight yoga pants detail", "revealing maternity wear"

Output a JSON object with a "moments" array containing exactly ${momentsCount} objects following this pattern:
- Each moment should have variable duration (2-5 seconds) based on content importance
- Leave ${gapDuration}-second gaps between moments
- Example format: { "moments": [ { "start": 0, "end": 3, "topic": "Opening hook", "prompt": "safe, professional image prompt here" }, { "start": 5, "end": 8, "topic": "Next moment", "prompt": "..." } ] }`;

    let moments = [];
    let momentsText = '';
    
    try {
        // Try Groq first (Primary)
        const groqMomentsChat = await groq.chat.completions.create({
            messages: [{ role: 'user', content: momentsPrompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.3,
            response_format: { type: 'json_object' }
        });

        momentsText = groqMomentsChat.choices[0]?.message?.content?.trim() || '';
        
        if (momentsText.startsWith('```json')) {
            momentsText = momentsText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (momentsText.startsWith('```')) {
            momentsText = momentsText.replace(/```\n?/g, '');
        }

        const parsed = JSON.parse(momentsText);
        
        // Handle different response formats from Groq
        if (Array.isArray(parsed)) {
            moments = parsed;
        } else if (parsed.moments && Array.isArray(parsed.moments)) {
            moments = parsed.moments;
        } else if (parsed.visual_moments && Array.isArray(parsed.visual_moments)) {
            moments = parsed.visual_moments;
        } else {
            // Try to find any array in the response
            const firstArrayKey = Object.keys(parsed).find(key => Array.isArray(parsed[key]));
            moments = firstArrayKey ? parsed[firstArrayKey] : [];
        }
        
        // Validate we have moments before adjusting
        if (!moments || moments.length === 0) {
            throw new Error('Groq returned empty moments array');
        }
        
        // Validate and adjust moments to ensure proper gaps
        moments = adjustMomentsWithGaps(moments, duration, momentsCount, gapDuration);
        
        console.log(`✅ Visual moments extracted with Groq (${moments.length} moments)`);
        
    } catch (groqError) {
        console.warn('⚠️ Groq moments extraction failed, falling back to Gemini:', groqError);
        
        // Fallback to Gemini
        try {
            const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
            if (!geminiApiKey) {
                throw new Error('Server configuration error: missing Gemini key');
            }

            const genAI = new GoogleGenerativeAI(geminiApiKey);
            const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

            const momentsResult = await geminiModel.generateContent(momentsPrompt);
            const momentsResponse = await momentsResult.response;
            momentsText = momentsResponse.text().trim();

            if (momentsText.startsWith('```json')) {
                momentsText = momentsText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            } else if (momentsText.startsWith('```')) {
                momentsText = momentsText.replace(/```\n?/g, '');
            }

            moments = JSON.parse(momentsText);
            moments = adjustMomentsWithGaps(moments, duration, momentsCount, gapDuration);
            
            console.log('✅ Visual moments extracted with Gemini (fallback)');
            
        } catch (geminiError) {
            console.error('❌ Both Groq and Gemini failed for moments extraction:', geminiError);
            // Final fallback: Generate moments with proper gaps
            moments = generateFallbackMomentsWithGaps(duration, momentsCount, gapDuration, scriptText);
            console.log('✅ Using fallback moment generation');
        }
    }

    // Step 3: Analyze Script Mood with Groq (fallback to Gemini)
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

    const validMoods = ['Chill', 'Dramatic', 'Energetic', 'Funny', 'Happy', 'Suspense'];
    let mood = 'Chill';
    
    try {
        // Try Groq first (Primary)
        const groqMoodChat = await groq.chat.completions.create({
            messages: [{ role: 'user', content: moodPrompt }],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.2,
        });

        let moodText = groqMoodChat.choices[0]?.message?.content?.trim() || '';
        mood = validMoods.find(m => moodText.toLowerCase().includes(m.toLowerCase())) || 'Chill';
        
        console.log(`🎭 Script mood detected with Groq: ${mood}`);
        
    } catch (groqError) {
        console.warn('⚠️ Groq mood classification failed, falling back to Gemini:', groqError);
        
        // Fallback to Gemini
        try {
            const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
            if (!geminiApiKey) {
                throw new Error('Server configuration error: missing Gemini key');
            }

            const genAI = new GoogleGenerativeAI(geminiApiKey);
            const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

            const moodResult = await geminiModel.generateContent(moodPrompt);
            const moodResponse = await moodResult.response;
            let moodText = moodResponse.text().trim();

            mood = validMoods.find(m => moodText.toLowerCase().includes(m.toLowerCase())) || 'Chill';
            
            console.log(`🎭 Script mood detected with Gemini (fallback): ${mood}`);
            
        } catch (geminiError) {
            console.error('❌ Both Groq and Gemini failed for mood classification:', geminiError);
            mood = 'Chill'; // Default fallback
            console.log(`🎭 Using default mood: ${mood}`);
        }
    }

    return apiSuccess({
        script: scriptText,
        moments,
        mood,
        wordCount,
        characterCount: scriptText.length,
        mode: isRawScript ? 'script-transform' : 'topic-generation',
        wasTruncated,
        originalWordCount,
        maxAllowed: maxWords
    });
}, { limitPerMin: 10 }); // Layer 1 per-user limit as requested in section 3

