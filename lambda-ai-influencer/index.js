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
            // Log full response so we can see the exact structure
            console.log('📦 Fal AI COMPLETED response:', JSON.stringify(status, null, 2));

            // Fal AI queue API can return the result in several locations depending on version:
            // status.response.video.url  (most common for queue.fal.run)
            // status.output.video.url
            // status.video.url
            // status.response.url        (some models return direct URL)
            // status.response itself     (if it is a string URL)
            const videoUrl =
                status.response?.video?.url ||
                status.output?.video?.url ||
                status.video?.url ||
                status.response?.url ||
                (typeof status.response === 'string' ? status.response : null);

            if (!videoUrl) {
                console.error('❌ Could not find video URL. Full status:', JSON.stringify(status));
                throw new Error('No video URL in Fal AI response');
            }
            console.log('🎥 Video URL extracted: ' + videoUrl);
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

// ────────────────────────────────────────────────────
// ffmpeg Image Overlay Compositor
// ────────────────────────────────────────────────────

const { spawn } = require('child_process');
const FFMPEG = '/opt/bin/ffmpeg';

/**
 * Composite images over a video using ffmpeg.
 * Layout A (split): image top half, avatar video bottom half
 * Layout B (fullscreen): image covers full frame for duration
 *
 * @param {string} videoPath  - Local path to lip-synced video
 * @param {Array}  images     - [{ localPath, start, end, layout }]
 * @param {string} outputPath - Where to write composited video
 */
function compositeImagesOnVideo(videoPath, images, outputPath) {
    return new Promise((resolve, reject) => {
        if (!images || images.length === 0) {
            // Nothing to composite — just return
            fs.copyFileSync(videoPath, outputPath);
            return resolve();
        }

        console.log(`🖼️ Compositing ${images.length} images onto video...`);

        // Build filter_complex
        // Video resolution: 360×640 (portrait)
        // Split: top 320px = image, bottom 320px = video
        // Full: entire 360×640 = image (overlay)

        const args = ['-i', videoPath];
        images.forEach((img) => args.push('-i', img.localPath));

        let filterComplex = '[0:v]scale=360:640:force_original_aspect_ratio=increase,crop=360:640,fps=30,format=yuv420p[base];';

        images.forEach((img, idx) => {
            const inputIdx = idx + 1;
            const timeEnable = `between(t,${img.start},${img.end})`;

            if (img.layout === 'fullscreen') {
                // Scale image to full 360×640 with fade in/out
                filterComplex += `[${inputIdx}:v]scale=360:640:force_original_aspect_ratio=increase,crop=360:640,fps=30,format=yuv420p,fade=t=in:st=${img.start}:d=0.3:alpha=1,fade=t=out:st=${img.end - 0.3}:d=0.3:alpha=1[img${idx}];`;
            } else {
                // Split screen: image scaled to top 320px
                filterComplex += `[${inputIdx}:v]scale=360:320:force_original_aspect_ratio=increase,crop=360:320,fps=30,format=yuv420p,fade=t=in:st=${img.start}:d=0.3:alpha=1,fade=t=out:st=${img.end - 0.3}:d=0.3:alpha=1[img${idx}];`;
            }
        });

        // Chain overlays
        let prevLabel = 'base';
        images.forEach((img, idx) => {
            const timeEnable = `between(t,${img.start},${img.end})`;
            const outLabel = idx === images.length - 1 ? 'outv' : `tmp${idx}`;
            const yPos = img.layout === 'fullscreen' ? '0' : '0'; // image always starts at top

            filterComplex += `[${prevLabel}][img${idx}]overlay=0:${yPos}:enable='${timeEnable}'[${outLabel}];`;
            prevLabel = outLabel;
        });

        // Remove trailing semicolon
        filterComplex = filterComplex.replace(/;$/, '');

        const ffmpegArgs = [
            ...args,
            '-filter_complex', filterComplex,
            '-map', '[outv]',
            '-map', '0:a',
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '22',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            '-y',
            outputPath
        ];

        console.log('🎬 Running ffmpeg compositor...');
        const ffmpeg = spawn(FFMPEG, ffmpegArgs);

        let stderr = '';
        ffmpeg.stderr.on('data', (d) => { stderr += d.toString(); });
        ffmpeg.on('close', (code) => {
            if (code === 0) {
                console.log('✅ ffmpeg compositing complete');
                resolve();
            } else {
                console.error('❌ ffmpeg compositor failed. Last stderr:', stderr.slice(-500));
                reject(new Error(`ffmpeg compositor exited with code ${code}`));
            }
        });
        ffmpeg.on('error', reject);
    });
}

