const admin = require('firebase-admin');
const { spawn } = require('child_process');
const fs = require('fs');

/**
 * AWS Lambda Handler for Video Stitching
 * Supports both HTTP (Function URL) and SQS triggers
 */

let firebaseInitialized = false;

function initializeFirebase() {
    if (firebaseInitialized) return;

    try {
        const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

        if (!serviceAccountBase64) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set');
        }

        const serviceAccount = JSON.parse(
            Buffer.from(serviceAccountBase64, 'base64').toString('utf-8')
        );

        const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'text2video-16cbf.firebasestorage.app';
        console.log(`Initializing Firebase with bucket: ${bucketName}`);
        console.log(`Service account project_id: ${serviceAccount.project_id}`);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: bucketName
        });

        firebaseInitialized = true;
        console.log('✅ Firebase Admin SDK initialized successfully');
        console.log(`✅ Using storage bucket: ${bucketName}`);
    } catch (error) {
        console.error('❌ Failed to initialize Firebase Admin SDK:', error);
        throw error;
    }
}

/**
 * Download a video from Firebase Storage using Admin SDK
 */
async function downloadVideoFromFirebase(videoUrl, filename) {
    try {
        console.log(`Processing URL: ${videoUrl}`);

        const url = new URL(videoUrl);
        let filePath;

        // Handle different Firebase/GCS URL formats
        if (url.hostname.includes('firebasestorage.googleapis.com')) {
            // Format: /v0/b/[bucket]/o/[path]
            const parts = url.pathname.split('/o/');
            if (parts.length < 2) {
                throw new Error(`Invalid Firebase Storage URL format: ${videoUrl}`);
            }
            // path is everything after /o/, url-decoded
            filePath = decodeURIComponent(parts[1]);
        } else {
            // Standard GCS format: /[bucket]/[path] or similar
            // Existing logic: matches /bucket/path/to/file -> path/to/file
            const pathMatch = url.pathname.match(/^\/[^\/]+\/(.+)$/);
            if (!pathMatch) {
                throw new Error(`Invalid GCS URL format: ${videoUrl}`);
            }
            filePath = decodeURIComponent(pathMatch[1]);
        }

        console.log(`Extracted file path: ${filePath}`);

        const bucket = admin.storage().bucket();
        let file = bucket.file(filePath);
        let exists = await file.exists();

        if (!exists[0]) {
            console.warn(`File not found at: ${filePath}`);
            if (!filePath.startsWith('videos/')) {
                const altPath = `videos/${filePath.split('/').pop()}`;
                file = bucket.file(altPath);
                exists = await file.exists();
                if (exists[0]) {
                    filePath = altPath;
                }
            }
        }

        if (!exists[0]) {
            const [files] = await bucket.getFiles({ maxResults: 10 });
            console.log('Available files:', files.map(f => f.name));
            throw new Error(`File not found in Firebase Storage: ${filePath}`);
        }

        const destPath = `/tmp/${filename}`;
        await file.download({ destination: destPath });
        console.log(`✅ Downloaded ${filename}`);
        return destPath;

    } catch (error) {
        console.error(`❌ Error downloading ${filename}:`, error);
        throw error;
    }
}

/**
 * Get video duration using ffmpeg (since ffprobe may not be available)
 */
function getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
        // Use ffmpeg to get duration from stderr output
        const ffmpeg = spawn('/opt/bin/ffmpeg', [
            '-i', videoPath,
            '-f', 'null',
            '-'
        ]);

        let stderr = '';
        ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ffmpeg.on('close', (code) => {
            // ffmpeg returns non-zero when using -f null, so we parse stderr regardless
            // Look for "Duration: HH:MM:SS.mmm" in the output
            const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);

            if (durationMatch) {
                const hours = parseInt(durationMatch[1]);
                const minutes = parseInt(durationMatch[2]);
                const seconds = parseFloat(durationMatch[3]);
                const duration = hours * 3600 + minutes * 60 + seconds;

                console.log(`Video duration for ${videoPath}: ${duration}s`);
                resolve(duration);
            } else {
                reject(new Error(`Could not parse duration from ffmpeg output for ${videoPath}`));
            }
        });

        ffmpeg.on('error', (error) => reject(error));
    });
}

/**
 * Stitch N videos using FFmpeg with smooth crossfade transitions
 * Supports dynamic video counts and optional audio overlay
 * 
 * @param {string[]} inputFiles - Array of video file paths (2+)
 * @param {string} outputFile - Output file path
 * @param {string|null} audioFile - Optional narration audio file path
 */
