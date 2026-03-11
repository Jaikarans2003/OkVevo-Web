const admin = require('firebase-admin');
const { GoogleGenAI } = require('@google/genai');

/**
 * AWS Lambda Handler for Product Shoots Photo Generation
 *
 * Dedicated Lambda for Product Shoots mode.
 * Supports SQS trigger (production) and HTTP trigger (testing).
 *
 * Flow:
 *  1. Receive SQS message with { jobId, masterPrompt, productImageUrl, outputPath, shotName }
 *  2. Download product image from Firebase Storage
 *  3. Call NANOBANANA PRO (Gemini) with photography master prompt + product image
 *  4. Upload result to Firebase Storage at ProductShoots/{jobId}.png
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
 * Extract Firebase Storage file path from various URL formats.
 */
function extractStoragePath(url) {
    const parsed = new URL(url);

    // Format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?...
    if (parsed.hostname.includes('firebasestorage.googleapis.com')) {
        const parts = parsed.pathname.split('/o/');
        if (parts.length >= 2) {
            return decodeURIComponent(parts[1]);
        }
    }

    // Format: https://storage.googleapis.com/{bucket}/{path}
    const pathMatch = parsed.pathname.match(/^\/[^/]+\/(.+)$/);
    if (pathMatch) {
        return decodeURIComponent(pathMatch[1]);
    }

    throw new Error(`Cannot extract storage path from URL: ${url}`);
}

/**
 * Download file from Firebase Storage and return as Buffer.
 */
