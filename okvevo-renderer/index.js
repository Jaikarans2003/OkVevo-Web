const admin = require('firebase-admin');
const https = require('https');
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
    throw new Error("Missing Firebase Service Account Key (FIREBASE_SERVICE_ACCOUNT_KEY or FB_SERVICE_ACCOUNT_KEY)");
}
const serviceAccount = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf-8'));
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'text2video-16cbf.firebasestorage.app'
    });
}

// ────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────

async function updateJobDoc(jobId, userId, fields) {
    const firestore = admin.firestore();
    await firestore.collection('users').doc(userId).collection(JOBS_COLLECTION).doc(jobId).set({
        ...fields,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}

function httpsRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                return httpsRequest(res.headers.location).then(resolve).catch(reject);
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve({ statusCode: res.statusCode, buffer: Buffer.concat(chunks) }));
        });
        req.on('error', reject);
    });
}

async function downloadFromUrl(url) {
    const response = await httpsRequest(url);
    if (response.statusCode !== 200) throw new Error(`Download failed: ${response.statusCode}`);
    return response.buffer;
}

async function downloadFromFirebaseStorage(storagePath) {
    console.log(`📥 Downloading from Firebase Storage: ${storagePath}`);
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    const [buffer] = await file.download();
    return buffer;
}

async function uploadToFirebase(buffer, storagePath, contentType) {
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.save(buffer, { metadata: { contentType } });
    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

// Helper to convert SRT time (00:00:01,500 or 00:00:231) to seconds (1.5)
function parseSrtTime(timeStr) {
    let normalized = timeStr.trim().replace(',', '.');
    const lastColon = normalized.lastIndexOf(':');
    if (lastColon > 0 && normalized.substring(lastColon + 1).length === 3) {
        normalized = normalized.substring(0, lastColon) + '.' + normalized.substring(lastColon + 1);
    }
    const parts = normalized.split(':');
    let secs = 0;
    if (parts.length === 3) {
        secs += parseInt(parts[0], 10) * 3600;
        secs += parseInt(parts[1], 10) * 60;
        secs += parseFloat(parts[2]);
    } else if (parts.length === 2) {
        secs += parseInt(parts[0], 10) * 60;
        secs += parseFloat(parts[1]);
    } else if (parts.length === 1) {
        secs += parseFloat(parts[0]);
    }
    return secs || 0;
}

// Helper to format seconds to SRT time format (HH:MM:SS,mmm)
function formatSrtTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

// Helper to safely extract timestamps from Whisper chunk (handles multiple formats)
function getTimestamps(chunk) {
    if (chunk.timestamp) return chunk.timestamp;
    if (chunk.timestamps) return chunk.timestamps;
    if (chunk.start !== undefined && chunk.end !== undefined) {
        return [chunk.start, chunk.end];
    }
    return [0, 0];
}

// Convert Whisper transcription chunks to SRT format
function whisperChunksToSrt(chunks) {
    if (!chunks || chunks.length === 0) return null;
    
    let srtContent = '';
    chunks.forEach((chunk, idx) => {
        const [start, end] = getTimestamps(chunk);
        const startTime = formatSrtTime(start);
        const endTime = formatSrtTime(end);
        
        srtContent += `${idx + 1}\n`;
        srtContent += `${startTime} --> ${endTime}\n`;
        srtContent += `${chunk.text}\n\n`;
    });
    
    return srtContent;
}

// ────────────────────────────────────────────────────
// Gemini Speech-to-Text Caption Generation
// ────────────────────────────────────────────────────

/**
 * Calls Gemini API to transcribe audio and produce SRT subtitle content.
 * Uses inline base64 audio data to avoid any extra upload step.
 * @param {Buffer} audioBuffer - The raw audio buffer (mp3/mpeg)
 * @returns {Promise<string|null>} SRT formatted subtitle string or null on failure
 */
async function generateCaptionsWithGemini(audioBuffer) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
        console.warn('⚠️ Gemini API key not set — skipping caption generation');
        return null;
    }

    console.log('🎤 Generating captions via Gemini speech-to-text...');

    const base64Audio = audioBuffer.toString('base64');
    const requestBody = {
        contents: [{
            parts: [
                {
                    inline_data: {
                        mime_type: 'audio/mpeg',
                        data: base64Audio
                    }
                },
                {
                    text: `Transcribe this audio and output the result ONLY as a valid SRT subtitle file. 
Use this exact format for each entry:

1
00:00:00,000 --> 00:00:03,000
Subtitle text here

2
00:00:03,000 --> 00:00:06,000
Next subtitle text

Rules:
- Each subtitle block should be 2-4 seconds long
- Keep each subtitle to 1-2 short lines (max ~8 words per line)
- Output ONLY the SRT content, no explanations, no markdown, no code blocks
- Start timestamps from 00:00:00,000`
                }
            ]
        }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096
        }
    };

    return new Promise((resolve) => {
        const body = JSON.stringify(requestBody);
        const parsedUrl = new URL(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
        );
        const reqOptions = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = require('https').request(reqOptions, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                try {
                    const json = JSON.parse(Buffer.concat(chunks).toString());
                    const srtText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (srtText.trim()) {
                        console.log(`✅ Gemini generated ${srtText.split('\n\n').length} subtitle blocks`);
                        resolve(srtText.trim());
                    } else {
                        console.warn('⚠️ Gemini returned empty transcription');
                        resolve(null);
                    }
                } catch (e) {
                    console.error('⚠️ Failed to parse Gemini response:', e.message);
                    resolve(null);
                }
            });
        });
        req.on('error', (e) => {
            console.error('⚠️ Gemini request error:', e.message);
            resolve(null);
        });
        req.write(body);
        req.end();
    });
}