async function stitchVideos(inputFiles, outputFile, audioFile = null) {
    const n = inputFiles.length;
    if (n < 2) throw new Error('Need at least 2 videos to stitch');

    // Probe all video durations first
    const durations = [];
    for (const file of inputFiles) {
        const duration = await getVideoDuration(file);
        durations.push(duration);
    }

    console.log('Video durations:', durations);

    return new Promise((resolve, reject) => {
        const transitionDuration = 1.5;
        const transitions = ['smoothleft', 'smoothright', 'fade', 'wipeleft'];

        // Build filter complex dynamically for N videos
        let filter = '';

        // Normalize all video inputs
        for (let i = 0; i < n; i++) {
            filter += `[${i}:v]scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v${i}];`;
        }

        // Chain crossfade transitions
        let prevLabel = 'v0';
        let cumulativeOffset = 0;

        for (let i = 1; i < n; i++) {
            cumulativeOffset += durations[i - 1] - transitionDuration;
            const transition = transitions[(i - 1) % transitions.length];
            const outLabel = i === n - 1 ? 'outv' : `vt${i}`;
            filter += `[${prevLabel}][v${i}]xfade=transition=${transition}:duration=${transitionDuration}:offset=${cumulativeOffset}[${outLabel}];`;
            prevLabel = outLabel;
            // After first crossfade, cumulative offset adjusts
            // offset for next = previous_offset + duration[i] - transitionDuration
            // But we recalculate from scratch each time
        }

        // Recalculate offsets correctly from scratch
        filter = '';
        for (let i = 0; i < n; i++) {
            filter += `[${i}:v]scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v${i}];`;
        }

        prevLabel = 'v0';
        let runningDuration = durations[0];

        for (let i = 1; i < n; i++) {
            const offset = runningDuration - transitionDuration;
            const transition = transitions[(i - 1) % transitions.length];
            const outLabel = i === n - 1 ? 'outv' : `vt${i}`;
            filter += `[${prevLabel}][v${i}]xfade=transition=${transition}:duration=${transitionDuration}:offset=${offset}[${outLabel}];`;
            prevLabel = outLabel;
            runningDuration = offset + durations[i]; // After crossfade, new running duration
        }

        // Handle audio
        if (!audioFile) {
            // Build audio crossfade chain for N videos
            for (let i = 0; i < n; i++) {
                filter += `[${i}:a]atrim=0:${durations[i]},asetpts=PTS-STARTPTS[a${i}];`;
            }
            let prevAudio = 'a0';
            for (let i = 1; i < n; i++) {
                const outAudio = i === n - 1 ? 'outa' : `at${i}`;
                filter += `[${prevAudio}][a${i}]acrossfade=d=${transitionDuration}:c1=tri:c2=tri[${outAudio}];`;
                prevAudio = outAudio;
            }
        }

        // Remove trailing semicolon
        filter = filter.replace(/;$/, '');

        console.log(`Filter complex (${n} videos):`, filter.substring(0, 200) + '...');

        // Build FFmpeg arguments
        const args = [];
        for (const file of inputFiles) {
            args.push('-i', file);
        }

        if (audioFile) {
            args.push('-i', audioFile);
        }

        args.push('-filter_complex', filter, '-map', '[outv]');

        if (audioFile) {
            args.push('-map', `${n}:a`); // Audio is the last input
        } else {
            args.push('-map', '[outa]');
        }

        args.push(
            '-c:v', 'libx264',
            '-preset', 'slow',
            '-crf', '20',
            '-profile:v', 'high',
            '-level', '4.1',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '256k',
            '-ar', '48000',
            '-movflags', '+faststart',
            '-y',
            outputFile
        );

        console.log('Starting FFmpeg...');
        const ffmpeg = spawn('/opt/bin/ffmpeg', args);

        let stderr = '';
        ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString();
            console.log('FFmpeg:', data.toString());
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Stitching complete');
                resolve();
            } else {
                console.error(`❌ FFmpeg failed: ${code}`);
                reject(new Error(`FFmpeg exited with code ${code}`));
            }
        });

        ffmpeg.on('error', (error) => reject(error));
    });
}

/**
 * Download audio file from Firebase Storage
 */
async function downloadAudioFromFirebase(audioUrl, filename) {
    try {
        console.log(`Downloading audio: ${audioUrl}`);

        const url = new URL(audioUrl);
        let filePath;

        // Handle different Firebase/GCS URL formats
        if (url.hostname.includes('firebasestorage.googleapis.com')) {
            // Format: /v0/b/[bucket]/o/[path]
            const parts = url.pathname.split('/o/');
            if (parts.length < 2) {
                throw new Error(`Invalid Firebase Storage URL format: ${audioUrl}`);
            }
            // path is everything after /o/, url-decoded
            filePath = decodeURIComponent(parts[1]);
        } else {
            // Standard GCS format: /[bucket]/[path]
            const pathMatch = url.pathname.match(/^\/[^\/]+\/(.+)$/);
            if (!pathMatch) {
                throw new Error(`Invalid Google Cloud Storage URL format: ${audioUrl}`);
            }
            filePath = decodeURIComponent(pathMatch[1]);
        }

        console.log(`Extracted audio file path: ${filePath}`);

        const bucket = admin.storage().bucket();
        const file = bucket.file(filePath);
        const exists = await file.exists();

        if (!exists[0]) {
            throw new Error(`Audio file not found in Firebase Storage: ${filePath}`);
        }

        const destPath = `/tmp/${filename}`;
        await file.download({ destination: destPath });
        console.log(`✅ Downloaded audio: ${filename}`);
        return destPath;

    } catch (error) {
        console.error(`❌ Error downloading audio ${filename}:`, error);
        throw error;
    }
}

