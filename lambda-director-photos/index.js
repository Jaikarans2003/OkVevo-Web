const admin = require('firebase-admin');
const { GoogleGenAI } = require('@google/genai');

/**
 * AWS Lambda Handler for Director Photo Generation
 *
 * Isolated Lambda for Director Mode shot photo generation.
 * Supports SQS trigger (production) and HTTP trigger (testing).
 *
 * Flow:
 *  1. Receive SQS message with { type, jobId, masterPrompt, outputPath }
 *  2. Call NANOBANANA PRO (Gemini) to generate shot photo
 *  3. Upload result to Firebase Storage at DirectorPhotos/{jobId}.png
 */

const { fal } = require('@fal-ai/client');
const NANOBANANA_MODEL = 'gemini-3.1-flash-image-preview';

let firebaseInitialized = false;

// ────────────────────────────────────────────────────
// Fal AI Initialization Helper
// ────────────────────────────────────────────────────

function initializeFalClient() {
    const apiKey = process.env.FAL_API_IMAGE;
    if (!apiKey) {
        throw new Error('FAL_API_IMAGE environment variable not set');
    }
    fal.config({ credentials: apiKey });
}

function initializeFirebase() {
    if (firebaseInitialized) return;

    try {
        const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

        if (!serviceAccountBase64) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set');
        }

        const cleanedBase64 = serviceAccountBase64.trim();
        console.log(`🔑 Service Account Key Length: ${cleanedBase64.length} chars`);

        const serviceAccount = JSON.parse(
            Buffer.from(cleanedBase64, 'base64').toString('utf-8')
        );

        const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'text2video-16cbf.firebasestorage.app';
        console.log(`Initializing Firebase with bucket: ${bucketName}`);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: bucketName,
        });

        firebaseInitialized = true;
        console.log('✅ Firebase Admin SDK initialized');
    } catch (error) {
        console.error('❌ Failed to initialize Firebase:', error);
        throw error;
    }
}

// ────────────────────────────────────────────────────
// Firebase Storage Helpers
// ────────────────────────────────────────────────────

/**
 * Upload image buffer to Firebase Storage and return public URL.
 */