// ────────────────────────────────────────────────────
// Phrase-Based Caption System (libass)
// ────────────────────────────────────────────────────

// Convert seconds to ASS time format (H:MM:SS.CS)
function secondsToAssTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = (sec % 60).toFixed(2);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(5, '0')}`;
}

// Smart text wrapping for captions (max 18 chars per line)
function smartWrapText(text) {
    const words = text.split(' ');
    let lines = [];
    let current = '';

    for (let word of words) {
        if ((current + word).length > 18) {
            lines.push(current.trim());
            current = word + ' ';
        } else {
            current += word + ' ';
        }
    }

    if (current.trim()) lines.push(current.trim());

    return lines.join('\\N'); // ASS line break
}

// Group word-by-word chunks into natural phrases (2-4 sec duration)
function groupWordsIntoPhrases(chunks) {
    if (!chunks || chunks.length === 0) return [];

    const phrases = [];
    let currentPhrase = [];
    let startTime = null;

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const [start, end] = getTimestamps(chunk);

        if (startTime === null) startTime = start;

        currentPhrase.push(chunk.text.trim());

        const duration = end - startTime;
        const wordCount = currentPhrase.length;

        const shouldBreak =
            duration >= 2.5 ||         // max duration
            wordCount >= 6 ||         // max words
            chunk.text.includes('.') || 
            chunk.text.includes(',') ||
            chunk.text.includes('!');

        if (shouldBreak || i === chunks.length - 1) {
            phrases.push({
                text: currentPhrase.join(' '),
                start: startTime,
                end: end
            });

            currentPhrase = [];
            startTime = null;
        }
    }

    return phrases;
}

// Convert phrases to ASS format with premium pill-style captions
function phrasesToAss(phrases) {
    let ass = `[Script Info]
Title: AI Influencer Captions
ScriptType: v4.00+
PlayResX: 360
PlayResY: 640
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,Helvetica Neue,42,&H00FFFFFF,&H000000FF,&H00000000,&H99000000,0,0,0,0,100,105,0.5,0,3,0,0,2,30,30,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    phrases.forEach(p => {
        const start = secondsToAssTime(p.start);
        const end = secondsToAssTime(p.end);
        const wrapped = smartWrapText(p.text);

        ass += `Dialogue: 0,${start},${end},Default,,0,0,0,,${wrapped}\n`;
    });

    return ass;
}

