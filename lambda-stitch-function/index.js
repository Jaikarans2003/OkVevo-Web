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
        const pathMatch = url.pathname.match(/^\/[^\/]+\/(.+)$/);

        if (!pathMatch) {
            throw new Error(`Invalid Firebase URL format: ${videoUrl}`);
        }

        let filePath = decodeURIComponent(pathMatch[1]);
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
 * Stitch videos using FFmpeg with crossfade transitions
 */
function stitchVideos(inputFiles, outputFile) {
    return new Promise((resolve, reject) => {
        const filter =
            `[0:v]scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v0];` +
            `[1:v]scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v1];` +
            `[2:v]scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v2];` +
            `[v0][v1]xfade=transition=fade:duration=1:offset=19[vt1];` +
            `[vt1][v2]xfade=transition=fade:duration=1:offset=38[outv];` +
            `[0:a][1:a]acrossfade=d=1:c1=tri:c2=tri[a01];` +
            `[a01][2:a]acrossfade=d=1:c1=tri:c2=tri[outa]`;

        const args = [
            '-i', inputFiles[0],
            '-i', inputFiles[1],
            '-i', inputFiles[2],
            '-filter_complex', filter,
            '-map', '[outv]',
            '-map', '[outa]',
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            outputFile
        ];

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
 * Core stitching logic (extracted for reuse)
 */
async function processStitchingJob(videoUrls, sessionId = 'default') {
    console.log(`Processing stitching job: ${sessionId}`);
    console.log(`Video URLs:`, videoUrls);

    // Download videos
    const downloadedVideos = [];
    for (let i = 0; i < videoUrls.length; i++) {
        const path = await downloadVideoFromFirebase(videoUrls[i], `video${i + 1}.mp4`);
        downloadedVideos.push(path);
    }

    // Stitch
    const stitchedPath = '/tmp/stitched-output.mp4';
    await stitchVideos(downloadedVideos, stitchedPath);

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
                const { jobId, videoUrls } = body;

                if (!videoUrls || videoUrls.length !== 3) {
                    throw new Error('SQS message must contain 3 video URLs');
                }

                console.log(`Processing SQS job: ${jobId}`);
                const videoUrl = await processStitchingJob(videoUrls, jobId);

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
            const { videoUrls, sessionId = 'default' } = body;

            if (!videoUrls || videoUrls.length !== 3) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        success: false,
                        error: 'Must provide 3 video URLs'
                    })
                };
            }

            const videoUrl = await processStitchingJob(videoUrls, sessionId);

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
