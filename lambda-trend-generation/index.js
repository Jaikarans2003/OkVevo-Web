const admin = require('firebase-admin');
const { GoogleGenAI } = require('@google/genai');
const { fal } = require('@fal-ai/client');
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

const NANOBANANA_MODEL = 'gemini-3.1-flash-image-preview';

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

async function generateTrendImage(masterPrompt, personImage = null, faceReferenceImage = null) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable not set');
    }

    const ai = new GoogleGenAI({ apiKey });

    const contentParts = [];

    if (personImage && faceReferenceImage) {
        // Dual reference mode: Use personImage for scene/pose/outfit, faceReferenceImage for facial features
        contentParts.push(
            { text: masterPrompt },
            { text: 'CRITICAL INSTRUCTION: You will receive TWO reference images.\n\nREFERENCE IMAGE 1 (Scene/Pose/Outfit): Use this for the overall scene composition, body pose, outfit, clothing, and background context.' },
            {
                inlineData: {
                    mimeType: 'image/png',
                    data: personImage.toString('base64'),
                },
            },
            { text: 'REFERENCE IMAGE 2 (Facial Features): Use this ONLY for the person\'s EXACT facial features, face shape, skin tone, eyes, nose, mouth, hair style, and hair color. DO NOT copy the pose, outfit, or background from this image.' },
            {
                inlineData: {
                    mimeType: 'image/png',
                    data: faceReferenceImage.toString('base64'),
                },
            },
            { text: 'Generate a stunning, photorealistic, cinematic photograph that:\n1. Uses the EXACT scene composition, pose, and outfit from Reference Image 1\n2. Uses the EXACT facial features and face from Reference Image 2\n3. Follows the camera framing specified in the text prompt\n\nThe person\'s face must be IDENTICAL to Reference Image 2, but everything else (pose, outfit, scene) must match Reference Image 1 and the text prompt.' }
        );
    } else if (personImage) {
        // Single reference mode: Use for everything
        contentParts.push(
            { text: masterPrompt },
            { text: 'CRITICAL INSTRUCTION: Here is a reference image. You MUST replicate the EXACT face, facial features, skin tone, hair style, hair color, eye color, facial structure, body type, outfit, and clothing from this reference image. DO NOT change, modify, or hallucinate ANY aspect of the person\'s appearance.\n\nThe reference image shows the EXACT person you must generate. Keep every detail of their appearance IDENTICAL - same face, same outfit, same physical characteristics.\n\nYou may ONLY change the camera angle, framing, and background as specified in the text prompt. The person themselves must look EXACTLY like the reference image.\n\nIf the text says "Close-up", generate a tight close-up of the EXACT same person from the reference image.' },
            {
                inlineData: {
                    mimeType: 'image/png',
                    data: personImage.toString('base64'),
                },
            },
            { text: 'Generate a stunning, photorealistic, cinematic photograph with the EXACT same person from the reference image. Only change the camera framing and background as specified in the prompt. The person must be IDENTICAL to the reference image.' }
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
// Fal AI API Helpers (Kling via Fal)
// ────────────────────────────────────────────────────

// Initialize Fal AI client
function initializeFalClient() {
    const apiKey = process.env.FAL_API_KEY;
    if (!apiKey) {
        throw new Error('FAL_API_KEY environment variable not set');
    }
    fal.config({ credentials: apiKey });
}

// ────────────────────────────────────────────────────
// Kling via Fal AI (Video Generation)
// ────────────────────────────────────────────────────

/**
 * Submit a Kling v2.6 Pro image-to-video task via Fal AI SDK.
 * Supports optional end frame for start-to-end transitions.
 * Used for Video 1 (transition video).
 */
async function generateKlingVideo(imageUrl, prompt, duration = 5, endFrameUrl = null) {
    console.log('\n🎥 Generating Kling v2.6 Pro video via Fal AI SDK...');
    console.log(`📝 Video prompt: ${prompt}`);
    console.log(`⏱️ Duration: ${duration}s`);
    console.log(`🖼️ Start frame: ${imageUrl}`);
    if (endFrameUrl) {
        console.log(`🖼️ End frame: ${endFrameUrl}`);
    }

    const input = {
        prompt: prompt,
        start_image_url: imageUrl,
        duration: duration === 10 ? '10' : '5',
        negative_prompt: 'blur, distort, and low quality',
        generate_audio: false,
    };

    // Add end frame if provided
    if (endFrameUrl) {
        input.end_image_url = endFrameUrl;
    }

    // Log the complete API request payload
    console.log('\n📦 KLING API REQUEST PAYLOAD:');
    console.log('   Model: fal-ai/kling-video/v2.6/pro/image-to-video');
    console.log('   Input Object:');
    console.log(`   ├─ prompt: "${input.prompt}"`);
    console.log(`   ├─ start_image_url: ${input.start_image_url ? '✅ SET' : '❌ NOT SET'}`);
    if (input.start_image_url) {
        console.log(`   │  └─ ${input.start_image_url.substring(0, 100)}...`);
    }
    console.log(`   ├─ end_image_url: ${input.end_image_url ? '✅ SET' : '⚪ NOT SET (optional)'}`);
    if (input.end_image_url) {
        console.log(`   │  └─ ${input.end_image_url.substring(0, 100)}...`);
    }
    console.log(`   ├─ duration: "${input.duration}"`);
    console.log(`   ├─ negative_prompt: "${input.negative_prompt}"`);
    console.log(`   └─ generate_audio: ${input.generate_audio}`);
    console.log('\n🚀 Sending request to Fal AI...\n');

    const result = await fal.subscribe('fal-ai/kling-video/v2.6/pro/image-to-video', {
        input,
        logs: true,
        onQueueUpdate: (update) => {
            if (update.status === 'IN_PROGRESS') {
                update.logs?.map((log) => log.message).forEach(console.log);
            }
        },
    });

    const videoUrl = result.data?.video?.url;
    if (!videoUrl) {
        throw new Error(`Kling video generation failed: ${JSON.stringify(result)}`);
    }

    console.log(`✅ Kling v2.6 Pro video ready: ${videoUrl}`);
    console.log(`📊 Request ID: ${result.requestId}`);
    return videoUrl;
}

/**
 * Generate video using Grok Imagine Video (xai) via Fal AI SDK.
 * Used for Videos 2-4 (levitation videos).
 * Strictly 3 seconds duration.
 */
async function generateGrokVideo(imageUrl, prompt) {
    console.log('\n🎥 Generating Grok Imagine Video (xai) via Fal AI SDK...');
    console.log(`📝 Video prompt: ${prompt}`);
    console.log(`⏱️ Duration: 3s (strict)`);
    console.log(`🖼️ Source image: ${imageUrl}`);

    const input = {
        prompt: prompt,
        duration: 3,
        aspect_ratio: '16:9',
        resolution: '720p',
        image_url: imageUrl,
    };

    // Log the complete API request payload
    console.log('\n📦 GROK API REQUEST PAYLOAD:');
    console.log('   Model: xai/grok-imagine-video/image-to-video');
    console.log('   Input Object:');
    console.log(`   ├─ prompt: "${input.prompt}"`);
    console.log(`   ├─ image_url: ${input.image_url ? '✅ SET' : '❌ NOT SET'}`);
    if (input.image_url) {
        console.log(`   │  └─ ${input.image_url.substring(0, 100)}...`);
    }
    console.log(`   ├─ duration: ${input.duration}`);
    console.log(`   ├─ aspect_ratio: "${input.aspect_ratio}"`);
    console.log(`   └─ resolution: "${input.resolution}"`);
    console.log('\n🚀 Sending request to Fal AI...\n');

    const result = await fal.subscribe('xai/grok-imagine-video/image-to-video', {
        input,
        logs: true,
        onQueueUpdate: (update) => {
            if (update.status === 'IN_PROGRESS') {
                update.logs?.map((log) => log.message).forEach(console.log);
            }
        },
    });

    const videoUrl = result.data?.video?.url;
    if (!videoUrl) {
        throw new Error(`Grok video generation failed: ${JSON.stringify(result)}`);
    }

    console.log(`✅ Grok Imagine Video ready: ${videoUrl}`);
    console.log(`📊 Request ID: ${result.requestId}`);
    return videoUrl;
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
async function generateAndUploadImage(prompt, personBuffer, outputPath, faceBuffer = null) {
    const imageBuffer = await generateTrendImage(prompt, personBuffer, faceBuffer);
    const publicUrl = await uploadToFirebase(imageBuffer, outputPath);
    console.log(`✅ Image uploaded: ${publicUrl}`);
    return { publicUrl, imageBuffer };
}

/**
 * Generate a single video from image URL, upload, return URL.
 * Video 1: Uses Kling v2.6 Pro (supports transitions)
 * Videos 2-4: Uses Grok Imagine Video (3s levitation)
 */
async function generateAndUploadVideo(videoPrompt, sourceImageUrl, outputPath, videoDuration, endImageUrl = null, videoIndex = 0) {
    let videoUrl;
    
    // Video 1 (index 0): Use Kling for transition effect
    if (videoIndex === 0) {
        videoUrl = await generateKlingVideo(sourceImageUrl, videoPrompt, videoDuration, endImageUrl);
    } 
    // Videos 2-4 (index 1-3): Use Grok for 3-second levitation
    else {
        videoUrl = await generateGrokVideo(sourceImageUrl, videoPrompt);
    }

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
        faceImageUrl,
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

    // Download person's reference images
    let personBuffer = null;
    let faceBuffer = null;
    
    if (personImageUrl) {
        console.log('📥 Downloading full body reference image...');
        personBuffer = await downloadFromFirebase(personImageUrl);
    }
    
    if (faceImageUrl) {
        console.log('📥 Downloading face reference image...');
        faceBuffer = await downloadFromFirebase(faceImageUrl);
    }

    // ── Phase 1: Generate all images ────────────────────────────
    await updateTrendDoc(jobId, { status: 'generating-images' });
    const imageUrls = [];

    for (let i = 0; i < imagePrompts.length; i++) {
        console.log(`\n📸 Image ${i + 1}/${imagePrompts.length} (index ${i})`);
        console.log(`   Output path: ${imageOutputPaths[i]}`);
        try {
            // Determine reference image based on sourceImageIndex and useFaceReference
            let refBuffer = personBuffer; // Default to user's full body photo
            let faceRefBuffer = null; // Optional face reference for dual-reference mode
            const promptConfig = imagePrompts[i];
            
            console.log(`   Prompt type: ${typeof promptConfig}`);
            if (typeof promptConfig === 'object') {
                console.log(`   Has sourceImageIndex: ${promptConfig.sourceImageIndex !== undefined}`);
                console.log(`   Has useFaceReference: ${promptConfig.useFaceReference === true}`);
            }
            
            if (typeof promptConfig === 'object' && promptConfig.sourceImageIndex !== undefined) {
                const refIndex = promptConfig.sourceImageIndex;
                if (imageUrls[refIndex]) {
                    // Download the previously generated image from Firebase Storage
                    console.log(`   Downloading generated image ${refIndex} from Firebase as reference`);
                    refBuffer = await downloadFromFirebase(imageUrls[refIndex]);
                    console.log(`   Using generated image ${refIndex} as primary reference`);
                } else {
                    console.log(`   Reference image ${refIndex} not yet generated, using user photo`);
                }
                
                // If useFaceReference is true and we have a face photo, use it as secondary reference
                if (promptConfig.useFaceReference && faceBuffer) {
                    console.log(`   ✨ Using face reference photo as secondary reference for facial features only`);
                    faceRefBuffer = faceBuffer;
                }
            } else {
                console.log(`   Using user's uploaded full body photo as reference`);
            }

            const promptText = typeof promptConfig === 'string' ? promptConfig : promptConfig.prompt;
            console.log(`   Prompt length: ${promptText.length} chars`);
            
            const result = await generateAndUploadImage(
                promptText,
                refBuffer,
                imageOutputPaths[i],
                faceRefBuffer
            );

            const url = result.publicUrl;
            imageUrls.push(url);
            console.log(`   ✅ Stored at imageUrls[${imageUrls.length - 1}]: ${url}`);

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
            console.error(`❌ Image ${i} (index ${i}) FAILED`);
            console.error(`   Error message: ${err.message}`);
            console.error(`   Error stack: ${err.stack}`);
            console.error(`   Full error:`, err);
            imageUrls.push(null);
            console.log(`   ⚠️ Pushed null to imageUrls[${imageUrls.length - 1}]`);
        }
    }
    
    console.log(`\n📊 Image Generation Summary:`);
    imageUrls.forEach((url, idx) => {
        console.log(`   imageUrls[${idx}]: ${url ? 'SUCCESS' : 'FAILED/NULL'}`);
    });

    console.log(`\n✅ Images done: ${imageUrls.filter(Boolean).length}/${imagePrompts.length}`);

    // ── Phase 2: Generate all videos ────────────────────────────
    await updateTrendDoc(jobId, { status: 'generating-videos' });
    const videoResultUrls = [];

    for (let i = 0; i < videoPrompts.length; i++) {
        const { prompt, sourceImageIndex, endImageIndex, duration } = videoPrompts[i];
        const sourceImageUrl = imageUrls[sourceImageIndex];
        const endImageUrl = endImageIndex !== undefined ? imageUrls[endImageIndex] : null;
        const videoLength = duration || videoDuration; // Use per-video duration or trend default

        console.log(`\n${'─'.repeat(60)}`);
        console.log(`🎥 Video ${i + 1}/${videoPrompts.length}`);
        console.log(`   Prompt: "${prompt}"`);
        console.log(`   Duration: ${videoLength}s`);
        console.log(`   Source Image Index: ${sourceImageIndex}`);
        console.log(`   End Image Index: ${endImageIndex !== undefined ? endImageIndex : 'N/A'}`);
        console.log(`   Source Image URL: ${sourceImageUrl ? '✅ AVAILABLE' : '❌ MISSING'}`);
        if (sourceImageUrl) {
            console.log(`   Source URL: ${sourceImageUrl.substring(0, 80)}...`);
        }
        if (endImageIndex !== undefined) {
            console.log(`   End Image URL: ${endImageUrl ? '✅ AVAILABLE' : '❌ MISSING'}`);
            if (endImageUrl) {
                console.log(`   End URL: ${endImageUrl.substring(0, 80)}...`);
            }
        }

        // Validation: First video (Video 1) MUST have both start and end images
        if (i === 0) {
            console.log(`\n🔍 VIDEO 1 VALIDATION CHECK:`);
            console.log(`   ├─ Checking start_image_url (imageUrls[${sourceImageIndex}]): ${sourceImageUrl ? '✅ PASS' : '❌ FAIL'}`);
            console.log(`   ├─ Checking end_image_url (imageUrls[${endImageIndex}]): ${endImageUrl ? '✅ PASS' : '❌ FAIL'}`);
            console.log(`   └─ endImageIndex defined: ${endImageIndex !== undefined ? '✅ YES' : '❌ NO'}`);
            
            if (!sourceImageUrl || !endImageUrl) {
                console.error(`\n❌ VIDEO 1 VALIDATION FAILED - Missing required images`);
                console.error(`   ├─ start_image_url (image ${sourceImageIndex}): ${sourceImageUrl ? 'AVAILABLE ✅' : 'MISSING ❌'}`);
                console.error(`   ├─ end_image_url (image ${endImageIndex}): ${endImageUrl ? 'AVAILABLE ✅' : 'MISSING ❌'}`);
                console.error(`   └─ Video 1 REQUIRES both images for transition effect`);
                console.error(`\n⚠️ Skipping Video 1 generation due to missing images\n`);
                videoResultUrls.push(null);
                continue;
            }
            console.log(`   ✅ Video 1 validation PASSED - Both images available\n`);
        } else {
            // Other videos only need start image
            console.log(`\n🔍 VIDEO ${i + 1} VALIDATION CHECK:`);
            console.log(`   └─ Checking start_image_url (imageUrls[${sourceImageIndex}]): ${sourceImageUrl ? '✅ PASS' : '❌ FAIL'}`);
            
            if (!sourceImageUrl) {
                console.warn(`\n⚠️ Video ${i + 1}: source image ${sourceImageIndex} missing, skipping\n`);
                videoResultUrls.push(null);
                continue;
            }
            console.log(`   ✅ Video ${i + 1} validation PASSED\n`);
        }
        try {
            const url = await generateAndUploadVideo(
                prompt,
                sourceImageUrl,
                videoOutputPaths[i],
                videoLength,
                endImageUrl,
                i  // Pass video index to determine which model to use
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
            audioUrl = 'gs://text2video-16cbf.firebasestorage.app/TrendsAudio/Skyfall.mp3';
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
        initializeFalClient();

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
