import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';

/**
 * POST /api/ai-influencer/generate-photos
 *
 * Generates one cinematic image per visual moment using Nano Banana 2 (Fal AI)
 * with Gemini as fallback. Uploads each to Firebase Storage and returns public URLs.
 *
 * Body: { jobId: string, moments: ImageMoment[] }
 * Returns: { photos: { time, start, end, topic, imageUrl, layout }[] }
 */

interface InputMoment {
    time: string;
    start: number;
    end: number;
    topic: string;
    prompt: string;
    layout: 'split' | 'fullscreen';
}

/**
 * Primary: Generate image with Nano Banana 2 via Fal AI.
 */
async function generateImageFromNanoBanana(prompt: string, aspectRatio: string, resolution: string): Promise<Buffer> {
    const falApiKey = process.env.FAL_API_IMAGE;
    if (!falApiKey) throw new Error('FAL_API_IMAGE not configured');

    fal.config({ credentials: falApiKey });

    const result = await fal.subscribe('fal-ai/nano-banana-2', {
        input: {
            prompt,
            aspect_ratio: aspectRatio,
            resolution,
            output_format: 'png',
            num_images: 1,
        },
        logs: true,
        onQueueUpdate: (update) => {
            if (update.status === 'IN_PROGRESS' && update.logs) {
                update.logs.map((log) => log.message).forEach((msg) => console.log(`   [Fal AI] ${msg}`));
            }
        },
    });

    const imageUrl = result.data?.images?.[0]?.url;
    if (!imageUrl) throw new Error(`Nano Banana 2 returned no image: ${JSON.stringify(result)}`);

    console.log(`✅ Nano Banana 2 image ready: ${imageUrl}`);

    // Download the image buffer
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to download Nano Banana 2 image: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * Fallback: Generate image with Gemini.
 */
async function generateImageFromGemini(prompt: string, apiKey: string): Promise<Buffer> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini image API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;

    if (!parts) throw new Error('No content in Gemini image response');

    const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));
    if (!imagePart?.inlineData?.data) {
        throw new Error('No image data in Gemini response');
    }

    return Buffer.from(imagePart.inlineData.data, 'base64');
}

function tryInitFirebase() {
    try {
        const serviceAccountBase64 = process.env.FB_SERVICE_ACCOUNT_KEY;
        console.log('🔑 FB_SERVICE_ACCOUNT_KEY exists:', !!serviceAccountBase64);
        console.log('🔑 Key length:', serviceAccountBase64?.length);

        if (!serviceAccountBase64) {
            console.warn('❌ FB_SERVICE_ACCOUNT_KEY not found in environment');
            return null;
        }

        const { initializeApp, getApps, cert } = require('firebase-admin/app');
        const { getStorage } = require('firebase-admin/storage');

        if (getApps().length === 0) {
            console.log('🔥 Initializing Firebase Admin SDK...');
            const serviceAccount = JSON.parse(
                Buffer.from(serviceAccountBase64.trim(), 'base64').toString('utf-8')
            );
            const bucket = process.env.FB_STORAGE_BUCKET || 'text2video-16cbf.firebasestorage.app';
            initializeApp({ credential: cert(serviceAccount), storageBucket: bucket });
            console.log('✅ Firebase Admin SDK initialized');
        } else {
            console.log('✅ Firebase Admin SDK already initialized');
        }

        return getStorage();
    } catch (err) {
        console.error('❌ Firebase Admin SDK initialization failed:', err);
        return null;
    }
}