async function downloadFromFirebase(fileUrl) {
    const filePath = extractStoragePath(fileUrl);
    console.log(`📥 Downloading: ${filePath}`);

    const bucket = admin.storage().bucket();
    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    if (!exists) {
        throw new Error(`File not found: ${filePath}`);
    }

    const [buffer] = await file.download();
    console.log(`✅ Downloaded: ${filePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
    return buffer;
}

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
 * Generate a product photo using Fal AI (Qwen Image 2.0) with Gemini Fallback.
 * @param {string} masterPrompt     - Photography master prompt
 * @param {Buffer|null} productBuffer - Product image buffer (for Gemini fallback)
 * @param {string|null} productImageUrl - Product image public URL (for Fal AI)
 * @returns {Buffer}                 - Generated image data
 */
async function generateProductShoot(masterPrompt, productBuffer = null, productImageUrl = null) {
    console.log('🔬 Attempting image generation with Fal AI (Nano Banana 2) first...');

    try {
        initializeFalClient();

        let promptText = masterPrompt + '\n\nGenerate a stunning, photorealistic professional product photograph based on the description. Make sure to apply the specified camera angle, lighting setup, and composition.';

        if (productImageUrl) {
            promptText = `${masterPrompt}\n\nHere is the exact product to photograph (image URL): ${productImageUrl}\nGenerate a stunning, photorealistic professional product photograph based on the master prompt above. The product must look exactly like the reference image provided. Apply the specified camera angle, lighting setup, and composition.`;
        }

        const falInput = {
            prompt: promptText,
            aspect_ratio: "4:3",
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

        // Handle both https:// URLs and data: base64 URLs (just in case)
        let buffer;
        if (imageUrl.startsWith('data:')) {
            const base64Data = imageUrl.split(',')[1];
            if (!base64Data) throw new Error('Invalid data URL returned by Fal AI');
            buffer = Buffer.from(base64Data, 'base64');
            console.log(`✅ Decoded base64 image: ${buffer.length} bytes`);
        } else {
            const https = require('https');
            buffer = await new Promise((resolve, reject) => {
                https.get(imageUrl, (res) => {
                    const chunks = [];
                    res.on('data', (c) => chunks.push(c));
                    res.on('end', () => resolve(Buffer.concat(chunks)));
                    res.on('error', reject);
                }).on('error', reject);
            });
        }

        return buffer;

    } catch (falError) {
        console.error('❌ Fal AI Nano Banana 2 failed, falling back to Gemini:', falError.message);

        // --- FALLBACK TO GEMINI ---
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY environment variable not set (needed for fallback)');
        }

        const ai = new GoogleGenAI({ apiKey });

        const contentParts = [];

        if (productBuffer) {
            contentParts.push(
                { text: masterPrompt },
                { text: 'Here is the product to photograph. Use this exact product in the generated shot:' },
                {
                    inlineData: {
                        mimeType: 'image/png',
                        data: productBuffer.toString('base64'),
                    },
                },
                { text: 'Generate a stunning, photorealistic professional product photograph based on the master prompt above. The product must look exactly like the reference image provided. Apply the specified camera angle, lighting setup, and composition.' }
            );
        } else {
            contentParts.push({
                text: masterPrompt + '\n\nGenerate a stunning, photorealistic professional product photograph based on the description above.',
            });
        }

        console.log('📸 Calling NANOBANANA PRO (Gemini) Fallback for Product Shoot...');

        const response = await ai.models.generateContent({
            model: NANOBANANA_MODEL,
            contents: contentParts,
            config: {
                responseModalities: ['TEXT', 'IMAGE'],
            },
        });

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

        console.log('✅ Fallback: Product shoot photo generated successfully by Gemini');
        return Buffer.from(imageBase64, 'base64');
    }
}

// ────────────────────────────────────────────────────
// Core Processing Logic
// ────────────────────────────────────────────────────

/**
 * Process a single Product Shoot photo generation job.
 */
async function processShootJob(jobId, masterPrompt, productImageUrl, outputPath, shotName, resolution, aspectRatio) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`📸 Processing Product Shoot: ${jobId}`);
    console.log(`🎯 Shot: ${shotName || 'Unknown'}`);
    console.log(`${'═'.repeat(50)}`);

    // Download product reference image (if provided)
    let productBuffer = null;
    if (productImageUrl) {
        console.log('📥 Downloading product reference image...');
        productBuffer = await downloadFromFirebase(productImageUrl);
    }

    // Inject the aspect ratio and resolution into the prompt
    const finalPrompt = `${masterPrompt}\n\nCRITICAL INSTRUCTION: Generate this image specifically in ${resolution} resolution with a ${aspectRatio} aspect ratio.`;

    // Generate product photo
    const imageBuffer = await generateProductShoot(finalPrompt, productBuffer);

    // Upload result to Firebase Storage
    const destinationPath = outputPath || `ProductShoots/${jobId}.png`;
    const publicUrl = await uploadToFirebase(imageBuffer, destinationPath);

    console.log(`\n✅ Job ${jobId} complete: ${publicUrl}`);
    return publicUrl;
}

// ────────────────────────────────────────────────────
// Lambda Handler
// ────────────────────────────────────────────────────

exports.handler = async (event) => {
    console.log('📸 Product Shoots Lambda invoked');
    console.log('Event type:', event.Records ? 'SQS' : 'HTTP');

    try {
        initializeFirebase();

        if (event.Records && event.Records.length > 0) {
            // ═══════ SQS TRIGGER ═══════
            console.log(`🔹 SQS Trigger: ${event.Records.length} message(s)`);

            for (const record of event.Records) {
                console.log('Raw record body:', record.body);
                const body = JSON.parse(record.body);
                const { jobId, masterPrompt, productImageUrl, outputPath, shotName, resolution = '4K', aspectRatio = '16:9' } = body;

                console.log(`[Job ${jobId}] Starting shoot process for: ${shotName}`);
                console.log(`[Job ${jobId}] Resolution: ${resolution}, Aspect Ratio: ${aspectRatio}`);
                if (!jobId || !masterPrompt) {
                    console.error('❌ Invalid SQS message: missing jobId or masterPrompt');
                    continue;
                }

                await processShootJob(jobId, masterPrompt, productImageUrl, outputPath, shotName, resolution, aspectRatio);
            }

            return { statusCode: 200, body: 'Product shoots SQS processing complete' };

        } else {
            // ═══════ HTTP TRIGGER (Testing) ═══════
            console.log('🔹 HTTP Trigger');

            const body = event.body ? JSON.parse(event.body) : event;
            const { jobId, masterPrompt, productImageUrl, outputPath, shotName } = body;

            if (!jobId || !masterPrompt) {
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ success: false, error: 'jobId and masterPrompt are required' }),
                };
            }

            const imageUrl = await processShootJob(jobId, masterPrompt, productImageUrl, outputPath, shotName);

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: true, jobId, imageUrl, shotName }),
            };
        }
    } catch (error) {
        console.error('❌ Product Shoots Lambda error:', error);

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: false, error: error.message || 'Processing failed' }),
        };
    }
};
