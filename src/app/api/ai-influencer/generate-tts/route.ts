import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';

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
        const { jobId, script, gender, audioSampleUrl } = body;

        if (!jobId || !script || (!gender && !audioSampleUrl)) {
            return NextResponse.json(
                { error: 'Missing required fields: jobId, script, and either gender or audioSampleUrl' },
                { status: 400 }
            );
        }

        const falApiKey = process.env.FAL_API_AUDIO;
        if (!falApiKey) {
            return NextResponse.json({ error: 'FAL_API_AUDIO key not configured' }, { status: 500 });
        }

        let payload: any = {};
        let baseUrl = '';

        if (audioSampleUrl) {
            console.log('🎙️ Generating cloned TTS with Fal AI (Resemble AI)...');
            console.log(`   Job ID: ${jobId} | Clone Source: ${audioSampleUrl} | Chars: ${script.length}`);
            baseUrl = 'resemble-ai/chatterboxhd/text-to-speech';
            payload = {
                text: script,
                audio_url: audioSampleUrl
            };
        } else {
            console.log(`🎙️ Generating preset TTS with Fal AI (Resemble AI)...`);
            console.log(`   Job ID: ${jobId} | Voice Gender: ${gender} | Chars: ${script.length}`);
            baseUrl = 'resemble-ai/chatterboxhd/text-to-speech';
            payload = {
                text: script,
                voice: gender === 'male' ? 'Richard' : 'Aurora'
            };
        }

        // Call Fal AI Queue API via Fal client
        let resultUrl = '';
        try {
            const result = await fal.subscribe(baseUrl, {
                input: payload,
                logs: true,
                onQueueUpdate: (update) => {
                    if (update.status === 'IN_PROGRESS' && update.logs) {
                        update.logs.map((log) => log.message).forEach((msg) => console.log(`   [Fal AI] ${msg}`));
                    }
                },
            });
            console.log(`✅ Fal AI TTS rendering complete. Request ID: ${result.requestId}`);
            resultUrl = result.data.audio?.url || result.data.audio_url || result.data.url;
        } catch (falErr: any) {
            console.error('❌ Fal AI TTS error:', falErr);
            throw new Error(`Fal AI TTS failed: ${falErr.message || JSON.stringify(falErr)}`);
        }

        if (!resultUrl) {
            throw new Error('Fal AI TTS completed but returned no audio URL.');
        }

        // We have the remote audio URL. Fetch the buffer so we can upload it to Firebase or return inline.
        console.log(`⏳ Downloading generated audio from Fal AI: ${resultUrl.substring(0, 60)}...`);
        const audioFetchResponse = await fetch(resultUrl);
        if (!audioFetchResponse.ok) throw new Error('Failed to download audio from Fal AI');
        const audioBuffer = Buffer.from(await audioFetchResponse.arrayBuffer());

        console.log(`✅ TTS audio downloaded: ${audioBuffer.length} bytes`);

        // Try Firebase upload (optional — only if FB_SERVICE_ACCOUNT_KEY is set)
        const firebaseStorage = tryInitFirebase();

        if (firebaseStorage) {
            try {
                const bucket = firebaseStorage.bucket();
                // Store as WAV since Chatterbox defaults to high quality WAV usually, or fallback mp3
                const audioPath = `AIInfluencer/${jobId}/audio.wav`;
                const file = bucket.file(audioPath);

                await file.save(audioBuffer, {
                    metadata: { contentType: 'audio/wav' },
                });
                await file.makePublic();

                const finalUrl = `https://storage.googleapis.com/${bucket.name}/${audioPath}`;
                console.log(`✅ Audio uploaded to Firebase: ${finalUrl}`);

                return NextResponse.json({ success: true, audioUrl: finalUrl, audioSize: audioBuffer.length });
            } catch (fbErr) {
                console.warn('⚠️ Firebase upload failed, falling back to data URL:', fbErr);
            }
        }

        // Fallback: return Base64 data URL so the browser can play it directly
        const base64Audio = audioBuffer.toString('base64');
        const dataUrl = `data:audio/wav;base64,${base64Audio}`;

        console.log('✅ Returning audio as data URL (no Firebase configured)');

        return NextResponse.json({
            success: true,
            audioUrl: dataUrl,
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