export async function POST(request: NextRequest) {
    console.log('🔍 ENV CHECK: FB_SERVICE_ACCOUNT_KEY exists:', !!process.env.FB_SERVICE_ACCOUNT_KEY);
    console.log('🔍 ENV CHECK: Key length:', process.env.FB_SERVICE_ACCOUNT_KEY?.length);

    try {
        const body = await request.json();
        const { jobId, moments } = body as { jobId: string; moments: InputMoment[] };

        if (!jobId || !moments?.length) {
            return NextResponse.json(
                { error: 'Missing required fields: jobId, moments' },
                { status: 400 }
            );
        }

        // Mock Mode Check
        if (process.env.FAL_MODE === 'mock' || process.env.NEXT_PUBLIC_MOCK_MODE === 'true') {
            console.log('Mock mode enabled for photos -> returning dummy photos from InfluencerAssets');
            // Use real mock images that exist in Firebase Storage (publicly readable)
            const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'text2video-16cbf.firebasestorage.app';
            const mockImages = [
                `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/InfluencerAssets%2Fmock1.jpg?alt=media`,
                `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/InfluencerAssets%2Fmock2.jpg?alt=media`,
                `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/InfluencerAssets%2Fmock3.jpg?alt=media`,
            ];
            const mockPhotos = moments.map((moment, i) => ({
                time: moment.time,
                start: moment.start,
                end: moment.end,
                topic: moment.topic,
                imageUrl: mockImages[i % mockImages.length],
                layout: i === 0 ? 'fullscreen' : 'split',
            }));
            return NextResponse.json({ success: true, photos: mockPhotos });
        }

        const firebaseStorage = tryInitFirebase();
        const photos: any[] = [];

        for (let i = 0; i < moments.length; i++) {
            const moment = moments[i];
            console.log(`🖼️ Generating image ${i + 1}/${moments.length}: ${moment.topic}`);

            try {
                const aspectRatio = i === 0 ? '9:16' : '16:9';
                const resolution = '2K';
                const finalPrompt = moment.prompt;

                let imageBuffer: Buffer;

                // Try Nano Banana 2 first, fall back to Gemini
                try {
                    console.log(`🔬 Trying Nano Banana 2 (Fal AI) for image ${i + 1}...`);
                    imageBuffer = await generateImageFromNanoBanana(finalPrompt, aspectRatio, resolution);
                } catch (falErr: any) {
                    console.warn(`⚠️ Nano Banana 2 failed for image ${i + 1}, falling back to Gemini:`, falErr.message);
                    const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
                    if (!geminiKey) throw new Error('Neither FAL_API_IMAGE nor GEMINI_API_KEY configured');

                    const aspectInstruction = i === 0
                        ? "Generate this image specifically in 2K resolution with a vertical 9:16 aspect ratio."
                        : "Generate this image specifically in 2K resolution with a standard horizontal 16:9 aspect ratio.";
                    imageBuffer = await generateImageFromGemini(`${finalPrompt}. ${aspectInstruction}`, geminiKey);
                }

                let imageUrl: string;

                if (firebaseStorage) {
                    const bucket = firebaseStorage.bucket();
                    const imagePath = `AIInfluencer/${jobId}/photos/img-${i}.png`;
                    const file = bucket.file(imagePath);
                    await file.save(imageBuffer, { metadata: { contentType: 'image/png' } });
                    await file.makePublic();
                    imageUrl = `https://storage.googleapis.com/${bucket.name}/${imagePath}`;
                } else {
                    imageUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
                }

                console.log(`✅ Image ${i + 1} ready: ${imageUrl.substring(0, 80)}`);

                photos.push({
                    time: moment.time,
                    start: moment.start,
                    end: moment.end,
                    topic: moment.topic,
                    imageUrl,
                    layout: i === 0 ? 'fullscreen' : 'split',
                });
            } catch (imgErr: any) {
                console.warn(`⚠️ Failed to generate image ${i + 1} (${moment.topic}):`, imgErr.message);
                photos.push({
                    time: moment.time,
                    start: moment.start,
                    end: moment.end,
                    topic: moment.topic,
                    imageUrl: null,
                    layout: i === 0 ? 'fullscreen' : 'split',
                });
            }
        }

        const successful = photos.filter(p => p.imageUrl !== null).length;
        console.log(`✅ Generated ${successful}/${moments.length} images`);

        return NextResponse.json({ success: true, photos });

    } catch (error: any) {
        console.error('❌ Generate photos error:', error);
        return NextResponse.json(
            { error: 'Failed to generate photos', details: error.message },
            { status: 500 }
        );
    }
}
