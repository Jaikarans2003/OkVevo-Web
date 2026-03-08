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
        await firestore.collection(JOBS_COLLECTION).doc(jobId).set({
            ...fields,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
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
        const parsedUrl = new URL(url);
        const reqOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: options.headers || {},
        };

        const req = https.request(reqOptions, (res) => {
            // Follow redirects (301, 302, 303, 307, 308)
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                console.log(`↩️ Redirect ${res.statusCode} -> ${res.headers.location}`);
                return httpsRequest(res.headers.location, { method: 'GET' }, null)
                    .then(resolve)
                    .catch(reject);
            }

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
// Subtitle Generation (Gemini 1.5 Flash)
// ────────────────────────────────────────────────────

async function generateSubtitlesFromAudio(audioUrl, jobId) {
    console.log(`🎬 Generating subtitles from audio using Gemini: ${audioUrl}`);
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
        console.warn('⚠️ GEMINI_API_KEY not set. Skipping subtitles.');
        return null;
    }

    try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Download the audio buffer directly
        const audioBuffer = await downloadFromUrl(audioUrl);

        const prompt = `You are an expert transcriber. Listen to this audio and generate perfectly synced, highly accurate subtitles.
        
CRITICAL RULES:
1. Output ONLY the raw SRT file content.
2. Do NOT wrap the output in markdown code blocks like \`\`\`srt \`\`\` or \`\`\`.
3. Format exactly as a standard SRT file (Sequence Number, Timecodes, Text separated by blank lines).
4. Timecodes must use a comma, e.g., 00:00:01,000 --> 00:00:03,500.
5. Keep captions short and punchy (max 4-5 words per line). Provide exact word-level or phrase-level pacing.`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: "audio/mp3",
                    data: audioBuffer.toString("base64")
                }
            }
        ]);

        let srtText = result.response.text().trim();

        console.log(`💬 Gemini raw subtitle output (first 100 chars):`, srtText.substring(0, 100));

        // Strip markdown if Gemini ignores instructions
        if (srtText.startsWith('```')) {
            const lines = srtText.split('\n');
            if (lines.length > 2) {
                srtText = lines.slice(1, -1).join('\n').trim();
            }
        }

        // Validate it looks like an SRT file (must have timecode arrows)
        if (!srtText.includes('-->')) {
            console.warn('⚠️ Subtitle generation returned invalid SRT format (missing "-->"). Skipping subtitles.');
            return null; // Fail gracefully
        }

        const srtPath = `/tmp/${jobId}-captions.srt`;
        fs.writeFileSync(srtPath, srtText);
        console.log(`✅ Subtitles written to ${srtPath} (${srtText.split('\n').length} lines)`);
        return srtPath;
    } catch (err) {
        console.error('❌ Subtitle generation failed:', err.message);
        return null; // Fail gracefully
    }
}

// ────────────────────────────────────────────────────
// TEST MODE - Set to true to skip Fal AI and use hardcoded video
// ────────────────────────────────────────────────────
const TEST_MODE = false;
const TEST_VIDEO_URL = 'https://firebasestorage.googleapis.com/v0/b/text2video-16cbf.firebasestorage.app/o/final.mp4?alt=media&token=ea3eda9d-0e59-433d-bc85-8d8b16883f62';

// ────────────────────────────────────────────────────
// Fal AI veed/lipsync Integration
// ────────────────────────────────────────────────────

