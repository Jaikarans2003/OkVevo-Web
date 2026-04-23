const admin = require('firebase-admin');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { GoogleGenAI } = require('@google/genai');

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
        filterParts.push(`[1:v][${currentLabel}]scale2ref=w='main_w/18':h='main_w/18'[logo_scaled][video_ref]`);
        
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
// NanoBanana2 Thumbnail Generation (Fal AI + Gemini)
// ────────────────────────────────────────────────────

function initializeFalClientImage() {
    const apiKey = process.env.FAL_API_IMAGE;
    if (!apiKey) throw new Error('FAL_API_IMAGE environment variable not set');
    fal.config({ credentials: apiKey });
}

async function generateWithNanoBanana(thumbnailPrompt, personImageUrl = null, personImageBuffer = null) {
    console.log('🔬 Generating Thumbnail with NanoBanana2 (Fal AI -> Flux -> Gemini)...');

    try {
        const apiKey = process.env.FAL_API_IMAGE;
        if (!apiKey) throw new Error('FAL_API_IMAGE environment variable not set');

        // Use thumbnail prompt directly - user provides complete visual description
        let promptText = thumbnailPrompt;

        if (personImageUrl) {
            promptText = `${thumbnailPrompt}\n\nReference image: ${personImageUrl}. Replicate exact face, features, skin tone, hair, eyes, outfit. Generate photorealistic 9:16 thumbnail.`;
        }

        const falInput = {
            prompt: promptText,
            aspect_ratio: "9:16",
            output_format: "png",
            num_images: 1,
            enable_web_search: true,
            thinking_level: "minimal"
        };

        // Submit job to Fal AI queue
        const submitUrl = `https://queue.fal.run/fal-ai/nano-banana-2`;
        const submitResponse = await httpsRequest(submitUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${apiKey}`,
                'Content-Type': 'application/json',
            }
        }, falInput);

        if (submitResponse.statusCode !== 200) {
            throw new Error(`Fal AI submit failed: ${submitResponse.statusCode} - ${JSON.stringify(submitResponse.body)}`);
        }

        const { request_id } = submitResponse.body;
        console.log(`✅ Fal AI job submitted: ${request_id}`);

        // Poll for completion
        const statusUrl = `https://queue.fal.run/fal-ai/nano-banana-2/requests/${request_id}/status`;
        let attempts = 0;
        const maxAttempts = 180; // 15 minutes max
        let videoUrl = null;

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;

            const statusResponse = await httpsRequest(statusUrl, {
                method: 'GET',
                headers: { 'Authorization': `Key ${apiKey}` }
            });

            if (statusResponse.statusCode !== 200) continue;
            
            const status = statusResponse.body;
            console.log(`🔄 Fal AI status (attempt ${attempts}): ${status.status}`);

            if (status.status === 'COMPLETED') {
                const resultResponse = await httpsRequest(status.response_url, {
                    method: 'GET',
                    headers: { 'Authorization': `Key ${apiKey}` }
                });

                if (resultResponse.statusCode !== 200) throw new Error('Failed to fetch Fal AI result');
                
                const result = resultResponse.body;
                
                videoUrl = result.images?.[0]?.url || result.data?.images?.[0]?.url;
                if (!videoUrl) throw new Error(`Could not find image URL. Full result: ${JSON.stringify(result)}`);
                break;
            }

            if (status.status === 'FAILED') {
                throw new Error(`Fal AI job failed: ${status.error || 'Unknown error'}`);
            }
        }

        if (!videoUrl) throw new Error(`nano-banana-2 timed out after 15 minutes (${attempts} attempts)`);

        console.log(`✅ Fal AI NanoBanana2 thumbnail ready: ${videoUrl}`);
        const buffer = await downloadFromUrl(videoUrl);
        return { imageBuffer: buffer, generatedBy: 'nano-banana-2' };

    } catch (nanoBananaError) {
        console.error('❌ Fal AI NanoBanana2 failed, trying Flux-2/Turbo:', nanoBananaError.message);

        // --- FALLBACK 1: TRY FLUX-2/TURBO ---
        try {
            const apiKey = process.env.FAL_API_IMAGE;
            if (!apiKey) throw new Error('FAL_API_IMAGE environment variable not set');

            let promptText = thumbnailPrompt;
            if (personImageUrl) {
                promptText = `${thumbnailPrompt}\n\nReference: ${personImageUrl}. Match exact appearance.`;
            }

            const fluxInput = {
                prompt: promptText,
                image_size: "portrait_16_9",       // ✅ CORRECT (not aspect_ratio)
                num_inference_steps: 4,            // ✅ ADDED
                num_images: 1,
                enable_safety_checker: true,       // ✅ ADDED
                enable_prompt_expansion: true,     // ✅ ADDED
                guidance_scale: 5.5,               // ✅ ADDED
                output_format: "png"
            };

            // Submit job to Flux-2/Turbo
            const submitUrl = `https://queue.fal.run/fal-ai/flux-2/turbo`;
            const submitResponse = await httpsRequest(submitUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Key ${apiKey}`,
                    'Content-Type': 'application/json',
                }
            }, fluxInput);

            if (submitResponse.statusCode !== 200) {
                throw new Error(`Flux-2/Turbo submit failed: ${submitResponse.statusCode} - ${JSON.stringify(submitResponse.body)}`);
            }

            const { request_id } = submitResponse.body;
            console.log(`✅ Flux-2/Turbo job submitted: ${request_id}`);

            // Poll for completion
            const statusUrl = `https://queue.fal.run/fal-ai/flux-2/turbo/requests/${request_id}/status`;
            let attempts = 0;
            const maxAttempts = 180; // 15 minutes max
            let imageUrl = null;

            while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                attempts++;

                const statusResponse = await httpsRequest(statusUrl, {
                    method: 'GET',
                    headers: { 'Authorization': `Key ${apiKey}` }
                });

                if (statusResponse.statusCode !== 200) continue;
                
                const status = statusResponse.body;
                console.log(`🔄 Flux-2/Turbo status (attempt ${attempts}): ${status.status}`);

                if (status.status === 'COMPLETED') {
                    // Result is already in the status response, no need to fetch again
                    const result = status.result || status;
                    
                    imageUrl = result.images?.[0]?.url || result.data?.images?.[0]?.url;
                    if (!imageUrl) throw new Error(`Could not find image URL. Full result: ${JSON.stringify(result)}`);
                    break;
                }

                if (status.status === 'FAILED') {
                    throw new Error(`Flux-2/Turbo job failed: ${status.error || 'Unknown error'}`);
                }
            }

            if (!imageUrl) throw new Error(`Flux-2/Turbo timed out after 15 minutes (${attempts} attempts)`);

            console.log(`✅ Flux-2/Turbo thumbnail ready: ${imageUrl}`);
            const buffer = await downloadFromUrl(imageUrl);
            return { imageBuffer: buffer, generatedBy: 'flux-2/turbo' };

        } catch (fluxError) {
            console.error('❌ Flux-2/Turbo failed, falling back to Gemini:', fluxError.message);

            // --- FALLBACK 2: GEMINI ---
            const geminiApiKey = process.env.GEMINI_API_KEY;
            if (!geminiApiKey) throw new Error('GEMINI_API_KEY environment variable not set (needed for fallback)');

            const ai = new GoogleGenAI({ apiKey: geminiApiKey });
            const contentParts = [];

            if (personImageBuffer) {
                contentParts.push(
                    { text: thumbnailPrompt },
                    { text: 'CRITICAL INSTRUCTION: Here is a reference image. You MUST replicate the EXACT face, facial features, skin tone, hair style, hair color, eye color, facial structure, body type, outfit, and clothing from this reference image. DO NOT change, modify, or hallucinate ANY aspect of the person\'s appearance.\n\nThe reference image shows the EXACT person you must generate. Keep every detail of their appearance IDENTICAL - same face, same outfit, same physical characteristics.\n\nYou may ONLY change the camera angle, framing, and background as specified in the text prompt. The person themselves must look EXACTLY like the reference image.' },
                    {
                        inlineData: {
                            mimeType: 'image/png',
                            data: personImageBuffer.toString('base64'),
                        },
                    },
                    { text: 'Generate a stunning, photorealistic, cinematic photograph with the EXACT same person from the reference image. Only change the camera framing and background as specified in the prompt. The person must be IDENTICAL to the reference image.\n\nGenerate high-quality, photorealistic image in vertical 9:16 aspect ratio for video thumbnail.' }
                );
            } else {
                contentParts.push({
                    text: thumbnailPrompt + '\n\nGenerate a stunning, photorealistic, cinematic video thumbnail matching the exact framing and topic of the prompt.\n\nGenerate high-quality, photorealistic image in vertical 9:16 aspect ratio.',
                });
            }

            console.log('📸 Calling Gemini Fallback for thumbnail...');

            const response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-image-preview',
                contents: contentParts,
                config: {
                    responseModalities: ['TEXT', 'IMAGE'],
                },
            });

            let imageBase64 = null;
            let responseText = '';

            if (response.candidates && response.candidates[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.text) responseText += part.text;
                    else if (part.inlineData) imageBase64 = part.inlineData.data;
                }
            }

            if (!imageBase64) throw new Error(`Gemini Fallback did not return an image. Response: ${responseText || '(empty)'}`);

            console.log('✅ Fallback: Thumbnail generated successfully by Gemini');
            return { imageBuffer: Buffer.from(imageBase64, 'base64'), generatedBy: 'gemini' };
        }
    }
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

        const tasks = [];

        // Task 1: Render branded video via FFmpeg
        const brandingTask = (async () => {
            await applyBranding(inputPath, outputPath, {
                logoPath,
                marqueeText,
                marqueePosition,
                logoPosition,
            });

            const brandedBuffer = fs.readFileSync(outputPath);
            const storagePath   = `AIInfluencer/${jobId}/final-branded.mp4`;
            return await uploadToFirebase(brandedBuffer, storagePath, 'video/mp4');
        })();
        tasks.push(brandingTask);

        // Task 2: Generate thumbnail image via NanoBanana2 (Concurrent)
        let thumbnailTask = Promise.resolve(null);
        if (event.generateThumbnail && event.thumbnailPrompt) {
            // Check if thumbnail was already successfully generated by Fal AI models
            const firestore = admin.firestore();
            const jobRef = firestore.collection('users').doc(userId).collection('aiInfluencerJobs').doc(jobId);
            const jobDoc = await jobRef.get();
            const jobData = jobDoc.exists ? jobDoc.data() : {};
            
            const alreadyGenerated = jobData.thumbnailGeneratedBy === 'nano-banana-2' 
                                  || jobData.thumbnailGeneratedBy === 'flux-2/turbo';
            
            if (alreadyGenerated) {
                console.log(`⚠️ Thumbnail already generated by ${jobData.thumbnailGeneratedBy}. Skipping.`);
                thumbnailTask = Promise.resolve({ 
                    thumbnailUrl: jobData.customThumbnailUrl,
                    generatedBy: jobData.thumbnailGeneratedBy,
                    skipped: true
                });
            } else {
                console.log(`🖼️ Enabling Thumbnail Generation...`);
                thumbnailTask = (async () => {
                    let pImageBuffer = null;
                    if (event.thumbnailPersonPhotoUrl) {
                        pImageBuffer = await downloadFromUrl(event.thumbnailPersonPhotoUrl);
                    } else if (event.thumbnailPersonPhotoBase64) {
                        pImageBuffer = Buffer.from(event.thumbnailPersonPhotoBase64, 'base64');
                    }

                    const { imageBuffer, generatedBy } = await generateWithNanoBanana(
                        event.thumbnailPrompt, 
                        event.thumbnailPersonPhotoUrl, 
                        pImageBuffer
                    );

                    const storagePath = `AIInfluencer/${jobId}/thumbnail.png`;
                    const thumbnailUrl = await uploadToFirebase(imageBuffer, storagePath, 'image/png');
                    
                    return { thumbnailUrl, generatedBy };
                })();
                tasks.push(thumbnailTask);
            }
        }

        const [brandedVideoUrl, customThumbnailUrl] = await Promise.all([brandingTask, thumbnailTask]);

        const updateFields = {
            brandedVideoUrl,
            brandingStatus: 'complete',
        };

        if (customThumbnailUrl) {
            updateFields.customThumbnailUrl = customThumbnailUrl.thumbnailUrl;
            updateFields.thumbnailGeneratedBy = customThumbnailUrl.generatedBy;
            if (!customThumbnailUrl.skipped) {
                updateFields.thumbnailGeneratedAt = admin.firestore.FieldValue.serverTimestamp();
            }
        }

        await updateJobDoc(jobId, userId, updateFields);

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