// Legacy SRT time converter (kept for backward compatibility)
function srtTimeToAss(srtTime) {
    const normalized = srtTime.trim().replace(',', '.');
    const parts = normalized.split(':');
    
    if (parts.length === 3) {
        const hours = parseInt(parts[0], 10);
        const minutes = parts[1];
        const seconds = parseFloat(parts[2]).toFixed(2);
        return `${hours}:${minutes}:${seconds}`;
    }
    
    return '0:00:00.00';
}

// Legacy SRT to ASS converter (fallback for pre-built SRT files)
function convertSrtToAss(srtPath) {
    const srtContent = fs.readFileSync(srtPath, 'utf8');
    
    let ass = `[Script Info]
Title: AI Influencer Captions
ScriptType: v4.00+
PlayResX: 360
PlayResY: 640
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,Helvetica Neue,42,&H00FFFFFF,&H000000FF,&H00000000,&H99000000,0,0,0,0,100,105,0.5,0,3,0,0,2,30,30,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    const blocks = srtContent.split(/\r?\n\r?\n/).filter(b => b.trim());
    
    blocks.forEach(block => {
        const lines = block.split(/\r?\n/);
        if (lines.length >= 3) {
            const timeParts = lines[1].split(' --> ');
            if (timeParts.length === 2) {
                const start = srtTimeToAss(timeParts[0]);
                const end = srtTimeToAss(timeParts[1]);
                const text = lines.slice(2).join('\\N');
                
                ass += `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}\n`;
            }
        }
    });
    
    return ass;
}

// ────────────────────────────────────────────────────
// FFmpeg Compositing
// ────────────────────────────────────────────────────

function compositeImagesOnVideo(videoPath, images, outputPath, assPath = null) {
    return new Promise(async (resolve, reject) => {
        const hasImages = images && images.length > 0;

        if (!hasImages && !assPath) {
            fs.copyFileSync(videoPath, outputPath);
            return resolve();
        }

        console.log(`🖼️ Compositing ${hasImages ? images.length : 0} images and ${assPath ? 'phrase-based captions' : 'no subtitles'} onto video...`);

        const args = ['-i', videoPath];
        if (hasImages) {
            images.forEach((img) => {
                const imgDuration = img.end - img.start;
                args.push('-loop', '1', '-framerate', '30', '-t', String(imgDuration), '-i', img.localPath);
            });
        }

        const hasSplit = hasImages && images.some(img => img.layout === 'split');
        let filterComplex = '';

        filterComplex += '[0:v]scale=360:640:force_original_aspect_ratio=increase,crop=360:640,fps=30,format=yuv420p[base_raw];';

        let currentBase;
        if (hasSplit) {
            filterComplex += '[base_raw]split=2[base][basecopy];';
            filterComplex += '[basecopy]crop=360:320:0:0[vsmall_top];';
            filterComplex += '[vsmall_top]pad=360:640:0:320:black[vbottom];';

            const splitEnables = images
                .filter(img => img.layout === 'split')
                .map(img => `between(t,${img.start},${img.end})`)
                .join('+');

            filterComplex += `[base][vbottom]overlay=0:0:enable='${splitEnables}'[splitbase];`;
            currentBase = 'splitbase';
        } else {
            currentBase = 'base_raw';
        }

        if (hasImages) {
            images.forEach((img, idx) => {
                const inputIdx = idx + 1;
                if (img.layout === 'fullscreen') {
                    filterComplex += `[${inputIdx}:v]scale=360:640:force_original_aspect_ratio=increase,crop=360:640,fps=30,format=yuv420p[img${idx}];`;
                } else {
                    filterComplex += `[${inputIdx}:v]scale=360:320:force_original_aspect_ratio=increase,crop=360:320,fps=30,format=yuv420p[img${idx}];`;
                }
            });
        }

        let sfxCount = 0;
        let audioFilterComplex = '';
        audioFilterComplex += `[0:a]volume=2.0[base_vocal];`;
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

        let prevLabel = currentBase;
        if (hasImages) {
            images.forEach((img, idx) => {
                const timeEnable = `between(t,${img.start},${img.end})`;
                const outLabel = idx === images.length - 1 ? 'outv' : `tmp${idx}`;
                filterComplex += `[${prevLabel}][img${idx}]overlay=0:0:enable='${timeEnable}'[${outLabel}];`;
                prevLabel = outLabel;
            });
        } else {
            filterComplex += `[${prevLabel}]copy[outv];`;
        }

        if (sfxCount > 0) {
            const mixInputs = audioInputLabels.join('');
            audioFilterComplex += `${mixInputs}amix=inputs=${audioInputLabels.length}:duration=first:dropout_transition=2[outa];`;
        }

        let finalFilterComplex = filterComplex.replace(/;$/, '');
        if (audioFilterComplex) {
            finalFilterComplex += ';' + audioFilterComplex.replace(/;$/, '');
        }

        if (assPath && fs.existsSync(assPath)) {
            try {
                const assContent = fs.readFileSync(assPath, 'utf8');
                const eventCount = assContent.split('\n').filter(line => line.startsWith('Dialogue:')).length;
                console.log(`✅ Applying ${eventCount} phrase-based captions with libass`);
                
                // Use subtitles filter with libass for premium caption rendering
                finalFilterComplex += `;[outv]subtitles='${assPath}':fontsdir=/tmp[outv_subs]`;
                
            } catch (err) {
                console.error('⚠️ Failed to apply ASS subtitles:', err.message);
                assPath = null;
            }
        }

        const videoMap = assPath ? '[outv_subs]' : '[outv]';
        const audioMap = sfxCount > 0 ? '[outa]' : '[base_vocal]';

        const ffmpegArgs = [
            ...args,
            '-filter_complex', finalFilterComplex,
            '-map', videoMap,
            '-map', audioMap,
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
        const ffmpeg = spawn(FFMPEG, ffmpegArgs, { cwd: '/tmp' });

        let stderr = '';
        ffmpeg.stderr.on('data', (d) => { stderr += d.toString(); });
        ffmpeg.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg compositor exited with code ${code}. Stderr: ${stderr.slice(-1000)}`));
        });
        ffmpeg.on('error', reject);
    });
}