async function uploadToFirebase(imageBuffer, destinationPath, mimeType = 'image/png') {
    const bucket = admin.storage().bucket();
    const file = bucket.file(destinationPath);

    await file.save(imageBuffer, {
        metadata: { contentType: mimeType },
    });

    // Make publicly accessible
    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destinationPath}`;
    console.log(`✅ Uploaded: ${destinationPath}`);
    return publicUrl;
}

// ────────────────────────────────────────────────────
// Image Generation via Fal AI (Main) or Gemini (Fallback)
// ────────────────────────────────────────────────────

/**
 * Generate a photo from a shot prompt using Fal AI (Flux Pro) with Gemini Fallback.
 *
 * @param {string} masterPrompt - The full shot prompt with scene context
 * @returns {Buffer} - Generated image data
 */
async function generateDirectorPhoto(masterPrompt) {
    console.log('🔬 Attempting image generation with Fal AI (Nano Banana 2) first...');

    try {
        initializeFalClient();

        const falInput = {
            prompt: masterPrompt + '\n\nGenerate the image described above. Make it cinematic, photorealistic, and visually stunning.',
            aspect_ratio: "16:9",
            resolution: "2K",
            output_format: "png",
            num_images: 1,
        };

        const result = await fal.subscribe("fal-ai/nano-banana-2", {
            input: falInput,
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === "IN_PROGRESS") {
                    update.logs?.map((log) => log.message).forEach(console.log);
                }
            },
        });

        const imageUrl = result.data?.images?.[0]?.url;
        if (!imageUrl) {
            throw new Error(`Fal AI Nano Banana 2 failed: ${JSON.stringify(result)}`);
        }

        console.log(`✅ Fal AI Nano Banana 2 image ready: ${imageUrl}`);

        // Download result buffer from Fal AI
        const https = require('https');
        const buffer = await new Promise((resolve, reject) => {
            https.get(imageUrl, (res) => {
                const chunks = [];
                res.on('data', (c) => chunks.push(c));
                res.on('end', () => resolve(Buffer.concat(chunks)));
                res.on('error', reject);
            }).on('error', reject);
        });

        return buffer;

    } catch (falError) {
        console.error('❌ Fal AI Nano Banana 2 failed, falling back to Gemini:', falError.message);

        // --- FALLBACK TO GEMINI ---
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY environment variable not set (needed for fallback)');
        }

        const ai = new GoogleGenAI({ apiKey });

        // Director photos are prompt-only (no reference images needed)
        const contentParts = [
            {
                text: masterPrompt + '\n\nGenerate the image described above. Make it cinematic, photorealistic, and visually stunning.',
            },
        ];

        console.log('🔬 Calling NANOBANANA PRO (Gemini) Fallback for Director photo...');

        const response = await ai.models.generateContent({
            model: NANOBANANA_MODEL,
            contents: contentParts,
            config: {
                responseModalities: ['TEXT', 'IMAGE'],
            },
        });

        // Extract image from response
        let imageBase64 = null;
        let responseText = '';

        if (response.candidates && response.candidates[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.text) {
                    responseText += part.text;
                } else if (part.inlineData) {
                    imageBase64 = part.inlineData.data;
                }
            }
        }

        if (!imageBase64) {
            throw new Error(
                `NANOBANANA PRO did not return an image. Response: ${responseText || '(empty)'}`
            );
        }

        console.log('✅ Fallback: Director photo generated successfully by Gemini');
        return Buffer.from(imageBase64, 'base64');
    }
}

// ────────────────────────────────────────────────────
// Core Processing Logic
// ────────────────────────────────────────────────────

/**
 * Process a single Director photo generation job.
 */
async function processDirectorPhotoJob(jobId, masterPrompt, outputPath) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`📸 Processing Director photo job: ${jobId}`);
    console.log(`${'═'.repeat(50)}`);

    // Generate photo from prompt (no reference images)
    const imageBuffer = await generateDirectorPhoto(masterPrompt);

    // Upload result to Firebase Storage
    const destinationPath = outputPath || `DirectorPhotos/${jobId}.png`;
    const publicUrl = await uploadToFirebase(imageBuffer, destinationPath);

    console.log(`\n✅ Job ${jobId} complete: ${publicUrl}`);
    return publicUrl;
}

// ────────────────────────────────────────────────────
// Lambda Handler
// ────────────────────────────────────────────────────

exports.handler = async (event) => {
    console.log('🎬 Director Photos Lambda invoked');
    console.log('Event type:', event.Records ? 'SQS' : 'HTTP');

    try {
        initializeFirebase();

        if (event.Records && event.Records.length > 0) {
            // ═══════ SQS TRIGGER ═══════
            console.log(`🔹 SQS Trigger: ${event.Records.length} message(s)`);

            for (const record of event.Records) {
                console.log('Raw record body:', record.body);
                const body = JSON.parse(record.body);
                const { jobId, masterPrompt, outputPath } = body;

                if (!jobId || !masterPrompt) {
                    console.error('❌ Invalid SQS message: missing jobId or masterPrompt');
                    continue;
                }

                await processDirectorPhotoJob(jobId, masterPrompt, outputPath);
            }

            return { statusCode: 200, body: 'Director photo SQS processing complete' };

        } else {
            // ═══════ HTTP TRIGGER (Testing) ═══════
            console.log('🔹 HTTP Trigger');

            const body = event.body ? JSON.parse(event.body) : event;
            const { jobId, masterPrompt, outputPath } = body;

            if (!jobId || !masterPrompt) {
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ success: false, error: 'jobId and masterPrompt are required' }),
                };
            }

            const imageUrl = await processDirectorPhotoJob(jobId, masterPrompt, outputPath);

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: true, jobId, imageUrl }),
            };
        }
    } catch (error) {
        console.error('❌ Director Photos Lambda error:', error);

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: false, error: error.message || 'Processing failed' }),
        };
    }
};