/**
 * Core stitching logic (extracted for reuse)
 */
async function processStitchingJob(videoUrls, sessionId = 'default', audioUrl = null, trendJobId = null) {
    console.log(`Processing stitching job: ${sessionId}`);
    console.log(`Video URLs (${videoUrls.length}):`, videoUrls);
    console.log(`Audio URL:`, audioUrl);
    console.log(`Trend Job ID:`, trendJobId);

    // Download videos
    const downloadedVideos = [];
    for (let i = 0; i < videoUrls.length; i++) {
        const path = await downloadVideoFromFirebase(videoUrls[i], `video${i + 1}.mp4`);
        downloadedVideos.push(path);
    }

    // Download audio if provided
    let audioPath = null;
    if (audioUrl) {
        audioPath = await downloadAudioFromFirebase(audioUrl, 'narration.mp3');
    }

    // Stitch videos with or without audio
    const stitchedPath = '/tmp/stitched-output.mp4';
    await stitchVideos(downloadedVideos, stitchedPath, audioPath);

    // Upload to Firebase
    const timestamp = Date.now();
    const destinationFilename = `stitched-${sessionId}-${timestamp}.mp4`;

    const bucket = admin.storage().bucket();
    await bucket.upload(stitchedPath, {
        destination: `videos/${destinationFilename}`,
        metadata: { contentType: 'video/mp4' }
    });

    // Generate signed URL
    const file = bucket.file(`videos/${destinationFilename}`);
    const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000
    });

    // If this was triggered by a trend pipeline, update the trend Firestore doc
    if (trendJobId) {
        try {
            const firestore = admin.firestore();
            await firestore.collection('trendGenerations').doc(trendJobId).update({
                finalVideoUrl: url,
                status: 'complete',
            });
            console.log(`📝 Trend Firestore updated: ${trendJobId} → complete`);
        } catch (err) {
            console.warn(`⚠️ Failed to update trend Firestore doc ${trendJobId}:`, err.message);
        }
    }

    // Cleanup
    [...downloadedVideos, stitchedPath].forEach(path => {
        try { fs.unlinkSync(path); } catch (err) { }
    });

    console.log('✅ Stitching complete:', url);
    return url;
}

/**
 * Main Lambda Handler - Supports both HTTP and SQS triggers
 */
exports.handler = async (event) => {
    console.log('Lambda invoked');
    console.log('Event type:', event.Records ? 'SQS' : 'HTTP');

    try {
        initializeFirebase();

        // Detect trigger type
        if (event.Records && event.Records.length > 0) {
            // ========== SQS TRIGGER ==========
            console.log('🔹 SQS Trigger detected');

            // Process each SQS message (batch size = 1 recommended)
            for (const record of event.Records) {
                const body = JSON.parse(record.body);
                const { jobId, videoUrls, audioUrl, trendJobId } = body;

                if (!videoUrls || videoUrls.length < 2) {
                    throw new Error('SQS message must contain at least 2 video URLs');
                }

                console.log(`Processing SQS job: ${jobId}`);
                const videoUrl = await processStitchingJob(videoUrls, jobId, audioUrl, trendJobId);

                console.log(`✅ SQS job ${jobId} completed: ${videoUrl}`);
                // Note: For SQS, the final video URL is returned in logs
                // You could send this to Firestore/SNS for frontend polling
            }

            // SQS doesn't need HTTP response, just return success
            return { statusCode: 200, body: 'SQS processing complete' };

        } else {
            // ========== HTTP TRIGGER (Legacy/Fallback) ==========
            console.log('🔹 HTTP Trigger detected');

            const body = event.body ? JSON.parse(event.body) : event;
            const { videoUrls, sessionId = 'default', audioUrl } = body;

            if (!videoUrls || videoUrls.length < 2) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        success: false,
                        error: 'Must provide at least 2 video URLs'
                    })
                };
            }

            const videoUrl = await processStitchingJob(videoUrls, sessionId, audioUrl);

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: true,
                    videoUrl,
                    message: 'Video stitched successfully'
                })
            };
        }

    } catch (error) {
        console.error('❌ Lambda error:', error);

        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: error.message || 'Stitching failed'
            })
        };
    }
};
