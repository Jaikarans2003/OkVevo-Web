import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

/**
 * AI Influencer TTS Generation API Route
 * 
 * Generates TTS audio using OpenAI API and uploads to Firebase Storage.
 * 
 * POST /api/ai-influencer/generate-tts
 */

let firebaseInitialized = false;

function initializeFirebase() {
    if (firebaseInitialized || getApps().length > 0) {
        firebaseInitialized = true;
        return;
    }

    try {
        const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!serviceAccountBase64) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not set');
        }

        const serviceAccount = JSON.parse(
            Buffer.from(serviceAccountBase64.trim(), 'base64').toString('utf-8')
        );

        const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'text2video-16cbf.firebasestorage.app';

        initializeApp({
            credential: cert(serviceAccount),
            storageBucket: bucketName,
        });

        firebaseInitialized = true;
        console.log('✅ Firebase Admin SDK initialized');
    } catch (error: any) {
        console.error('❌ Firebase initialization error:', error);
        throw error;
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

        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            console.error('OPENAI_API_KEY not configured');
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            );
        }

        // Voice mapping based on gender
        const voiceMap: { [key: string]: string } = {
            male: 'onyx',
            female: 'nova'
        };
        const voice = voiceMap[gender];

        console.log('🎙️ Generating TTS with OpenAI...');
        console.log(`   Job ID: ${jobId}`);
        console.log(`   Gender: ${gender} → Voice: ${voice}`);
        console.log(`   Script length: ${script.length} chars`);

        // Call OpenAI TTS API
        const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini-tts',
                input: script,
                voice: voice,
                response_format: 'mp3',
                speed: 1.0
            }),
        });

        if (!ttsResponse.ok) {
            const errorText = await ttsResponse.text();
            console.error('❌ OpenAI TTS API error:', errorText);
            throw new Error(`OpenAI TTS failed: ${ttsResponse.status} ${errorText}`);
        }

        const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
        console.log(`✅ TTS generated: ${audioBuffer.length} bytes`);

        // Initialize Firebase and upload
        initializeFirebase();
        const bucket = getStorage().bucket();
        const audioPath = `AIInfluencer/${jobId}/audio.mp3`;
        const file = bucket.file(audioPath);

        await file.save(audioBuffer, {
            metadata: {
                contentType: 'audio/mpeg',
                metadata: {
                    jobId,
                    gender,
                    voice,
                    generatedAt: new Date().toISOString()
                }
            }
        });

        await file.makePublic();
        const audioUrl = `https://storage.googleapis.com/${bucket.name}/${audioPath}`;

        console.log(`✅ Audio uploaded to Firebase: ${audioUrl}`);

        return NextResponse.json({
            success: true,
            audioUrl,
            voice,
            audioSize: audioBuffer.length
        });

    } catch (error: any) {
        console.error('❌ TTS generation error:', error);
        return NextResponse.json(
            { 
                error: 'Failed to generate TTS',
                details: error.message 
            },
            { status: 500 }
        );
    }
}