// ────────────────────────────────────────────────────
// Main Pipeline (4 phases)
// ────────────────────────────────────────────────────

async function processLipSyncPipeline(body) {
    const { jobId, avatarVideoUrl, audioUrl, imageTimeline } = body;

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🎬 LIPSYNC PIPELINE: ${jobId}`);
    console.log(`   Avatar Video: ${avatarVideoUrl}`);
    console.log(`   Audio: ${audioUrl}`);
    console.log(`   Image Timeline: ${imageTimeline?.length || 0} images`);
    console.log(`${'═'.repeat(60)}`);

    // Phase 1: Generate LipSync Video with Fal AI
    await updateJobDoc(jobId, { status: 'generating-lipsync' });
    const lipSyncVideoUrl = await generateLipSyncVideo(avatarVideoUrl, audioUrl);

    // Phase 2: Download lip-synced video
    await updateJobDoc(jobId, { status: 'downloading' });
    const videoBuffer = await downloadFromUrl(lipSyncVideoUrl);
    const lipSyncPath = `/tmp/${jobId}-lipsync.mp4`;
    fs.writeFileSync(lipSyncPath, videoBuffer);
    console.log(`✅ LipSync video saved: ${lipSyncPath}`);

    let finalPath = lipSyncPath;

    // Phase 3 (optional): Download images and composite
    if (imageTimeline && imageTimeline.length > 0) {
        await updateJobDoc(jobId, { status: 'compositing' });

        const validImages = imageTimeline.filter(img => img.imageUrl);
        const downloadedImages = [];

        for (let i = 0; i < validImages.length; i++) {
            const img = validImages[i];
            try {
                const imgBuffer = await downloadFromUrl(img.imageUrl);
                const imgPath = `/tmp/${jobId}-img-${i}.jpg`;
                fs.writeFileSync(imgPath, imgBuffer);
                downloadedImages.push({
                    localPath: imgPath,
                    start: img.start,
                    end: img.end,
                    layout: img.layout || 'split',
                });
                console.log(`✅ Image ${i + 1}/${validImages.length} downloaded: ${img.topic}`);
            } catch (err) {
                console.warn(`⚠️ Skipping image ${i} (${img.topic}): ${err.message}`);
            }
        }

        if (downloadedImages.length > 0) {
            finalPath = `/tmp/${jobId}-composited.mp4`;
            try {
                await compositeImagesOnVideo(lipSyncPath, downloadedImages, finalPath);
            } catch (err) {
                console.warn(`⚠️ Compositing failed, using raw lipsync: ${err.message}`);
                finalPath = lipSyncPath;
            }

            // Cleanup image files
            downloadedImages.forEach(img => {
                try { fs.unlinkSync(img.localPath); } catch (_) { }
            });
        }
    }

    // Phase 4: Upload to Firebase
    await updateJobDoc(jobId, { status: 'uploading' });
    const finalBuffer = fs.readFileSync(finalPath);
    const finalVideoPath = `AIInfluencer/${jobId}/final.mp4`;
    const finalVideoUrl = await uploadToFirebase(finalBuffer, finalVideoPath, 'video/mp4');

    // Cleanup temp files
    [lipSyncPath, `/tmp/${jobId}-composited.mp4`].forEach(p => {
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) { }
    });

    // Phase 5: Mark Complete
    await updateJobDoc(jobId, {
        status: 'complete',
        finalVideoUrl,
        imageCount: imageTimeline?.length || 0,
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
