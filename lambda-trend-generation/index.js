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

const NANOBANANA_MODEL = 'gemini-3-pro-image-preview';
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
// Firestore Helpers
// ────────────────────────────────────────────────────

const TREND_COLLECTION = 'trendGenerations';

async function updateTrendDoc(docId, fields) {
    try {
        const firestore = admin.firestore();
        await firestore.collection(TREND_COLLECTION).doc(docId).update(fields);
        console.log(`📝 Firestore updated: ${docId} →`, Object.keys(fields));
    } catch (err) {
        console.warn(`⚠️ Firestore update failed for ${docId}:`, err.message);
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
            { text: 'CRITICAL INSTRUCTION: Here is a reference image. You MUST extract ONLY the character identity (face, race, gender), the specific clothing they are wearing, and the lighting/color palette.\n\nDO NOT copy the camera angle or framing of this reference image. The text prompt above is the absolute authority on the camera shot.\nIf the text says "Close-up", you MUST generate a tight close-up and completely exclude the rest of the body.\nFailure to follow the text prompt\'s framing will cause the generation to be rejected.' },
            {
                inlineData: {
                    mimeType: 'image/png',
                    data: personImage.toString('base64'),
                },
            },
            { text: 'Generate a stunning, photorealistic, cinematic photograph based strictly on the text prompt\'s framing, using the image ONLY for character/clothing reference.' }
        );
    } else {
        contentParts.push({
            text: masterPrompt + '\n\nGenerate a stunning, photorealistic, cinematic photograph matching the exact framing of the prompt.',
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
            console.log('🔍 Checking for video URL in response...');
            console.log(`   Full response: ${JSON.stringify(response)}`);

            // Extract video URL from various possible response structures
            let videoUrl = null;

            if (response.video && typeof response.video === 'object' && response.video.url) {
                videoUrl = response.video.url;
                console.log(`   ✓ Found URL in response.video.url: ${videoUrl}`);
            } else if (response.video && typeof response.video === 'string') {
                videoUrl = response.video;
                console.log(`   ✓ Found URL in response.video (string): ${videoUrl}`);
            } else if (response.video_url) {
                videoUrl = response.video_url;
                console.log(`   ✓ Found URL in response.video_url: ${videoUrl}`);
            } else if (response.output && response.output.video_url) {
                videoUrl = response.output.video_url;
                console.log(`   ✓ Found URL in response.output.video_url: ${videoUrl}`);
            } else if (response.data && response.data.task_result && response.data.task_result.videos && response.data.task_result.videos[0]) {
                videoUrl = response.data.task_result.videos[0].url;
                console.log(`   ✓ Found URL in response.data.task_result.videos[0].url: ${videoUrl}`);
            } else if (response.generations && response.generations[0] && response.generations[0].video) {
                videoUrl = response.generations[0].video.url || response.generations[0].video;
                console.log(`   ✓ Found URL in response.generations[0].video: ${videoUrl}`);
            } else if (response.videos && response.videos[0]) {
                videoUrl = response.videos[0].url || response.videos[0];
                console.log(`   ✓ Found URL in response.videos[0]: ${videoUrl}`);
            }

            if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.startsWith('http')) {
                console.error('❌ Video completed but no valid URL found. Full response:', JSON.stringify(response, null, 2));
                throw new Error(`Video completed but no valid URL found: ${JSON.stringify(response)}`);
            }
            console.log(`✅ Video ready: ${videoUrl}`);
            return videoUrl;
        }

        if (status === 'failed' || status === 'error') {
            console.error('❌ AIML video failed — full response:', JSON.stringify(response, null, 2));
            let failReason = response.error || response.message || 'Unknown failure';
            if (typeof failReason === 'object') failReason = JSON.stringify(failReason);
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
 * Generate a single image, upload, return URL.
 */
async function generateAndUploadImage(prompt, personBuffer, outputPath) {
    const imageBuffer = await generateTrendImage(prompt, personBuffer);
    const publicUrl = await uploadToFirebase(imageBuffer, outputPath);
    console.log(`✅ Image uploaded: ${publicUrl}`);
    return { publicUrl, imageBuffer };
}

/**
 * Generate a single video from image URL, upload, return URL.
 */
async function generateAndUploadVideo(videoPrompt, sourceImageUrl, outputPath, videoDuration) {
    const taskId = await submitKlingVideoTask(sourceImageUrl, videoPrompt, videoDuration);
    const videoUrl = await pollKlingTask(taskId);

    console.log('📥 Downloading generated video...');
    const videoBuffer = await downloadUrl(videoUrl);
    const publicUrl = await uploadToFirebase(videoBuffer, outputPath, 'video/mp4');
    console.log(`✅ Video uploaded: ${publicUrl}`);
    return publicUrl;
}

/**
 * Dispatch a stitching job to the stitch SQS queue.
 */
async function dispatchStitchJob(jobId, videoUrls, audioUrl) {
    const https = require('https');
    const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

    const queueUrl = process.env.SQS_STITCHING_QUEUE_URL;
    if (!queueUrl) {
        console.warn('⚠️ SQS_STITCHING_QUEUE_URL not set — skipping stitch dispatch');
        return;
    }

    // Lambda's execution role provides credentials automatically
    const sqsClient = new SQSClient({
        region: process.env.AWS_REGION || 'us-east-1',
    });

    const messageBody = JSON.stringify({
        jobId: `stitch-${jobId}`,
        videoUrls,
        audioUrl,
        trendJobId: jobId, // So stitch Lambda can update the trend Firestore doc
        timestamp: new Date().toISOString(),
    });

    const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: messageBody,
        MessageGroupId: jobId,
        MessageDeduplicationId: `stitch-${jobId}-${Date.now()}`,
    });

    const result = await sqsClient.send(command);
    console.log(`✅ Stitch job dispatched: ${result.MessageId}`);
}