// ────────────────────────────────────────────────────
// Lambda Handler
// ────────────────────────────────────────────────────

exports.handler = async (event) => {
    const { 
        jobId, 
        userId, 
        lipSyncVideoUrl, 
        audioUrl,
        imageTimeline, 
        srtPath: remoteSrtPath,
        lipSyncResult
    } = event;
    
    // Extract transcription from lipSyncResult with fallback
    const transcription = lipSyncResult?.transcription || '';
    const transcriptionChunks = lipSyncResult?.transcriptionChunks || [];

    console.log(`🎬 RENDERER: Starting final assembly for Job ${jobId}`);

    try {
        await updateJobDoc(jobId, userId, { status: 'rendering' });

        // 1. Download Assets
        console.log(`📹 Downloading LipSync video: "${lipSyncVideoUrl}"`);
        if (!lipSyncVideoUrl || typeof lipSyncVideoUrl !== 'string' || !lipSyncVideoUrl.startsWith('http')) {
             throw new Error(`Invalid LipSync video URL provided: "${lipSyncVideoUrl}"`);
        }
        const lipSyncPath = `/tmp/${jobId}-lipsync.mp4`;
        const videoBuf = await downloadFromUrl(lipSyncVideoUrl);
        fs.writeFileSync(lipSyncPath, videoBuf);

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

        const downloadedImages = [];
        if (imageTimeline) {
            const validImages = imageTimeline.filter(img => img.imageUrl);
            for (let i = 0; i < validImages.length; i++) {
                const img = validImages[i];
                try {
                    const imgBuf = await downloadFromUrl(img.imageUrl);
                    const imgPath = `/tmp/${jobId}-img-${i}.jpg`;
                    fs.writeFileSync(imgPath, imgBuf);

                    const sfxPath = sfxPaths.length > 0 ? sfxPaths[Math.floor(Math.random() * sfxPaths.length)] : null;

                    downloadedImages.push({
                        ...img,
                        localPath: imgPath,
                        start: img.start,
                        end: img.end,
                        layout: img.layout || 'split',
                        sfxPath: sfxPath
                    });
                } catch (err) {
                    console.warn(`⚠️ Skipping image ${i} (${img.topic}): ${err.message}`);
                }
            }
        }

        // Handle subtitles — priority: Whisper Phrases > remoteSrtPath > Gemini
        let localAssPath = null;
        
        // Option 1: Use Whisper transcription chunks (PREFERRED - Phrase-based)
        if (transcriptionChunks && transcriptionChunks.length > 0) {
            try {
                console.log(`🎬 Generating phrase-based captions from ${transcriptionChunks.length} word chunks`);
                const phrases = groupWordsIntoPhrases(transcriptionChunks);
                console.log(`✅ Grouped into ${phrases.length} natural phrases`);
                
                const assContent = phrasesToAss(phrases);
                localAssPath = `/tmp/${jobId}-captions.ass`;
                fs.writeFileSync(localAssPath, assContent, 'utf8');
                console.log(`✅ Phrase-based ASS captions written to ${localAssPath}`);
            } catch (err) {
                console.warn('⚠️ Failed to generate phrase-based captions:', err.message);
            }
        }
        
        // Option 2: Pre-built SRT provided (fallback to legacy conversion)
        if (!localAssPath && remoteSrtPath) {
            try {
                console.log('� Got remoteSrtPath, using legacy SRT conversion:', remoteSrtPath);
                if (remoteSrtPath.startsWith('http')) {
                    const srtBuf = await downloadFromUrl(remoteSrtPath);
                    const localSrtPath = `/tmp/${jobId}-captions.srt`;
                    fs.writeFileSync(localSrtPath, srtBuf);
                    
                    const assContent = convertSrtToAss(localSrtPath);
                    localAssPath = `/tmp/${jobId}-captions.ass`;
                    fs.writeFileSync(localAssPath, assContent, 'utf8');
                    console.log('✅ Converted SRT to ASS format');
                }
            } catch (err) {
                console.warn('⚠️ Could not process SRT:', err.message);
            }
        }

        // Option 3: Fallback to Gemini (only if no Whisper or SRT available)
        if (!localAssPath && audioUrl) {
            try {
                console.log('⚠️ No Whisper data - falling back to Gemini for captions...');
                const audioBuffer = await downloadFromUrl(audioUrl);
                const srtContent = await generateCaptionsWithGemini(audioBuffer);
                if (srtContent) {
                    const localSrtPath = `/tmp/${jobId}-captions.srt`;
                    fs.writeFileSync(localSrtPath, srtContent, 'utf8');
                    
                    const assContent = convertSrtToAss(localSrtPath);
                    localAssPath = `/tmp/${jobId}-captions.ass`;
                    fs.writeFileSync(localAssPath, assContent, 'utf8');
                    console.log(`✅ Gemini captions converted to ASS format`);
                }
            } catch (err) {
                console.warn('⚠️ Failed to generate Gemini captions:', err.message);
            }
        }

        // 2. FFmpeg Rendering
        const finalLocalPath = `/tmp/${jobId}-final.mp4`;
        await compositeImagesOnVideo(lipSyncPath, downloadedImages, finalLocalPath, localAssPath);

        // 3. Upload to Firebase
        const finalBuffer = fs.readFileSync(finalLocalPath);
        const remotePath = `AIInfluencer/${jobId}/final.mp4`;
        const finalVideoUrl = await uploadToFirebase(finalBuffer, remotePath, 'video/mp4');

        // 4. Mark Complete
        await updateJobDoc(jobId, userId, {
            status: 'complete',
            finalVideoUrl,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Cleanup temp files
        const filesToCleanup = [
            lipSyncPath, finalLocalPath, localAssPath,
            ...sfxPaths,
            ...downloadedImages.map(img => img.localPath)
        ].filter(Boolean);
        filesToCleanup.forEach(p => { try { fs.unlinkSync(p); } catch(_) {} });

        console.log(`✅ Job ${jobId} Complete: ${finalVideoUrl}`);
        return { success: true, finalVideoUrl };

    } catch (error) {
        console.error(`❌ Renderer Error:`, error);
        await updateJobDoc(jobId, userId, { status: 'failed', error: error.message });
        throw error;
    }
};
