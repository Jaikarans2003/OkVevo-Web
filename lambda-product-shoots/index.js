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

const NANOBANANA_MODEL = 'gemini-2.5-flash-image';

let firebaseInitialized = false;

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
// NANOBANANA PRO (Gemini Image Generation)
// ────────────────────────────────────────────────────

/**
 * Generate a product photo using NANOBANANA PRO with the product image attached.
 *
 * @param {string} masterPrompt     - Photography master prompt with full technical details
 * @param {Buffer|null} productImage - Product image buffer (attached for reference)
 * @returns {Buffer}                 - Generated image data
 */
async function generateProductShoot(masterPrompt, productImage = null) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable not set');
    }

    const ai = new GoogleGenAI({ apiKey });

    // Build content parts — include product image if available
    const contentParts = [];

    if (productImage) {
        contentParts.push(
            { text: masterPrompt },
            { text: 'Here is the product to photograph. Use this exact product in the generated shot:' },
            {
                inlineData: {
                    mimeType: 'image/png',
                    data: productImage.toString('base64'),
                },
            },
            { text: 'Generate a stunning, photorealistic professional product photograph based on the master prompt above. The product must look exactly like the reference image provided. Apply the specified camera angle, lighting setup, and composition.' }
        );
    } else {
        contentParts.push({
            text: masterPrompt + '\n\nGenerate a stunning, photorealistic professional product photograph based on the description above.',
        });
    }

    console.log('📸 Calling NANOBANANA PRO for Product Shoot...');
    console.log(`📝 Prompt length: ${masterPrompt.length}`);
    console.log(`🖼️ Product reference image: ${productImage ? 'attached' : 'none'}`);

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

    console.log('✅ Product shoot photo generated successfully');
    if (responseText) console.log('📝 Model response:', responseText);

    return Buffer.from(imageBase64, 'base64');
}

// ────────────────────────────────────────────────────
// Core Processing Logic
// ────────────────────────────────────────────────────

/**
 * Process a single Product Shoot photo generation job.
 */
async function processShootJob(jobId, masterPrompt, productImageUrl, outputPath, shotName) {
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

    // Generate photo with product reference
    const imageBuffer = await generateProductShoot(masterPrompt, productBuffer);

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
                const body = JSON.parse(record.body);
                const { jobId, masterPrompt, productImageUrl, outputPath, shotName } = body;

                if (!jobId || !masterPrompt) {
                    console.error('❌ Invalid SQS message: missing jobId or masterPrompt');
                    continue;
                }

                await processShootJob(jobId, masterPrompt, productImageUrl, outputPath, shotName);
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
