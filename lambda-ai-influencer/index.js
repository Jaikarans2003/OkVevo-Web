const admin = require('firebase-admin');
const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * AWS Lambda Handler for AI Influencer LipSync Video Generation
 *
 * 3-Phase Pipeline:
 *   1. Download avatar video and TTS audio from Firebase
 *   2. Generate LipSync video using Fal AI veed/lipsync
 *   3. Upload final video to Firebase Storage
 *
 * Trigger: SQS FIFO Queue (ai-influencer.fifo)
 */

const FAL_API_BASE = 'https://queue.fal.run';
const JOBS_COLLECTION = 'aiInfluencerJobs';

let firebaseInitialized = false;

function initializeFirebase() {
    if (firebaseInitialized) return;

    try {
        const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!serviceAccountBase64) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY not set');
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

async function updateJobDoc(jobId, fields) {
    try {
        const firestore = admin.firestore();
        await firestore.collection(JOBS_COLLECTION).doc(jobId).update({
            ...fields,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`📝 Firestore updated: ${jobId} →`, Object.keys(fields));
    } catch (err) {
        console.warn(`⚠️ Firestore update failed for ${jobId}:`, err.message);
    }
}

// ────────────────────────────────────────────────────
// HTTP Request Helper
// ────────────────────────────────────────────────────

function httpsRequest(url, options = {}, body = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                if (res.headers['content-type']?.includes('application/json')) {
                    try {
                        resolve({ statusCode: res.statusCode, body: JSON.parse(buffer.toString()), buffer });
                    } catch {
                        resolve({ statusCode: res.statusCode, body: buffer.toString(), buffer });
                    }
                } else {
                    resolve({ statusCode: res.statusCode, body: buffer.toString(), buffer });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
        req.end();
    });
}

// ────────────────────────────────────────────────────
// Fal AI veed/lipsync Integration
// ────────────────────────────────────────────────────

async function generateLipSyncVideo(videoUrl, audioUrl) {
    const apiKey = process.env.FAL_API_KEY;
    if (!apiKey) {
        throw new Error('FAL_API_KEY not set');
    }

    console.log('🎬 Calling Fal AI veed/lipsync...');
    console.log(`   Video URL: ${videoUrl}`);
    console.log(`   Audio URL: ${audioUrl}`);

    // Submit job to Fal AI queue
    const submitUrl = `${FAL_API_BASE}/veed/lipsync`;
    const submitResponse = await httpsRequest(submitUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Key ${apiKey}`,
            'Content-Type': 'application/json',
        }
    }, {
        video_url: videoUrl,
        audio_url: audioUrl
    });

    if (submitResponse.statusCode !== 200) {
        console.error('❌ Fal AI submit failed:', submitResponse.body);
        throw new Error(`Fal AI submit failed: ${submitResponse.statusCode}`);
    }

    const { request_id } = submitResponse.body;
    console.log(`✅ Fal AI job submitted: ${request_id}`);

    // Poll for completion
    const statusUrl = `${FAL_API_BASE}/veed/lipsync/requests/${request_id}/status`;
    let attempts = 0;
    const maxAttempts = 180; // 15 minutes max (5s intervals)

    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        attempts++;

        const statusResponse = await httpsRequest(statusUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Key ${apiKey}`,
            }
        });

        if (statusResponse.statusCode !== 200) {
            console.warn(`⚠️ Status check failed (attempt ${attempts}):`, statusResponse.body);
            continue;
        }

        const status = statusResponse.body;
        console.log(`🔄 Fal AI status (attempt ${attempts}): ${status.status}`);

        if (status.status === 'COMPLETED') {
            console.log('✅ Fal AI lipsync completed!');
            const videoUrl = status.video?.url || status.output?.video?.url;
            if (!videoUrl) {
                throw new Error('No video URL in Fal AI response');
            }
            return videoUrl;
        }

        if (status.status === 'FAILED') {
            throw new Error(`Fal AI job failed: ${status.error || 'Unknown error'}`);
        }
    }

    throw new Error('Fal AI job timed out after 15 minutes');
}

// ────────────────────────────────────────────────────
// Download from URL
// ────────────────────────────────────────────────────

async function downloadFromUrl(url) {
    console.log(`📥 Downloading from URL: ${url}`);
    const response = await httpsRequest(url, { method: 'GET' });
    if (response.statusCode !== 200) {
        throw new Error(`Download failed: ${response.statusCode}`);
    }
    console.log(`✅ Downloaded ${response.buffer.length} bytes`);
    return response.buffer;
}

// ────────────────────────────────────────────────────
// Upload to Firebase Storage
// ────────────────────────────────────────────────────

async function uploadToFirebase(buffer, storagePath, contentType) {
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);

    await file.save(buffer, {
        metadata: { contentType },
    });

    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    console.log(`✅ Uploaded to Firebase: ${publicUrl}`);
    return publicUrl;
}

// ────────────────────────────────────────────────────
// Main Pipeline
// ────────────────────────────────────────────────────

async function processLipSyncPipeline(body) {
    const { jobId, avatarVideoUrl, audioUrl } = body;

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🎬 LIPSYNC PIPELINE: ${jobId}`);
    console.log(`   Avatar Video: ${avatarVideoUrl}`);
    console.log(`   Audio: ${audioUrl}`);
    console.log(`${'═'.repeat(60)}`);

    // Phase 1: Generate LipSync Video with Fal AI
    await updateJobDoc(jobId, { status: 'generating-lipsync' });
    const lipSyncVideoUrl = await generateLipSyncVideo(avatarVideoUrl, audioUrl);

    // Phase 2: Download and Upload to Firebase
    await updateJobDoc(jobId, { status: 'uploading' });
    const videoBuffer = await downloadFromUrl(lipSyncVideoUrl);
    const finalVideoPath = `AIInfluencer/${jobId}/final.mp4`;
    const finalVideoUrl = await uploadToFirebase(videoBuffer, finalVideoPath, 'video/mp4');

    // Phase 3: Mark Complete
    await updateJobDoc(jobId, {
        status: 'complete',
        finalVideoUrl,
    });

    console.log(`\n✅ PIPELINE COMPLETE: ${jobId}`);
    console.log(`   Final Video: ${finalVideoUrl}`);
}

// ────────────────────────────────────────────────────
// Lambda Handler
// ────────────────────────────────────────────────────

exports.handler = async (event) => {
    initializeFirebase();

    for (const record of event.Records) {
        try {
            const body = JSON.parse(record.body);
            console.log('📨 Received SQS message:', body.type);

            if (body.type === 'ai-influencer-lipsync') {
                await processLipSyncPipeline(body);
            } else {
                console.warn(`⚠️ Unknown message type: ${body.type}`);
            }
        } catch (error) {
            console.error('❌ Pipeline error:', error);
            const body = JSON.parse(record.body);
            if (body.jobId) {
                await updateJobDoc(body.jobId, {
                    status: 'error',
                    errorMessage: error.message,
                });
            }
            throw error;
        }
    }

    return { statusCode: 200, body: 'OK' };
};
