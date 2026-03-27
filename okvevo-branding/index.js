const admin = require('firebase-admin');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────
const FFMPEG = '/opt/bin/ffmpeg';
const JOBS_COLLECTION = 'aiInfluencerJobs';

// Initialize Firebase
const saBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FB_SERVICE_ACCOUNT_KEY;
if (!saBase64) {
    throw new Error('Missing Firebase Service Account Key (FIREBASE_SERVICE_ACCOUNT_KEY or FB_SERVICE_ACCOUNT_KEY)');
}
const serviceAccount = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf-8'));
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'text2video-16cbf.firebasestorage.app',
    });
}

// ────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────

async function updateJobDoc(jobId, userId, fields) {
    const firestore = admin.firestore();
    await firestore
        .collection('users')
        .doc(userId)
        .collection(JOBS_COLLECTION)
        .doc(jobId)
        .set({ ...fields, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
}

/**
 * Downloads a file from any HTTP/HTTPS URL, following redirects.
 */
function downloadFromUrl(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                return downloadFromUrl(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`Download failed with status ${res.statusCode} for URL: ${url}`));
            }
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('error', reject);
    });
}

async function uploadToFirebase(buffer, storagePath, contentType) {
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.save(buffer, { metadata: { contentType } });
    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

/**
 * Runs an FFmpeg command and returns a Promise.
 */
function runFfmpeg(args) {
    return new Promise((resolve, reject) => {
        console.log('🎬 Running ffmpeg:', FFMPEG, args.slice(0, 10).join(' '), '...');
        const proc = spawn(FFMPEG, args, { cwd: '/tmp' });
        let stderr = '';
        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg exited ${code}. Stderr (last 2000 chars): ${stderr.slice(-2000)}`));
        });
        proc.on('error', reject);
    });
}

// ────────────────────────────────────────────────────
// Core branding processor
// ────────────────────────────────────────────────────

/**
 * Builds and executes the FFmpeg command that overlays the logo and/or
 * scrolling marquee on the input video.
 */
async function applyBranding(inputPath, outputPath, opts = {}) {
    const { logoPath, marqueeText, marqueePosition = 'bottom', logoPosition = 'top-right' } = opts;

    const hasLogo    = !!logoPath    && fs.existsSync(logoPath);
    const hasMarquee = !!marqueeText && marqueeText.trim().length > 0;

    if (!hasLogo && !hasMarquee) {
        throw new Error('At least one of logo or marqueeText must be provided.');
    }

    let fontPath = null;
    if (hasMarquee) {
        const FONT_URL = 'https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-SemiBold.ttf';
        const FONT_PATH = '/tmp/Montserrat-SemiBold.ttf';
        if (!fs.existsSync(FONT_PATH)) {
            console.log('Downloading Montserrat font...');
            const fontBuf = await downloadFromUrl(FONT_URL);
            fs.writeFileSync(FONT_PATH, fontBuf);
            console.log('Font downloaded successfully.');
        }
        fontPath = FONT_PATH;
    }

    const args = ['-i', inputPath];
    if (hasLogo) {
        args.push('-i', logoPath);
    }

    let filterParts = [];
    let currentLabel = '0:v';

    // Step 1: Scale logo to 1:1 aspect ratio and exactly 1/12th of the video width
    if (hasLogo) {
        // Simple scale2ref without any complex math to guarantee it doesn't break parsing.
        filterParts.push(`[1:v][${currentLabel}]scale2ref=w='main_w/12':h='main_w/12'[logo_scaled][video_ref]`);
        
        const pad = 12; 
        let overlayX, overlayY;
        if (logoPosition === 'top-right') {
            overlayX = `W-w-${pad}`;
            overlayY = `${pad}`;
        } else if (logoPosition === 'top-left') {
            overlayX = `${pad}`;
            overlayY = `${pad}`;
        } else if (logoPosition === 'bottom-right') {
            overlayX = `W-w-${pad}`;
            overlayY = `H-h-${pad}`;
        } else { // bottom-left
            overlayX = `${pad}`;
            overlayY = `H-h-${pad}`;
        }

        filterParts.push(`[video_ref][logo_scaled]overlay=x='${overlayX}':y='${overlayY}' [after_logo]`);
        currentLabel = 'after_logo';
    }

    // Step 2: Marquee
    if (hasMarquee) {
        const escaped = marqueeText
            .replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "'\\''").replace(/\[/g, '\\[').replace(/\]/g, '\\]');

        const fontSize = 18;
        const boxBorder = 4;
        const textY = marqueePosition === 'top' ? `${10 + boxBorder}` : `H-${fontSize + boxBorder * 2 + 10}`;

        // IMPORTANT: Escape comma in mod(W,H) expression
        const scrollX = `W-mod(t*80\\,W+tw)`;

        filterParts.push(
            `[${currentLabel}]drawtext=` +
            `text='${escaped}':` +
            `fontsize='${fontSize}':` +
            `fontcolor='white':` +
            `box='1':` +
            `boxcolor='black@0.55':` +
            `boxborderw='${boxBorder}':` +
            `x='${scrollX}':` +
            `y='${textY}':` +
            `fontfile='${fontPath}' ` +
            `[branded]`
        );
        currentLabel = 'branded';
    } else if (hasLogo) {
        // If logo only, ensure the output remains [branded]
        const lastIndex = filterParts.length - 1;
        filterParts[lastIndex] = filterParts[lastIndex].replace('[after_logo]', ' [branded]');
        currentLabel = 'branded';
    }

    const filterComplex = filterParts.join(';');

    args.push(
        '-filter_complex', filterComplex,
        '-map', '[branded]',
        '-map', '0:a',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'copy',
        '-movflags', '+faststart',
        '-y',
        outputPath,
    );

    await runFfmpeg(args);
}

// ────────────────────────────────────────────────────
// Lambda Handler
// ────────────────────────────────────────────────────

exports.handler = async (event) => {
    const {
        jobId,
        userId,
        finalVideoUrl,
        logoBase64,
        logoMimeType,
        logoPosition   = 'top-right',
        marqueeText,
        marqueePosition = 'bottom',
    } = event;

    console.log(`🎨 BRANDING: Starting for Job ${jobId}`);

    if (!jobId || !userId || !finalVideoUrl) {
        throw new Error('Missing required fields: jobId, userId, finalVideoUrl');
    }

    const inputPath  = `/tmp/${jobId}-source.mp4`;
    const outputPath = `/tmp/${jobId}-branded.mp4`;
    let   logoPath   = null;

    try {
        await updateJobDoc(jobId, userId, { brandingStatus: 'processing' });

        const videoBuf = await downloadFromUrl(finalVideoUrl);
        fs.writeFileSync(inputPath, videoBuf);

        // Allow fetching logo dynamically from a URL (nice for tests and remote buckets)
        if (event.logoUrl) {
            const logoBuf = await downloadFromUrl(event.logoUrl);
            const ext = event.logoUrl.toLowerCase().includes('.jpg') ? 'jpg' : 'png';
            logoPath = `/tmp/${jobId}-logo.${ext}`;
            fs.writeFileSync(logoPath, logoBuf);
        } else if (logoBase64) {
            const ext = (logoMimeType || 'image/png').includes('jpeg') ? 'jpg' : 'png';
            logoPath = `/tmp/${jobId}-logo.${ext}`;
            fs.writeFileSync(logoPath, Buffer.from(logoBase64, 'base64'));
        }

        await applyBranding(inputPath, outputPath, {
            logoPath,
            marqueeText,
            marqueePosition,
            logoPosition,
        });

        const brandedBuffer = fs.readFileSync(outputPath);
        const storagePath   = `AIInfluencer/${jobId}/final-branded.mp4`;
        const brandedVideoUrl = await uploadToFirebase(brandedBuffer, storagePath, 'video/mp4');

        await updateJobDoc(jobId, userId, {
            brandedVideoUrl,
            brandingStatus: 'complete',
        });

        [inputPath, outputPath, logoPath].filter(Boolean).forEach((p) => {
            try { fs.unlinkSync(p); } catch (_) {}
        });

        return { success: true, brandedVideoUrl };

    } catch (error) {
        console.error(`❌ Branding Error:`, error);
        await updateJobDoc(jobId, userId, { brandingStatus: 'failed', brandingError: error.message });
        [inputPath, outputPath, logoPath].filter(Boolean).forEach((p) => {
            try { fs.unlinkSync(p); } catch (_) {}
        });
        throw error;
    }
};
