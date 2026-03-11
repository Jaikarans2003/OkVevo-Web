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
            console.log('🎙️ Generating cloned TTS with Fal AI (F5-TTS)...');
            console.log(`   Job ID: ${jobId} | Clone Source: ${audioSampleUrl} | Chars: ${script.length}`);
            baseUrl = 'fal-ai/f5-tts';
            payload = {
                gen_text: script,
                ref_audio_url: audioSampleUrl
            };
        } else {
            console.log(`🎙️ Generating preset TTS with Fal AI (PlayHT)...`);
            console.log(`   Job ID: ${jobId} | Voice Gender: ${gender} | Chars: ${script.length}`);
            baseUrl = 'fal-ai/playht/tts/v3';
            payload = {
                input: script,
                voice: gender === 'male' ? 'Will (English (US)/American)' : 'Jennifer (English (US)/American)'
            };
        }

        // Call Fal AI Queue API
        const submitUrl = `https://queue.fal.run/${baseUrl}`;

        const submitResponse = await fetch(submitUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${falApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!submitResponse.ok) {
            const errText = await submitResponse.text();
            console.error('❌ Fal AI TTS submit error:', errText);
            throw new Error(`Fal AI TTS submit failed: ${submitResponse.status} ${errText}`);
        }

        const { request_id } = await submitResponse.json();
        console.log(`✅ Fal AI TTS job submitted: ${request_id}`);

        // Poll for completion
        const statusUrl = `https://queue.fal.run/${baseUrl}/requests/${request_id}/status`;
        let resultUrl = '';
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes max at 5s intervals

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;

            const statusRes = await fetch(statusUrl, {
                headers: { 'Authorization': `Key ${falApiKey}` }
            });

            if (!statusRes.ok) {
                console.error(`❌ Fal AI status error: ${statusRes.status}`);
                continue; // keep trying
            }

            const statusData = await statusRes.json();

            if (statusData.status === 'COMPLETED') {
                console.log('✅ Fal AI TTS rendering complete.');
                // Fetch the final result
                const resultRes = await fetch(`https://queue.fal.run/${baseUrl}/requests/${request_id}`, {
                    headers: { 'Authorization': `Key ${falApiKey}` }
                });

                if (resultRes.ok) {
                    const finalData = await resultRes.json();
                    resultUrl = finalData.audio?.url || finalData.audio_url; // Fallbacks for fal output shape
                }
                break;
            } else if (statusData.status === 'FAILED') {
                throw new Error(`Fal AI TTS failed: ${JSON.stringify(statusData)}`);
            } else if (attempts % 3 === 0) {
                console.log(`   ⏳ TTS generation in progress (attempt ${attempts}/${maxAttempts})...`);
            }
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
