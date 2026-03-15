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

// ────────────────────────────────────────────────────
// FFmpeg Compositing
// ────────────────────────────────────────────────────

function compositeImagesOnVideo(videoPath, images, outputPath, srtPath = null) {
    return new Promise(async (resolve, reject) => {
        const hasImages = images && images.length > 0;

        if (!hasImages && !srtPath) {
            fs.copyFileSync(videoPath, outputPath);
            return resolve();
        }

        console.log(`🖼️ Compositing ${hasImages ? images.length : 0} images and ${srtPath ? 'subtitles' : 'no subtitles'} onto video...`);

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

        if (srtPath && fs.existsSync(srtPath)) {
            try {
                const fontPath = '/tmp/Roboto-Bold.ttf';
                if (!fs.existsSync(fontPath)) {
                    const fontBuf = await downloadFromUrl('https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Bold.ttf');
                    fs.writeFileSync(fontPath, fontBuf);
                }

                const srtText = fs.readFileSync(srtPath, 'utf8');
                const blocks = srtText.split(/\r?\n\r?\n/).filter(b => b.trim());

                let currentIn = '[outv]';
                blocks.forEach((block, idx) => {
                    const lines = block.split(/\r?\n/);
                    if (lines.length >= 3) {
                        const timeParts = lines[1].split(' --> ');
                        if (timeParts.length === 2) {
                            const start = parseSrtTime(timeParts[0]);
                            const end = parseSrtTime(timeParts[1]);

                            const words = lines.slice(2).join(' ').split(/\s+/);
                            let wrappedLines = [];
                            let currentLine = '';

                            for (const word of words) {
                                if (currentLine.length + word.length > 20) {
                                    if (currentLine) wrappedLines.push(currentLine.trim());
                                    currentLine = word + ' ';
                                } else {
                                    currentLine += word + ' ';
                                }
                            }
                            if (currentLine.trim()) wrappedLines.push(currentLine.trim());

                            const maxLen = Math.max(...wrappedLines.map(l => l.length));
                            let wrappedText = wrappedLines.map(line => {
                                const padCount = Math.floor((maxLen - line.length) / 2);
                                return '\u2002'.repeat(padCount) + line;
                            }).join('\n');

                            const textFilePath = `/tmp/sub_${Date.now()}_${idx}.txt`;
                            fs.writeFileSync(textFilePath, wrappedText);

                            const outLabel = `[subs${idx}]`;
                            finalFilterComplex += `;${currentIn}drawtext=fontfile='${fontPath}':textfile='${textFilePath}':enable='between(t,${start},${end})':fontsize=24:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)-160:borderw=2:bordercolor=black@0.9:line_spacing=5${outLabel}`;
                            currentIn = outLabel;
                        }
                    }
                });

                if (currentIn !== '[outv]') {
                    finalFilterComplex += `;${currentIn}copy[outv_subs]`;
                } else {
                    srtPath = null;
                }
            } catch (err) {
                console.error('⚠️ Failed to generate drawtext subtitles graph:', err.message);
                srtPath = null;
            }
        }

        const videoMap = srtPath ? '[outv_subs]' : '[outv]';
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
    const { jobId, userId, lipSyncVideoUrl, audioUrl, imageTimeline, srtPath: remoteSrtPath } = event;

    console.log(`🎬 RENDERER: Starting final assembly for Job ${jobId}`);

    try {
        await updateJobDoc(jobId, userId, { status: 'rendering' });

        // 1. Download Assets
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

        // Handle subtitles if present
        let localSrtPath = null;
        if (remoteSrtPath) {
            try {
                console.log('Got remoteSrtPath:', remoteSrtPath);
                if (remoteSrtPath.startsWith('http')) {
                    const srtBuf = await downloadFromUrl(remoteSrtPath);
                    localSrtPath = `/tmp/${jobId}-captions.srt`;
                    fs.writeFileSync(localSrtPath, srtBuf);
                }
            } catch (err) {
                console.warn('⚠️ Could not download SRT:', err.message);
            }
        }

        // 2. FFmpeg Rendering
        const finalLocalPath = `/tmp/${jobId}-final.mp4`;
        await compositeImagesOnVideo(lipSyncPath, downloadedImages, finalLocalPath, localSrtPath);

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
            lipSyncPath, finalLocalPath, localSrtPath,
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