/**
 * Process a full trend pipeline:
 *   1. Generate all images sequentially
 *   2. Generate all videos sequentially
 *   3. Dispatch stitch job
 */
async function processTrendPipeline(body) {
    const {
        jobId,
        trendId,
        personImageUrl,
        imagePrompts,
        videoPrompts,
        imageOutputPaths,
        videoOutputPaths,
        videoDuration = 5,
    } = body;

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🎬 PIPELINE: ${jobId}`);
    console.log(`   Trend: ${trendId || 'unknown'}`);
    console.log(`   ${imagePrompts.length} images + ${videoPrompts.length} videos`);
    console.log(`${'═'.repeat(60)}`);

    // Download person's reference image once
    let personBuffer = null;
    if (personImageUrl) {
        console.log('📥 Downloading person reference image...');
        personBuffer = await downloadFromFirebase(personImageUrl);
    }

    // ── Phase 1: Generate all images ────────────────────────────
    await updateTrendDoc(jobId, { status: 'generating-images' });
    const imageUrls = [];

    for (let i = 0; i < imagePrompts.length; i++) {
        console.log(`\n📸 Image ${i + 1}/${imagePrompts.length}`);
        try {
            // ALL images use the ORIGINAL uploaded person photo.
            // Using the user's uploaded selfie for ALL generations prevents the AI from 
            // locking into a full-body composition that was hallucinated in photo 1.
            const refBuffer = personBuffer;

            const result = await generateAndUploadImage(
                imagePrompts[i],
                refBuffer,
                imageOutputPaths[i]
            );

            const url = result.publicUrl;
            imageUrls.push(url);

            // Update Firestore — set this image slot's url
            const firestore = admin.firestore();
            const docRef = firestore.collection(TREND_COLLECTION).doc(jobId);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                const images = docSnap.data().images || [];
                if (images[i]) {
                    images[i].url = url;
                    await docRef.update({ images });
                }
            }
        } catch (err) {
            console.error(`❌ Image ${i} failed:`, err.message);
            imageUrls.push(null);
        }
    }

    console.log(`\n✅ Images done: ${imageUrls.filter(Boolean).length}/${imagePrompts.length}`);

    // ── Phase 2: Generate all videos ────────────────────────────
    await updateTrendDoc(jobId, { status: 'generating-videos' });
    const videoResultUrls = [];

    for (let i = 0; i < videoPrompts.length; i++) {
        const { prompt, sourceImageIndex } = videoPrompts[i];
        const sourceImageUrl = imageUrls[sourceImageIndex];

        if (!sourceImageUrl) {
            console.warn(`⚠️ Video ${i}: source image ${sourceImageIndex} missing, skipping`);
            videoResultUrls.push(null);
            continue;
        }

        console.log(`\n🎥 Video ${i + 1}/${videoPrompts.length} (from image ${sourceImageIndex})`);
        try {
            const url = await generateAndUploadVideo(
                prompt,
                sourceImageUrl,
                videoOutputPaths[i],
                videoDuration
            );
            videoResultUrls.push(url);

            // Update Firestore — set this video slot's url
            const firestore = admin.firestore();
            const docRef = firestore.collection(TREND_COLLECTION).doc(jobId);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                const videos = docSnap.data().videos || [];
                if (videos[i]) {
                    videos[i].url = url;
                    await docRef.update({ videos });
                }
            }
        } catch (err) {
            console.error(`❌ Video ${i} failed:`, err.message);
            videoResultUrls.push(null);
        }
    }

    console.log(`\n✅ Videos done: ${videoResultUrls.filter(Boolean).length}/${videoPrompts.length}`);

    // ── Phase 3: Dispatch stitch job ────────────────────────────
    const validVideoUrls = videoResultUrls.filter(Boolean);
    if (validVideoUrls.length >= 2) {
        await updateTrendDoc(jobId, { status: 'stitching' });
        
        // Select audio based on trend ID
        let audioUrl;
        if (trendId === 'sky-fall') {
            audioUrl = 'gs://text2video-16cbf.firebasestorage.app/TrendsAudio/Skyfall.mp3';
            console.log(`🎵 Using Skyfall audio for trend: ${trendId}`);
        } else {
            audioUrl = 'gs://text2video-16cbf.firebasestorage.app/TrendsAudio/TrendsAudio.mpeg';
            console.log(`🎵 Using generic audio for trend: ${trendId || 'unknown'}`);
        }
        
        await dispatchStitchJob(jobId, validVideoUrls, audioUrl);
    } else {
        // Not enough videos to stitch — mark complete with what we have
        console.warn('⚠️ Not enough videos for stitching, marking complete');
        await updateTrendDoc(jobId, { status: 'complete' });
    }
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
                const { type, jobId } = body;

                if (!jobId) {
                    console.error('❌ Invalid SQS message: missing jobId');
                    continue;
                }

                try {
                    if (type === 'trend-pipeline') {
                        await processTrendPipeline(body);
                    } else {
                        console.warn(`⚠️ Unknown job type: ${type}`);
                    }
                } catch (jobError) {
                    console.error(`❌ Job ${jobId} failed:`, jobError);
                    await updateTrendDoc(jobId, {
                        status: 'error',
                        errorMessage: jobError.message || 'Generation failed',
                    });
                }
            }

            return { statusCode: 200, body: 'Trend generation SQS processing complete' };

        } else {
            // ═══════ HTTP TRIGGER (Testing) ═══════
            console.log('🔹 HTTP Trigger — use SQS for pipeline');

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ success: true, message: 'Use SQS trigger for pipeline jobs' }),
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
