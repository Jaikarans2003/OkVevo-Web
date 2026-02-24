const admin = require('firebase-admin');
const { GoogleGenAI } = require('@google/genai');
const https = require('https');

/**
 * AWS Lambda Handler for Trend Photo & Video Generation
 *
 * Dedicated Lambda for Instagram Trends feature.
 * Supports SQS trigger (production) and HTTP trigger (testing).
 *
 * Image Flow:
 *  1. Receive SQS message with { type: 'trend-photo', jobId, masterPrompt, personImageUrl, outputPath }
 *  2. Download person's image from Firebase Storage
 *  3. Call NANOBANANA PRO (Gemini) with trend prompt + person's image
 *  4. Upload result to Firebase Storage at TrendPhotos/{jobId}.png
 *
 * Video Flow:
 *  1. Receive SQS message with { type: 'trend-video', jobId, masterPrompt, personImageUrl, outputPath, videoDuration }
 *  2. Download source image from Firebase Storage
 *  3. Call Kling 2.5 Turbo API for image-to-video generation
 *  4. Poll Kling for completion, download video
 *  5. Upload result to Firebase Storage at TrendPhotos/{jobId}.mp4
 */

const NANOBANANA_MODEL = 'gemini-2.5-flash-image';
const AIML_API_BASE = 'https://api.aimlapi.com';

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

function extractStoragePath(url) {
    const parsed = new URL(url);

    if (parsed.hostname.includes('firebasestorage.googleapis.com')) {
        const parts = parsed.pathname.split('/o/');
        if (parts.length >= 2) {
            return decodeURIComponent(parts[1]);
        }
    }

    const pathMatch = parsed.pathname.match(/^\/[^/]+\/(.+)$/);
    if (pathMatch) {
        return decodeURIComponent(pathMatch[1]);
    }

    throw new Error(`Cannot extract storage path from URL: ${url}`);
}

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

async function uploadToFirebase(buffer, destinationPath, mimeType = 'image/png') {
    const bucket = admin.storage().bucket();
    const file = bucket.file(destinationPath);

    await file.save(buffer, {
        metadata: { contentType: mimeType },
    });

    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destinationPath}`;
    console.log(`✅ Uploaded: ${destinationPath}`);
    return publicUrl;
}

// ────────────────────────────────────────────────────
// Kling API Helpers
// ────────────────────────────────────────────────────

/**
 * Make an HTTP request to the Kling API using a single API key.
 */
function klingRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const apiKey = process.env.KLING_API_KEY;
        if (!apiKey) {
            return reject(new Error('KLING_API_KEY environment variable not set'));
        }

        const url = new URL(path, KLING_API_BASE);

        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch {
                    reject(new Error(`Kling API invalid response: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Kling API request timeout'));
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

// ────────────────────────────────────────────────────
// NANOBANANA PRO (Image Generation)
// ────────────────────────────────────────────────────

async function generateTrendImage(masterPrompt, personImage = null) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable not set');
    }

    const ai = new GoogleGenAI({ apiKey });

    const contentParts = [];

    if (personImage) {
        contentParts.push(
            { text: masterPrompt },
            { text: 'Here is the person\'s photo. Generate the scene described above using this exact person. The person must look exactly like in this reference photo. Apply the specified camera angle, lighting, and composition.' },
            {
                inlineData: {
                    mimeType: 'image/png',
                    data: personImage.toString('base64'),
                },
            },
            { text: 'Generate a stunning, photorealistic, cinematic photograph based on the master prompt above.' }
        );
    } else {
        contentParts.push({
            text: masterPrompt + '\n\nGenerate a stunning, photorealistic, cinematic photograph.',
        });
    }

    console.log('📸 Calling NANOBANANA PRO for Trend image...');
    console.log(`📝 Prompt length: ${masterPrompt.length}`);
    console.log(`🧑 Person reference image: ${personImage ? 'attached' : 'none'}`);

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

    console.log('✅ Trend image generated successfully');
    if (responseText) console.log('📝 Model response:', responseText);

    return Buffer.from(imageBase64, 'base64');
}

// ────────────────────────────────────────────────────
// AIML API Helpers (Kling via AIML aggregator)
// ────────────────────────────────────────────────────

/**
 * Make an HTTP request to the AIML API.
 */
function aimlRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const apiKey = process.env.KLING_API_KEY;
        if (!apiKey) {
            return reject(new Error('KLING_API_KEY environment variable not set'));
        }

        const url = new URL(path, AIML_API_BASE);

        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode >= 400) {
                        reject(new Error(`AIML API error (${res.statusCode}): ${JSON.stringify(parsed)}`));
                    } else {
                        resolve(parsed);
                    }
                } catch {
                    reject(new Error(`AIML API invalid response (${res.statusCode}): ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('AIML API request timeout'));
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

// ────────────────────────────────────────────────────
// Kling 2.5 Turbo via AIML API (Video Generation)
// ────────────────────────────────────────────────────

/**
 * Submit a Kling image-to-video task via AIML API.
 */
async function submitKlingVideoTask(imageUrl, prompt, duration = 5) {
    console.log('🎥 Submitting Kling image-to-video task via AIML API...');
    console.log(`📝 Video prompt: ${prompt}`);
    console.log(`⏱️ Duration: ${duration}s`);

    const response = await aimlRequest('POST', '/v2/video/generations', {
        model: 'klingai/v2.5-turbo/pro/image-to-video',
        image_url: imageUrl,
        prompt: prompt,
        negative_prompt: 'blurry, distorted face, extra limbs, low quality, watermark',
        duration: String(duration),
        cfg_scale: 0.5,
    });

    const generationId = response.id || response.generation_id;
    if (!generationId) {
        throw new Error(`AIML API did not return a generation ID: ${JSON.stringify(response)}`);
    }

    console.log(`✅ AIML video task submitted: ${generationId}`);
    return generationId;
}

/**
 * Poll AIML API for video generation completion.
 */
async function pollKlingTask(generationId, maxAttempts = 60) {
    const INTERVAL_MS = 5000; // 5 seconds

    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, INTERVAL_MS));

        console.log(`⏳ AIML poll ${i + 1}/${maxAttempts}: generation ${generationId}...`);

        const response = await aimlRequest('GET', `/v2/video/generations?generation_id=${generationId}`);

        const status = response.status;
        console.log(`   Status: ${status}`);

        if (status === 'completed' || status === 'succeed') {
            // AIML may return video URL in different fields
            const videoUrl = response.video_url
                || response.output?.video_url
                || response.data?.task_result?.videos?.[0]?.url
                || response.generations?.[0]?.video?.url;

            if (!videoUrl) {
                throw new Error(`Video completed but no URL found: ${JSON.stringify(response)}`);
            }
            console.log(`✅ Video ready: ${videoUrl}`);
            return videoUrl;
        }

        if (status === 'failed' || status === 'error') {
            const failReason = response.error || response.message || 'Unknown failure';
            throw new Error(`Video generation failed: ${failReason}`);
        }

        // Status is 'pending', 'queued', 'processing', 'generating' — continue polling
    }

    throw new Error(`Video generation timed out after ${maxAttempts * INTERVAL_MS / 1000}s`);
}

/**
 * Download video from URL and return as Buffer.
 */
function downloadUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            // Handle redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadUrl(res.headers.location).then(resolve).catch(reject);
            }

            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

// ────────────────────────────────────────────────────
// Core Processing Logic
// ────────────────────────────────────────────────────

/**
 * Process a trend IMAGE generation job.
 */
async function processTrendImageJob(jobId, masterPrompt, personImageUrl, outputPath) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`📸 Processing Trend image: ${jobId}`);
    console.log(`${'═'.repeat(50)}`);

    // Download person's reference image
    let personBuffer = null;
    if (personImageUrl) {
        console.log('📥 Downloading person reference image...');
        personBuffer = await downloadFromFirebase(personImageUrl);
    }

    // Generate image with person reference
    const imageBuffer = await generateTrendImage(masterPrompt, personBuffer);

    // Upload result to Firebase Storage
    const destinationPath = outputPath || `TrendPhotos/${jobId}.png`;
    const publicUrl = await uploadToFirebase(imageBuffer, destinationPath);

    console.log(`\n✅ Image job ${jobId} complete: ${publicUrl}`);
    return publicUrl;
}

/**
 * Process a trend VIDEO generation job.
 */
async function processTrendVideoJob(jobId, videoPrompt, sourceImageUrl, outputPath, videoDuration) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`🎥 Processing Trend video: ${jobId}`);
    console.log(`${'═'.repeat(50)}`);

    // AIML API accepts image_url directly — no need to download/convert
    // Submit AIML/Kling task with the source image URL
    const taskId = await submitKlingVideoTask(sourceImageUrl, videoPrompt, videoDuration);

    // Poll for completion
    const videoUrl = await pollKlingTask(taskId);

    // Download the generated video
    console.log('📥 Downloading generated video from Kling...');
    const videoBuffer = await downloadUrl(videoUrl);

    // Upload to Firebase Storage
    const destinationPath = outputPath || `TrendPhotos/${jobId}.mp4`;
    const publicUrl = await uploadToFirebase(videoBuffer, destinationPath, 'video/mp4');

    console.log(`\n✅ Video job ${jobId} complete: ${publicUrl}`);
    return publicUrl;
}

// ────────────────────────────────────────────────────
// Lambda Handler
// ────────────────────────────────────────────────────

exports.handler = async (event) => {
    console.log('🎬 Trend Generation Lambda invoked');
    console.log('Event type:', event.Records ? 'SQS' : 'HTTP');

    try {
        initializeFirebase();

        if (event.Records && event.Records.length > 0) {
            // ═══════ SQS TRIGGER ═══════
            console.log(`🔹 SQS Trigger: ${event.Records.length} message(s)`);

            for (const record of event.Records) {
                const body = JSON.parse(record.body);
                const { type, jobId, masterPrompt, personImageUrl, outputPath, videoDuration } = body;

                if (!jobId || !masterPrompt) {
                    console.error('❌ Invalid SQS message: missing jobId or masterPrompt');
                    continue;
                }

                if (type === 'trend-video') {
                    await processTrendVideoJob(jobId, masterPrompt, personImageUrl, outputPath, videoDuration || 5);
                } else {
                    await processTrendImageJob(jobId, masterPrompt, personImageUrl, outputPath);
                }
            }

            return { statusCode: 200, body: 'Trend generation SQS processing complete' };

        } else {
            // ═══════ HTTP TRIGGER (Testing) ═══════
            console.log('🔹 HTTP Trigger');

            const body = event.body ? JSON.parse(event.body) : event;
            const { type, jobId, masterPrompt, personImageUrl, outputPath, videoDuration } = body;

            if (!jobId || !masterPrompt) {
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ success: false, error: 'jobId and masterPrompt are required' }),
                };
            }

            let resultUrl;
            if (type === 'trend-video') {
                resultUrl = await processTrendVideoJob(jobId, masterPrompt, personImageUrl, outputPath, videoDuration || 5);
            } else {
                resultUrl = await processTrendImageJob(jobId, masterPrompt, personImageUrl, outputPath);
            }

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: true, jobId, resultUrl, type: type || 'trend-photo' }),
            };
        }
    } catch (error) {
        console.error('❌ Trend Generation Lambda error:', error);

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: false, error: error.message || 'Processing failed' }),
        };
    }
};
