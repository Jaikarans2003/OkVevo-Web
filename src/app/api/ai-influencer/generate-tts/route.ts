import { NextRequest, NextResponse } from 'next/server';

/**
 * AI Influencer TTS Generation API Route
 *
 * Generates TTS audio using OpenAI API.
 * Returns a signed URL if Firebase Admin is configured,
 * OR falls back to returning a data URL so the frontend can play/use it directly.
 *
 * POST /api/ai-influencer/generate-tts
 */

function tryInitFirebase() {
    try {
        const serviceAccountBase64 = process.env.FB_SERVICE_ACCOUNT_KEY;
        if (!serviceAccountBase64) return null;

        const { initializeApp, getApps, cert } = require('firebase-admin/app');
        const { getStorage } = require('firebase-admin/storage');

        if (getApps().length === 0) {
            const serviceAccount = JSON.parse(
                Buffer.from(serviceAccountBase64.trim(), 'base64').toString('utf-8')
            );
            const bucketName = process.env.FB_STORAGE_BUCKET || 'text2video-16cbf.firebasestorage.app';
            initializeApp({ credential: cert(serviceAccount), storageBucket: bucketName });
        }

        return getStorage();
    } catch {
        return null;
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { jobId, script, gender } = body;

        if (!jobId || !script || !gender) {
            return NextResponse.json(
                { error: 'Missing required fields: jobId, script, gender' },
                { status: 400 }
            );
        }

        if (!['male', 'female'].includes(gender)) {
            return NextResponse.json(
                { error: 'Gender must be "male" or "female"' },
                { status: 400 }
            );
        }

        const openaiApiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
        if (!openaiApiKey) {
            return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
        }

        // Voice mapping
        const voiceMap: Record<string, string> = { male: 'onyx', female: 'nova' };
        const voice = voiceMap[gender];

        console.log('🎙️ Generating TTS with OpenAI...');
        console.log(`   Job ID: ${jobId} | Voice: ${voice} | Chars: ${script.length}`);

        // Call OpenAI TTS
        const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'tts-1',
                input: script,
                voice,
                response_format: 'mp3',
                speed: 1.0,
            }),
        });

        if (!ttsResponse.ok) {
            const errText = await ttsResponse.text();
            console.error('❌ OpenAI TTS error:', errText);
            throw new Error(`OpenAI TTS failed: ${ttsResponse.status} ${errText}`);
        }

        const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
        console.log(`✅ TTS audio generated: ${audioBuffer.length} bytes`);

        // Try Firebase upload (optional — only if FB_SERVICE_ACCOUNT_KEY is set)
        const firebaseStorage = tryInitFirebase();

        if (firebaseStorage) {
            try {
                const bucket = firebaseStorage.bucket();
                const audioPath = `AIInfluencer/${jobId}/audio.mp3`;
                const file = bucket.file(audioPath);

                await file.save(audioBuffer, {
                    metadata: { contentType: 'audio/mpeg' },
                });
                await file.makePublic();

                const audioUrl = `https://storage.googleapis.com/${bucket.name}/${audioPath}`;
                console.log(`✅ Audio uploaded to Firebase: ${audioUrl}`);

                return NextResponse.json({ success: true, audioUrl, voice, audioSize: audioBuffer.length });
            } catch (fbErr) {
                console.warn('⚠️ Firebase upload failed, falling back to data URL:', fbErr);
            }
        }

        // Fallback: return Base64 data URL so the browser can play it directly
        const base64Audio = audioBuffer.toString('base64');
        const dataUrl = `data:audio/mpeg;base64,${base64Audio}`;

        console.log('✅ Returning audio as data URL (no Firebase configured)');

        return NextResponse.json({
            success: true,
            audioUrl: dataUrl,
            voice,
            audioSize: audioBuffer.length,
            storageMode: 'dataurl',
        });

    } catch (error: any) {
        console.error('❌ TTS generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate TTS', details: error.message },
            { status: 500 }
        );
    }
}
