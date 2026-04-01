import { NextRequest } from 'next/server';
import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { generateNarrationAudioServer } from '@/lib/server/tts-server';
import { z } from 'zod';

const TTSSchema = z.object({
    narrationText: z.string().min(10).max(4096, "Text too long"),
    sessionId: z.string().optional(),
    options: z.object({
        voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional(),
        model: z.enum(['tts-1', 'tts-1-hd']).optional(),
        speed: z.number().min(0.25).max(4.0).optional()
    }).optional()
});

export const POST = apiHandler(async (req) => {
    const body = await req.json();
    
    // Zod Data Validation
    const validation = TTSSchema.safeParse(body);
    if (!validation.success) {
        throw new Error(`Invalid request format: ${validation.error.issues[0].message}`);
    }

    const { narrationText, sessionId, options } = validation.data;
    
    // TTS is handled safely in the server utilizing our exponential retries wrapper and 15s timeout
    const audioUrl = await generateNarrationAudioServer(narrationText, sessionId, options);

    return apiSuccess({ audioUrl });
}, { limitPerMin: 5 }); // 5/min limit for TTS specifically