async function generateLipSyncVideo(videoUrl, audioUrl) {
    // TEST MODE: Skip Fal AI and return hardcoded video URL
    if (TEST_MODE) {
        console.log('🧪 TEST MODE: Skipping Fal AI, using hardcoded video URL');
        console.log(`   Test Video: ${TEST_VIDEO_URL} `);
        return TEST_VIDEO_URL;
    }

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
            console.log('📦 Fal AI COMPLETED response:', JSON.stringify(status, null, 2));

            // When status is COMPLETED, we need to fetch the actual result from response_url
            console.log('📥 Fetching result from response_url:', status.response_url);

            const resultResponse = await httpsRequest(status.response_url, {
                method: 'GET',
                headers: {
                    'Authorization': `Key ${apiKey}`,
                }
            });

            if (resultResponse.statusCode !== 200) {
                console.error('❌ Failed to fetch result:', resultResponse.body);
                throw new Error('Failed to fetch Fal AI result');
            }

            const result = resultResponse.body;
            console.log('📦 Fal AI result data:', JSON.stringify(result, null, 2));

            // Extract video URL from result - try multiple paths
            let videoUrl = null;

            // Check if result itself is the video data
            if (result.video?.url) {
                videoUrl = result.video.url;
                console.log('✓ Found video URL at result.video.url');
            } else if (result.data?.video?.url) {
                videoUrl = result.data.video.url;
                console.log('✓ Found video URL at result.data.video.url');
            } else if (result.output?.video?.url) {
                videoUrl = result.output.video.url;
                console.log('✓ Found video URL at result.output.video.url');
            } else if (result.url && typeof result.url === 'string') {
                videoUrl = result.url;
                console.log('✓ Found video URL at result.url');
            } else if (typeof result === 'string' && result.startsWith('http')) {
                videoUrl = result;
                console.log('✓ Result is a direct URL string');
            }

            if (!videoUrl) {
                console.error('❌ Could not find video URL. Full result:', JSON.stringify(result, null, 2));
                console.error('Available keys in result:', Object.keys(result));
                throw new Error('No video URL in Fal AI result');
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
// Download from Firebase Storage Directly
// ────────────────────────────────────────────────────

async function downloadFromFirebaseStorage(storagePath) {
    console.log(`📥 Downloading from Firebase Storage: ${storagePath}`);
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    const [buffer] = await file.download();
    console.log(`✅ Downloaded ${buffer.length} bytes from Firebase`);
    return buffer;
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
 *
 * Layout SPLIT:
 *   Top 320px  → image
 *   Bottom 320px → presenter video (head+shoulders, cropped from top of original)
 *
 * Layout FULLSCREEN:
 *   Full 360×640 → image covers entire frame
 *
 * Outside image windows → original full-size presenter video plays normally.
 *
 * @param {string} videoPath  - Local path to lip-synced video
 * @param {Array}  images     - [{ localPath, start, end, layout }]
 * @param {string} outputPath - Where to write composited video
 */
function compositeImagesOnVideo(videoPath, images, outputPath, srtPath = null) {
    return new Promise((resolve, reject) => {
        const hasImages = images && images.length > 0;

        if (!hasImages && !srtPath) {
            fs.copyFileSync(videoPath, outputPath);
            return resolve();
        }

        console.log(`🖼️ Compositing ${hasImages ? images.length : 0} images and ${srtPath ? 'subtitles' : 'no subtitles'} onto video...`);

        // ── Input args ────────────────────────────────────────────────────────
        const args = ['-i', videoPath];
        if (hasImages) {
            images.forEach((img) => {
                const imgDuration = img.end - img.start;
                args.push('-loop', '1', '-framerate', '30', '-t', String(imgDuration), '-i', img.localPath);
            });
        }

        const hasSplit = hasImages && images.some(img => img.layout === 'split');

        let filterComplex = '';

        // ── Step 1: Normalise the base video to 360×640 ───────────────────────
        filterComplex += '[0:v]scale=360:640:force_original_aspect_ratio=increase,crop=360:640,fps=30,format=yuv420p[base_raw];';

        // ── Step 2: Build the "split base" stream ─────────────────────────────
        // During split image windows we want:
        //   • Bottom 320px = presenter's head/shoulders (top 320px of original video)
        //   • Top 320px    = black (will be covered by the image overlay)
        //
        // During non-image periods the full 360×640 video plays as normal.
        //
        // Strategy:
        //   a. Duplicate base_raw via split=2 → [base] and [basecopy]
        //   b. Crop top 320px of [basecopy] → [vsmall_top]  (head + shoulders)
        //   c. Pad [vsmall_top] to 360×640, placed at y=320 → [vbottom]
        //      (result: black at top 320px, head-shot at bottom 320px)
        //   d. Overlay [vbottom] on [base] only during split windows → [splitbase]
        //      (outside split windows, overlay is disabled → full video passes through)
        let currentBase;
        if (hasSplit) {
            filterComplex += '[base_raw]split=2[base][basecopy];';
            // Top 320px of the normalised video (preserves head + shoulders)
            filterComplex += '[basecopy]crop=360:320:0:0[vsmall_top];';
            // Pad to full frame: video sits at y=320, black fills the top 320px
            filterComplex += '[vsmall_top]pad=360:640:0:320:black[vbottom];';

            // Combine all split-image time windows into a single enable expression
            const splitEnables = images
                .filter(img => img.layout === 'split')
                .map(img => `between(t,${img.start},${img.end})`)
                .join('+');

            // [vbottom] has opaque black pixels at the top, so overlaying it on [base]
            // effectively blacks out the top portion during split times only.
            filterComplex += `[base][vbottom]overlay=0:0:enable='${splitEnables}'[splitbase];`;
            currentBase = 'splitbase';
        } else {
            // No split images — use normalised video directly
            currentBase = 'base_raw';
        }

        // ── Step 3: Prepare each image stream (no fades, preserve quality) ────
        if (hasImages) {
            images.forEach((img, idx) => {
                const inputIdx = idx + 1; // input 0 = video, inputs 1..N = images

                if (img.layout === 'fullscreen') {
                    filterComplex += `[${inputIdx}:v]scale=360:640:force_original_aspect_ratio=increase,crop=360:640,fps=30,format=yuv420p[img${idx}];`;
                } else {
                    filterComplex += `[${inputIdx}:v]scale=360:320:force_original_aspect_ratio=increase,crop=360:320,fps=30,format=yuv420p[img${idx}];`;
                }
            });
        }

        // ── Step 4: Add SFX inputs and mix audio ──────────────────────────────
        // We track the input index (video is 0, images are 1..N, SFX are N+1..)
        let sfxCount = 0;
        let audioFilterComplex = '';

        // Boost base video speech volume by 50%
        audioFilterComplex += `[0:a]volume=1.5[base_vocal];`;
        const audioInputLabels = ['[base_vocal]'];

        if (hasImages) {
            images.forEach((img) => {
                if (img.sfxPath) {
                    args.push('-i', img.sfxPath);
                    const sfxInputIdx = 1 + images.length + sfxCount;

                    const delayMs = Math.floor(img.start * 1000);
                    const sfxLabel = `sfx${sfxCount}`;

                    audioFilterComplex += `[${sfxInputIdx}:a]adelay=${delayMs}|${delayMs}[${sfxLabel}];`;
                    audioInputLabels.push(`[${sfxLabel}]`);
                    sfxCount++;
                }
            });
        }

        // ── Step 5: Chain overlays ────────────────────────────────────────────
        let prevLabel = currentBase;
        if (hasImages) {
            images.forEach((img, idx) => {
                const timeEnable = `between(t,${img.start},${img.end})`;
                const outLabel = idx === images.length - 1 ? 'outv' : `tmp${idx}`;
                filterComplex += `[${prevLabel}][img${idx}]overlay=0:0:enable='${timeEnable}'[${outLabel}];`;
                prevLabel = outLabel;
            });
        } else {
            // Null-op map to [outv] if no images were processed
            filterComplex += `[${prevLabel}]copy[outv];`;
        }

        if (sfxCount > 0) {
            // Mix base audio and all delayed SFX
            // e.g. [0:a][sfx0][sfx1]amix=inputs=3:duration=first:dropout_transition=2[outa]
            const mixInputs = audioInputLabels.join('');
            audioFilterComplex += `${mixInputs}amix=inputs=${audioInputLabels.length}:duration=first:dropout_transition=2[outa];`;
        }

        // Combine video and audio filters
        let finalFilterComplex = filterComplex.replace(/;$/, '');
        if (audioFilterComplex) {
            finalFilterComplex += ';' + audioFilterComplex.replace(/;$/, '');
        }

        // ── Step 6: Burn Subtitles (Optional) ─────────────────────────────────
        if (srtPath) {
            // Escape path for ffmpeg filter: C:/foo.srt -> C\:/foo.srt
            const escapedSrtPath = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
            // We append a new chain from [outv] -> [outv_subs] using the subtitles filter
            finalFilterComplex += `;[outv]subtitles=${escapedSrtPath}:force_style='FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H40000000,BorderStyle=3,MarginV=30'[outv_subs]`;
        }

        const videoMap = srtPath ? '[outv_subs]' : '[outv]';

        const ffmpegArgs = [
            ...args,
            '-filter_complex', finalFilterComplex,
            '-map', videoMap,
            '-map', sfxCount > 0 ? '[outa]' : '0:a',
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '18',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            '-y',
            outputPath
        ];

        console.log('🎬 Running ffmpeg compositor...');
        console.log('🔍 Filter complex:\n', finalFilterComplex.replace(/;/g, ';\n'));
        const ffmpeg = spawn(FFMPEG, ffmpegArgs);

        let stderr = '';
        ffmpeg.stderr.on('data', (d) => { stderr += d.toString(); });
        ffmpeg.on('close', (code) => {
            if (code === 0) {
                console.log('✅ ffmpeg compositing complete');
                resolve();
            } else {
                console.error('❌ ffmpeg compositor failed. Last stderr:', stderr.slice(-1000));
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
    if (imageTimeline?.length > 0) {
        imageTimeline.forEach((img, i) => {
            console.log(`   Image ${i + 1}: [${img.start}s-${img.end}s] ${img.topic} layout=${img.layout} url=${img.imageUrl?.substring(0, 80)}`);
        });
    }
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

    // Phase 2.5: Generate Subtitles (SRT) from the audio
    await updateJobDoc(jobId, { status: 'generating-subtitles' });
    const srtPath = await generateSubtitlesFromAudio(audioUrl, jobId);

    // Phase 3 (optional): Download images and composite
    if (imageTimeline && imageTimeline.length > 0) {
        await updateJobDoc(jobId, { status: 'compositing' });

        const validImages = imageTimeline.filter(img => img.imageUrl);
        const downloadedImages = [];

        // Pre-download the two SFX files
        let sfxPaths = [];
        try {
            const sfx1Buffer = await downloadFromFirebaseStorage('InfluencerAudio/Audio1.mpeg');
            const sfx2Buffer = await downloadFromFirebaseStorage('InfluencerAudio/Audio2.mpeg');

            const sfx1Path = `/tmp/${jobId}-sfx1.mpeg`;
            const sfx2Path = `/tmp/${jobId}-sfx2.mpeg`;

            fs.writeFileSync(sfx1Path, sfx1Buffer);
            fs.writeFileSync(sfx2Path, sfx2Buffer);

            sfxPaths = [sfx1Path, sfx2Path];
            console.log(`✅ Downloaded 2 SFX files for overlay sounds`);
        } catch (err) {
            console.warn(`⚠️ Failed to download SFX files, overlays will be silent: ${err.message}`);
        }

        for (let i = 0; i < validImages.length; i++) {
            const img = validImages[i];
            try {
                const imgBuffer = await downloadFromUrl(img.imageUrl);
                const imgPath = `/tmp/${jobId}-img-${i}.jpg`;
                fs.writeFileSync(imgPath, imgBuffer);

                // Randomly pick one of the SFX paths (if available)
                const sfxPath = sfxPaths.length > 0 ? sfxPaths[Math.floor(Math.random() * sfxPaths.length)] : null;

                downloadedImages.push({
                    localPath: imgPath,
                    start: img.start,
                    end: img.end,
                    layout: img.layout || 'split',
                    sfxPath: sfxPath,
                });
                console.log(`✅ Image ${i + 1}/${validImages.length} downloaded: ${img.topic} (SFX: ${sfxPath ? 'Yes' : 'No'})`);
            } catch (err) {
                console.warn(`⚠️ Skipping image ${i} (${img.topic}): ${err.message}`);
            }
        }

        if (downloadedImages.length > 0) {
            finalPath = `/tmp/${jobId}-composited.mp4`;
            try {
                await compositeImagesOnVideo(lipSyncPath, downloadedImages, finalPath, srtPath);
            } catch (err) {
                console.warn(`⚠️ Compositing failed, using raw lipsync: ${err.message}`);
                finalPath = lipSyncPath;
            }

            // Cleanup image files
            downloadedImages.forEach(img => {
                try { fs.unlinkSync(img.localPath); } catch (_) { }
            });
        }

        // Cleanup SFX files
        sfxPaths.forEach(p => {
            try { fs.unlinkSync(p); } catch (_) { }
        });
    }

    // Phase 4: Upload to Firebase
    await updateJobDoc(jobId, { status: 'uploading' });
    const finalBuffer = fs.readFileSync(finalPath);
    const finalVideoPath = `AIInfluencer/${jobId}/final.mp4`;
    const finalVideoUrl = await uploadToFirebase(finalBuffer, finalVideoPath, 'video/mp4');

    // Cleanup temp files
    [lipSyncPath, `/tmp/${jobId}-composited.mp4`, srtPath].forEach(p => {
        try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch (_) { }
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
