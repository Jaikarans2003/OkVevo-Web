const admin = require('firebase-admin');
const { spawn } = require('child_process');
const fs = require('fs');

/**
 * AWS Lambda Handler for Video Stitching with URL support
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
 * @param {string} videoUrl - Firebase Storage signed URL
 * @param {string} filename - Destination filename
 */
async function downloadVideoFromFirebase(videoUrl, filename) {
    try {
        console.log(`Processing URL: ${videoUrl}`);

        // Extract path from Firebase signed URL
        // URL format: https://storage.googleapis.com/BUCKET/path/to/video?GoogleAccessId=...&Expires=...&Signature=...
        const url = new URL(videoUrl);
        console.log(`URL pathname: ${url.pathname}`);

        // Match pattern: /bucket-name/path/to/file
        const pathMatch = url.pathname.match(/^\/[^\/]+\/(.+)$/);

        if (!pathMatch) {
            console.error(`Failed to extract path from URL: ${videoUrl}`);
            console.error(`Pathname: ${url.pathname}`);
            throw new Error(`Invalid Firebase URL format: ${videoUrl}`);
        }

        let filePath = decodeURIComponent(pathMatch[1]);
        console.log(`Extracted file path: ${filePath}`);

        const bucket = admin.storage().bucket();

        // Try the extracted path first
        let file = bucket.file(filePath);
        let exists = await file.exists();

        if (!exists[0]) {
            console.warn(`File not found at: ${filePath}`);
            console.log('Attempting alternative path in videos/ folder...');

            // Try videos/ prefix if not already present
            if (!filePath.startsWith('videos/')) {
                const altPath = `videos/${filePath.split('/').pop()}`;
                console.log(`Trying alternate path: ${altPath}`);
                file = bucket.file(altPath);
                exists = await file.exists();

                if (exists[0]) {
                    filePath = altPath;
                    console.log(`✅ Found file at alternate path: ${altPath}`);
                }
            }
        }

        if (!exists[0]) {
            // List available files to help debug
            console.log('Listing available files in bucket...');
            const [files] = await bucket.getFiles({ maxResults: 10 });
            console.log('Available files:', files.map(f => f.name));
            throw new Error(`File not found in Firebase Storage: ${filePath}`);
        }

        const destPath = `/tmp/${filename}`;

        // Download file to /tmp
        console.log(`Downloading ${filePath} to ${destPath}...`);
        await file.download({
            destination: destPath
        });

        console.log(`✅ Downloaded ${filename} from Firebase Storage`);
        return destPath;

    } catch (error) {
        console.error(`❌ Error downloading ${filename}:`, error);
        throw error;
    }
}

/**
 * Stitch videos using FFmpeg with crossfade transitions
 * Handles videos with different resolutions by scaling to common size
 */
function stitchVideos(inputFiles, outputFile) {
    return new Promise((resolve, reject) => {
        // Scale all videos to 360x640 and apply crossfade transitions
        // This handles resolution mismatches between videos
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

        console.log('Starting FFmpeg with resolution normalization...');
        console.log('FFmpeg args:', args.join(' '));

        const ffmpeg = spawn('/opt/bin/ffmpeg', args);

        let stderr = '';

        ffmpeg.stderr.on('data', (data) => {
            stderr += data.toString();
            console.log('FFmpeg:', data.toString());
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                console.log('✅ FFmpeg stitching completed successfully');
                resolve();
            } else {
                console.error(`❌ FFmpeg failed with code: ${code}`);
                console.error('FFmpeg stderr:', stderr);
                reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
            }
        });

        ffmpeg.on('error', (error) => {
            console.error('❌ FFmpeg spawn error:', error);
            reject(error);
        });
    });
}

/**
 * Main Lambda Handler
 */
exports.handler = async (event) => {
    console.log('Lambda invoked. Event:', JSON.stringify(event));

    try {
        // Initialize Firebase
        initializeFirebase();

        // Parse request body
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
                    error: 'Request must include 3 video URLs'
                })
            };
        }

        console.log(`Processing video stitching for session: ${sessionId}`);
        console.log(`Video URLs:`, videoUrls);

        // Download videos from Firebase Storage using Admin SDK
        console.log('Downloading videos from Firebase Storage...');
        const downloadedVideos = [];

        for (let i = 0; i < videoUrls.length; i++) {
            const destPath = await downloadVideoFromFirebase(videoUrls[i], `video${i + 1}.mp4`);
            downloadedVideos.push(destPath);
        }

        // Stitch videos
        const stitchedPath = '/tmp/stitched-output.mp4';
        console.log('Stitching videos...');
        await stitchVideos(downloadedVideos, stitchedPath);

        // Upload to Firebase
        const timestamp = Date.now();
        const destinationFilename = `stitched-${sessionId}-${timestamp}.mp4`;
        console.log(`Uploading stitched video as ${destinationFilename}...`);

        const bucket = admin.storage().bucket();
        await bucket.upload(stitchedPath, {
            destination: `videos/${destinationFilename}`,
            metadata: {
                contentType: 'video/mp4'
            }
        });

        // Generate signed URL (valid for 7 days)
        const file = bucket.file(`videos/${destinationFilename}`);
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000  // 7 days
        });

        console.log('Video stitching completed successfully');
        console.log('Signed URL:', url);

        // Clean up tmp files
        downloadedVideos.forEach(path => {
            try {
                fs.unlinkSync(path);
            } catch (err) {
                console.warn(`Failed to delete ${path}:`, err.message);
            }
        });

        try {
            fs.unlinkSync(stitchedPath);
        } catch (err) {
            console.warn('Failed to delete stitched file:', err.message);
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: JSON.stringify({
                success: true,
                videoUrl: url,
                message: 'Video stitched successfully'
            })
        };

    } catch (error) {
        console.error('Lambda error:', error);

        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            body: JSON.stringify({
                success: false,
                error: error.message || 'Video stitching failed'
            })
        };
    }
};
