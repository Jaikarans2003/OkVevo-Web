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

// Helper to get actual video duration using ffprobe
function getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
        const ffprobe = spawn('/opt/bin/ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            videoPath
        ]);
        
        let output = '';
        ffprobe.stdout.on('data', (data) => { output += data.toString(); });
        ffprobe.on('close', (code) => {
            if (code === 0) {
                const duration = parseFloat(output.trim());
                if (!isNaN(duration) && duration > 0) {
                    resolve(duration);
                } else {
                    reject(new Error(`Invalid duration: ${output}`));
                }
            } else {
                reject(new Error(`ffprobe exited with code ${code}`));
            }
        });
        ffprobe.on('error', reject);
    });
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

// Map script words to Whisper word timestamps
function mapScriptToWhisperChunks(scriptText, whisperChunks, videoDuration = null) {
    if (!whisperChunks || whisperChunks.length === 0) return [];
    if (!scriptText || scriptText.trim().length === 0) return [];

    // Clean script and split into words
    const scriptWords = scriptText
        .replace(/\n/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0);

    // Get all word-level timestamps from Whisper with cleaned text for matching
    const whisperWords = whisperChunks.map(chunk => {
        const [start, end] = getTimestamps(chunk);
        return {
            text: chunk.text.trim(),
            clean: chunk.text.trim().toLowerCase().replace(/[^a-z0-9]/g, ''),
            start,
            end
        };
    });

    // ── Detect Whisper failure (< 20% coverage) ──
    const whisperCoverageRatio = whisperWords.length / scriptWords.length;
    const MINIMUM_COVERAGE = 0.20;
    
    console.log(`📊 Whisper coverage: ${whisperWords.length} chunks / ${scriptWords.length} script words = ${(whisperCoverageRatio * 100).toFixed(1)}%`);
    
    if (whisperCoverageRatio < MINIMUM_COVERAGE) {
        console.warn(`⚠️ Whisper coverage too low (${(whisperCoverageRatio * 100).toFixed(1)}%) — using full duration interpolation`);
        return interpolateAllWords(scriptWords, videoDuration);
    }

    // ── Step 1: Calculate average word duration from Whisper data ──
    const totalWhisperDuration = whisperWords[whisperWords.length - 1].end - whisperWords[0].start;
    const avgWordDuration = totalWhisperDuration / whisperWords.length;
    console.log(`📊 Avg word duration from Whisper: ${avgWordDuration.toFixed(3)}s (${whisperWords.length} words over ${totalWhisperDuration.toFixed(2)}s)`);

    // ── Step 2: Find alignment point (where script matches Whisper) ──
    const cleanScript = scriptWords.map(w =>
        w.toLowerCase().replace(/[^a-z0-9]/g, '')
    );

    let alignIndex = -1;
    for (let w = 0; w < Math.min(5, whisperWords.length); w++) {
        const searchWord = whisperWords[w].clean;
        const found = cleanScript.findIndex(s => s === searchWord);
        if (found !== -1) {
            alignIndex = found - w;
            alignIndex = Math.max(0, alignIndex);
            console.log(`🎯 Alignment found: script[${found}]="${scriptWords[found]}" matches whisper[${w}]="${whisperWords[w].text}"`);
            break;
        }
    }

    // ── Alignment failure fallback ──
    if (alignIndex === -1) {
        console.warn('⚠️ Could not align script to Whisper — falling back to full interpolation');
        return interpolateAllWords(scriptWords, videoDuration);
    }

    const result = [];

    // ── Step 3: Back-calculate missing words using avg word duration ──
    if (alignIndex > 0) {
        const missingWords = scriptWords.slice(0, alignIndex);
        const firstWhisperStart = whisperWords[0].start;

        // Estimate where missing words START based on avg duration
        const estimatedMissingDuration = missingWords.length * avgWordDuration;

        console.log(`⚠️ ${missingWords.length} missing words at start`);
        console.log(`📊 Estimated missing duration: ${estimatedMissingDuration.toFixed(2)}s`);
        console.log(`📊 Actual gap available: ${firstWhisperStart.toFixed(2)}s`);

        // If estimated duration fits within gap — use avg duration per word
        // If not — compress to fit within available gap
        const actualTimePerWord = Math.min(avgWordDuration, firstWhisperStart / missingWords.length);
        
        // Place words ending exactly at firstWhisperStart (back-fill)
        const wordsStart = firstWhisperStart - (missingWords.length * actualTimePerWord);
        const paddedStart = Math.max(0, wordsStart); // never go below 0

        console.log(`📊 Missing words start at: ${paddedStart.toFixed(2)}s using ${actualTimePerWord.toFixed(3)}s/word`);

        missingWords.forEach((word, i) => {
            result.push({
                text: word,
                timestamp: [
                    parseFloat((paddedStart + i * actualTimePerWord).toFixed(2)),
                    parseFloat((paddedStart + (i + 1) * actualTimePerWord).toFixed(2))
                ]
            });
        });
    }

    // ── Step 4: Map remaining words to Whisper 1:1 ──
    const remainingScript = scriptWords.slice(alignIndex);

    remainingScript.forEach((word, i) => {
        if (i < whisperWords.length) {
            // Use exact Whisper timestamps
            result.push({
                text: word,
                timestamp: [whisperWords[i].start, whisperWords[i].end]
            });
        } else {
            // Tail words beyond Whisper — use avg duration
            const lastEnd = whisperWords[whisperWords.length - 1].end;
            result.push({
                text: word,
                timestamp: [
                    parseFloat((lastEnd + (i - whisperWords.length) * avgWordDuration).toFixed(2)),
                    parseFloat((lastEnd + (i - whisperWords.length + 1) * avgWordDuration).toFixed(2))
                ]
            });
        }
    });

    console.log(`✅ Mapped ${result.length} total words (${alignIndex} estimated, ${Math.min(remainingScript.length, whisperWords.length)} exact, ${Math.max(0, remainingScript.length - whisperWords.length)} tail)`);

    return result;
}

// Full interpolation when Whisper coverage is too low or alignment fails
function interpolateAllWords(scriptWords, totalDuration) {
    // Default to 0.3s/word if no duration available
    const duration = totalDuration || (scriptWords.length * 0.3);
    const timePerWord = duration / scriptWords.length;

    console.log(`📊 Full interpolation: ${scriptWords.length} words over ${duration.toFixed(2)}s = ${timePerWord.toFixed(3)}s/word`);

    return scriptWords.map((word, i) => ({
        text: word,
        timestamp: [
            parseFloat((i * timePerWord).toFixed(2)),
            parseFloat(((i + 1) * timePerWord).toFixed(2))
        ]
    }));
}

// Group mapped words into SRT subtitle chunks
function scriptChunksToSrt(mappedWords, wordsPerChunk = 1) {
    if (!mappedWords || mappedWords.length === 0) return null;
    
    let srtContent = '';
    let idx = 1;

    for (let i = 0; i < mappedWords.length; i += wordsPerChunk) {
        const group = mappedWords.slice(i, i + wordsPerChunk);
        const start = group[0].timestamp[0];
        const end = group[group.length - 1].timestamp[1];
        const text = group.map(w => w.text).join(' ');

        srtContent += `${idx}\n`;
        srtContent += `${formatSrtTime(start)} --> ${formatSrtTime(end)}\n`;
        srtContent += `${text}\n\n`;
        idx++;
    }

    return srtContent;
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
// ASS Subtitle Conversion (libass)
// ────────────────────────────────────────────────────

// Convert SRT time format (00:00:01,500) to ASS format (0:00:01.50)
function srtTimeToAss(srtTime) {
    const normalized = srtTime.trim().replace(',', '.');
    const parts = normalized.split(':');
    
    if (parts.length === 3) {
        const hours = parseInt(parts[0], 10);
        const minutes = parts[1];
        const seconds = parseFloat(parts[2]).toFixed(2);
        
        // ASS format: H:MM:SS.CS (centiseconds)
        return `${hours}:${minutes}:${seconds}`;
    }
    
    return '0:00:00.00';
}

// Convert SRT to ASS format with custom styling
function convertSrtToAss(srtPath, images = []) {
    const srtContent = fs.readFileSync(srtPath, 'utf8');
    
    // ASS header with styling optimized for 360x640 vertical video
    let ass = `[Script Info]
Title: AI Influencer Captions
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 360
PlayResY: 640
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Montserrat SemiBold,42,&H00FFFFFF,&H000000FF,&H00000000,&HCC000000,0,0,0,0,100,105,0.5,0,1,3,2,2,30,30,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // Parse SRT and convert to ASS
    const blocks = srtContent.split(/\r?\n\r?\n/).filter(b => b.trim());
    
    blocks.forEach(block => {
        const lines = block.split(/\r?\n/);
        if (lines.length >= 3) {
            const timeParts = lines[1].split(' --> ');
            if (timeParts.length === 2) {
                const startSecs = parseSrtTime(timeParts[0]);
                const endSecs = parseSrtTime(timeParts[1]);
                const start = srtTimeToAss(timeParts[0]);
                const end = srtTimeToAss(timeParts[1]);
                const text = lines.slice(2).join('\\N').toUpperCase(); // \N is line break in ASS
                
                const isSplitIntersect = images.some(img => img.layout === 'split' && !(endSecs <= img.start || startSecs >= img.end));
                const posTag = isSplitIntersect ? '\\an5\\pos(180,320)' : '';
                
                const animatedText = `{${posTag}\\fscx50\\fscy50\\t(0,150,\\fscx100\\fscy100)\\fad(100,100)}${text}`;
                ass += `Dialogue: 0,${start},${end},Default,,0,0,0,,${animatedText}\n`;
            }
        }
    });
    
    return ass;
}

// ────────────────────────────────────────────────────
// FFmpeg Compositing
// ────────────────────────────────────────────────────

function compositeImagesOnVideo(videoPath, images, outputPath, srtPath = null, bgMusicPath = null, videoDuration = null) {
    return new Promise(async (resolve, reject) => {
        const hasImages = images && images.length > 0;

        if (!hasImages && !srtPath && !bgMusicPath) {
            fs.copyFileSync(videoPath, outputPath);
            return resolve();
        }

        console.log(`🖼️ Compositing ${hasImages ? images.length : 0} images, ${srtPath ? 'subtitles' : 'no subtitles'}, and ${bgMusicPath ? 'background music' : 'no music'} onto video...`);

        const args = ['-i', videoPath];
        if (hasImages) {
            images.forEach((img) => {
                const imgDuration = img.end - img.start;
                args.push('-loop', '1', '-framerate', '30', '-t', String(imgDuration), '-i', img.localPath);
            });
        }

        // Add background music input if available
        let bgMusicInputIdx = null;
        if (bgMusicPath && fs.existsSync(bgMusicPath)) {
            bgMusicInputIdx = 1 + (hasImages ? images.length : 0);
            args.push('-i', bgMusicPath);
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
                const streamDur = img.end - img.start;
                const fadeDur = Math.min(0.3, streamDur / 2); // safe fade
                const fadeOutStart = Math.max(0, streamDur - fadeDur);
                if (img.layout === 'fullscreen') {
                    filterComplex += `[${inputIdx}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0015,1.5)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=360x640:fps=30,format=yuva420p,fade=t=in:st=0:d=${fadeDur}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${fadeDur}:alpha=1,setpts=PTS+(${img.start}/TB)[img${idx}];`;
                } else {
                    filterComplex += `[${inputIdx}:v]scale=1080:960:force_original_aspect_ratio=increase,crop=1080:960,zoompan=z='min(zoom+0.0015,1.5)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=360x320:fps=30,format=yuva420p,fade=t=in:st=0:d=${fadeDur}:alpha=1,fade=t=out:st=${fadeOutStart}:d=${fadeDur}:alpha=1,setpts=PTS+(${img.start}/TB)[img${idx}];`;
                }
            });
        }

        let sfxCount = 0;
        let audioFilterComplex = '';
        audioFilterComplex += `[0:a]volume=2.0[base_vocal];`;
        const audioInputLabels = ['[base_vocal]'];

        // Add background music to audio mix if available
        if (bgMusicInputIdx !== null && videoDuration) {
            // Loop background music, extend by 2s for musical tail, fade out over last 2s
            const extendedDuration = videoDuration + 2;
            const fadeOutStart = Math.max(0, extendedDuration - 2); // fade starts at video end
            audioFilterComplex += `[${bgMusicInputIdx}:a]aloop=loop=-1:size=2e+09,atrim=duration=${extendedDuration},asetpts=PTS-STARTPTS,volume=-12dB,afade=t=in:st=0:d=0.5,afade=t=out:st=${fadeOutStart}:d=2[bgmusic];`;
            audioInputLabels.push('[bgmusic]');
        }

        if (hasImages) {
            images.forEach((img) => {
                if (img.sfxPath) {
                    args.push('-i', img.sfxPath);
                    const sfxInputIdx = bgMusicInputIdx !== null
                        ? bgMusicInputIdx + 1 + sfxCount
                        : 1 + images.length + sfxCount;
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

        // Mix or trim audio — decide final audio label BEFORE building finalFilterComplex
        let audioMap;
        if (audioInputLabels.length > 1) {
            const mixInputs = audioInputLabels.join('');
            audioFilterComplex += `${mixInputs}amix=inputs=${audioInputLabels.length}:duration=longest:dropout_transition=0[outa_mixed];`;
            audioFilterComplex += `[outa_mixed]atrim=duration=${videoDuration + 2},asetpts=PTS-STARTPTS[outa];`;
            audioMap = '[outa]';
        } else {
            // Trim single audio input to exact video duration
            audioFilterComplex += `[base_vocal]atrim=duration=${videoDuration},asetpts=PTS-STARTPTS[outa_single];`;
            audioMap = '[outa_single]';
        }

        // NOW build finalFilterComplex — after audio is fully decided
        let finalFilterComplex = filterComplex.replace(/;$/, '');
        if (audioFilterComplex) {
            finalFilterComplex += ';' + audioFilterComplex.replace(/;$/, '');
        }

        // Download font for libass rendering
        let assPath = null;
        if (srtPath && fs.existsSync(srtPath)) {
            try {
                // Download Montserrat SemiBold font to /tmp
                const fontPath = '/tmp/Montserrat-SemiBold.ttf';
                if (!fs.existsSync(fontPath)) {
                    console.log('📥 Downloading Montserrat SemiBold font...');
                    const fontBuf = await downloadFromUrl('https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-SemiBold.ttf');
                    fs.writeFileSync(fontPath, fontBuf);
                    console.log('✅ Font downloaded to /tmp');
                }

                // Convert SRT to ASS format for libass rendering
                assPath = `/tmp/${Date.now()}-captions.ass`;
                const assContent = convertSrtToAss(srtPath, images);
                fs.writeFileSync(assPath, assContent, 'utf8');
                
                const eventCount = assContent.split('\n').filter(line => line.startsWith('Dialogue:')).length;
                console.log(`✅ Generated ASS subtitle file with ${eventCount} dialogue events`);
                
            } catch (err) {
                console.error('⚠️ Failed to generate ASS subtitles:', err.message);
                assPath = null;
            }
        }

        // Add subtitles to the end of filter_complex chain
        if (assPath) {
            finalFilterComplex += `;[outv]subtitles=${assPath}:fontsdir=/tmp[outv_subs]`;
        }

        // Apply fade-out to the final video output (after all overlays and subtitles)
        // Fade starts at videoDuration and completes over 2 seconds to black
        const preFadeLabel = assPath ? '[outv_subs]' : '[outv]';
        // Use tpad to add 2 seconds of black frames BEFORE fading, then fade the extended video
        finalFilterComplex += `;${preFadeLabel}tpad=stop_duration=2:stop_mode=add:color=black[outv_extended]`;
        finalFilterComplex += `;[outv_extended]fade=t=out:st=${videoDuration}:d=2:c=black[outv_final]`;
        const videoMap = '[outv_final]';

        console.log(`🎨 Video: plays ${videoDuration}s, then fades to black over 2s`);

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
            '-t', String(videoDuration + 2),  // Hard cap at lipsync duration + 2s for bgmusic tail
            '-y',
            outputPath
        ];

        console.log('🎬 Running ffmpeg compositor...');
        console.log(`📋 Filter complex (last 500 chars): ...${finalFilterComplex.slice(-500)}`);
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
        lipSyncResult,
        mood,
        duration,
        script: eventScript
    } = event;
    
    // Extract transcription from lipSyncResult with fallback
    const transcription = lipSyncResult?.transcription || '';
    const transcriptionChunks = lipSyncResult?.transcriptionChunks || [];
    
    // DEBUG: Verify script is being passed from Step Function
    console.log(`📝 Script in event: ${eventScript ? eventScript.substring(0, 80) + '...' : 'NOT FOUND - using transcription fallback'}`);
    
    // Extract script - use transcription as fallback if no separate script field
    const script = eventScript || transcription;
    console.log(`📝 Script source: ${eventScript ? 'event.script' : 'transcription fallback'} (${script.length} chars)`);
    
    // Normalize mood with fallback to 'Chill'
    const validMoods = ['Chill', 'Dramatic', 'Energetic', 'Funny', 'Happy', 'Suspense'];
    let normalizedMood = mood || 'Chill';
    // Handle typo: Suspence -> Suspense
    if (normalizedMood === 'Suspence') normalizedMood = 'Suspense';
    if (!validMoods.includes(normalizedMood)) normalizedMood = 'Chill';

    console.log(`🎬 RENDERER: Starting final assembly for Job ${jobId} | Mood: ${normalizedMood}`);

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

        // Detect actual video duration using ffprobe
        let actualVideoDuration;
        try {
            actualVideoDuration = await getVideoDuration(lipSyncPath);
            console.log(`🎬 Detected actual lipsync video duration: ${actualVideoDuration.toFixed(2)}s (expected: ${duration}s)`);
        } catch (err) {
            console.warn(`⚠️ FFprobe failed: ${err.message}`);
            
            // Try deriving from Whisper chunks as fallback
            if (transcriptionChunks && transcriptionChunks.length > 0) {
                const lastChunk = transcriptionChunks[transcriptionChunks.length - 1];
                const [, lastEnd] = getTimestamps(lastChunk);
                if (lastEnd > 0) {
                    actualVideoDuration = lastEnd + 0.5; // small buffer
                    console.log(`📝 Using Whisper-derived duration: ${actualVideoDuration.toFixed(2)}s`);
                } else {
                    actualVideoDuration = duration || 15;
                    console.warn(`⚠️ Falling back to expected duration: ${actualVideoDuration}s`);
                }
            } else {
                actualVideoDuration = duration || 15;
                console.warn(`⚠️ Falling back to expected duration: ${actualVideoDuration}s`);
            }
        }

        // Download all SFX files from InfluencerAudio/SFX directory
        let sfxPaths = [];
        try {
            const bucket = admin.storage().bucket();
            const [files] = await bucket.getFiles({ prefix: 'InfluencerAudio/SFX/' });
            
            // Filter out directory markers and get only audio files
            const audioFiles = files.filter(file => {
                const name = file.name.toLowerCase();
                return !name.endsWith('/') && (name.endsWith('.mp3') || name.endsWith('.mpeg') || name.endsWith('.wav'));
            });

            if (audioFiles.length === 0) {
                console.warn('⚠️ No SFX files found in InfluencerAudio/SFX/');
            } else {
                for (let i = 0; i < audioFiles.length; i++) {
                    const file = audioFiles[i];
                    const [buffer] = await file.download();
                    const sfxPath = `/tmp/${jobId}-sfx${i}.mpeg`;
                    fs.writeFileSync(sfxPath, buffer);
                    sfxPaths.push(sfxPath);
                }
                console.log(`✅ Downloaded ${sfxPaths.length} SFX files from InfluencerAudio/SFX/`);
            }
        } catch (err) {
            console.warn(`⚠️ Failed to download SFX files, overlays will be silent: ${err.message}`);
        }

        // Download background music based on mood
        let bgMusicPath = null;
        try {
            const bucket = admin.storage().bucket();
            const moodDirectory = `InfluencerAudio/${normalizedMood}/`;
            console.log(`🎵 Fetching background music from ${moodDirectory}...`);
            
            const [files] = await bucket.getFiles({ prefix: moodDirectory });
            
            // Filter out directory markers and get only audio files
            const musicFiles = files.filter(file => {
                const name = file.name.toLowerCase();
                return !name.endsWith('/') && (name.endsWith('.mp3') || name.endsWith('.mpeg') || name.endsWith('.wav'));
            });

            if (musicFiles.length === 0) {
                console.warn(`⚠️ No background music found in ${moodDirectory}`);
            } else {
                // Select random music file
                const randomMusic = musicFiles[Math.floor(Math.random() * musicFiles.length)];
                const [buffer] = await randomMusic.download();
                bgMusicPath = `/tmp/${jobId}-bgmusic.mp3`;
                fs.writeFileSync(bgMusicPath, buffer);
                console.log(`✅ Downloaded background music: ${randomMusic.name}`);
            }
        } catch (err) {
            console.warn(`⚠️ Failed to download background music: ${err.message}`);
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
                        layout: 'split', // default — will be overridden below
                        sfxPath: sfxPath
                    });
                } catch (err) {
                    console.warn(`⚠️ Skipping image ${i} (${img.topic}): ${err.message}`);
                }
            }
        }

        // ── Randomly assign fullscreen layout to some photos ──
        // Determines how many photos become fullscreen based on video duration:
        //   0–15s  → 1 fullscreen
        //   15–30s → 2 fullscreen
        //   30–60s → 3 fullscreen
        if (downloadedImages.length > 0) {
            // Use actual detected duration for fullscreen count
            let fullscreenCount;
            if (actualVideoDuration <= 15) {
                fullscreenCount = 1;
            } else if (actualVideoDuration <= 30) {
                fullscreenCount = 2;
            } else {
                fullscreenCount = 3;
            }

            // Cap to available images (never more fullscreen than we have photos)
            fullscreenCount = Math.min(fullscreenCount, downloadedImages.length);

            // Build array of indices and shuffle (Fisher-Yates) to pick random ones
            const indices = downloadedImages.map((_, i) => i);
            for (let i = indices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [indices[i], indices[j]] = [indices[j], indices[i]];
            }

            const fullscreenIndices = new Set(indices.slice(0, fullscreenCount));
            downloadedImages.forEach((img, idx) => {
                img.layout = fullscreenIndices.has(idx) ? 'fullscreen' : 'split';
            });

            // ── Ensure speaker gets a full-screen intro ──
            // Push the first image's start time to at least 2s so the video
            // opens with the speaker's face in full screen before any overlay.
            const SPEAKER_INTRO_SECS = 2;
            if (downloadedImages[0].start < SPEAKER_INTRO_SECS) {
                const shift = SPEAKER_INTRO_SECS - downloadedImages[0].start;
                console.log(`🎤 Shifting first image by +${shift.toFixed(1)}s for full-screen speaker intro`);
                downloadedImages[0].start = SPEAKER_INTRO_SECS;
                // Don't let the end overlap the next image — keep original duration
                downloadedImages[0].end = Math.max(downloadedImages[0].end, SPEAKER_INTRO_SECS + 1);
            }

            const fsNames = downloadedImages
                .filter((_, i) => fullscreenIndices.has(i))
                .map(img => img.topic || `${img.start}-${img.end}s`);
            console.log(`🎲 Randomly assigned ${fullscreenCount} fullscreen photo(s): [${fsNames.join(', ')}]`);
            console.log(`   Layout map: ${downloadedImages.map((img, i) => `#${i}=${img.layout}`).join(', ')}`);
        }

        // ── Clamp image timestamps to actual video duration ──
        // Images must never extend beyond the lipsync video length
        if (downloadedImages.length > 0) {
            const originalCount = downloadedImages.length; // Capture BEFORE mutating

            downloadedImages.forEach(img => {
                img.start = Math.min(img.start, actualVideoDuration);
                img.end   = Math.min(img.end,   actualVideoDuration);
            });

            const clampedImages = downloadedImages.filter(img => img.start < img.end);
            downloadedImages.length = 0;
            clampedImages.forEach(img => downloadedImages.push(img));

            if (clampedImages.length < originalCount) {
                console.log(`⚠️ Removed ${originalCount - clampedImages.length} image(s) that exceeded video duration (${actualVideoDuration.toFixed(2)}s)`);
            }
            console.log(`✅ Images clamped: ${clampedImages.length} remaining`);
        }

        // Handle subtitles — priority: remoteSrtPath > Whisper > Gemini
        let localSrtPath = null;
        
        // Option 1: Pre-built SRT provided
        if (remoteSrtPath) {
            try {
                console.log('📄 Got remoteSrtPath:', remoteSrtPath);
                if (remoteSrtPath.startsWith('http')) {
                    const srtBuf = await downloadFromUrl(remoteSrtPath);
                    localSrtPath = `/tmp/${jobId}-captions.srt`;
                    fs.writeFileSync(localSrtPath, srtBuf);
                    console.log('✅ Downloaded SRT from remoteSrtPath');
                }
            } catch (err) {
                console.warn('⚠️ Could not download SRT:', err.message);
            }
        }
        
        // Option 2: Map script to Whisper timestamps (PREFERRED)
        if (!localSrtPath && transcriptionChunks && transcriptionChunks.length > 0 && script) {
            try {
                console.log(`📝 Mapping script to Whisper timestamps (${transcriptionChunks.length} chunks)`);
                
                const mappedWords = mapScriptToWhisperChunks(script, transcriptionChunks, actualVideoDuration);
                const srtContent = scriptChunksToSrt(mappedWords, 1);
                
                if (srtContent) {
                    localSrtPath = `/tmp/${jobId}-captions.srt`;
                    fs.writeFileSync(localSrtPath, srtContent, 'utf8');
                    console.log(`✅ Script-mapped SRT written (${mappedWords.length} words)`);
                }
            } catch (err) {
                console.warn('⚠️ Failed to map script to Whisper chunks:', err.message);
            }
        }
        
        // Fallback: Use raw Whisper text if script mapping fails
        if (!localSrtPath && transcriptionChunks && transcriptionChunks.length > 0) {
            try {
                console.log(`📝 Fallback: Using raw Whisper transcription`);
                const srtContent = whisperChunksToSrt(transcriptionChunks);
                if (srtContent) {
                    localSrtPath = `/tmp/${jobId}-captions.srt`;
                    fs.writeFileSync(localSrtPath, srtContent, 'utf8');
                    console.log(`✅ Whisper SRT written (fallback)`);
                }
            } catch (err) {
                console.warn('⚠️ Whisper fallback failed:', err.message);
            }
        }

        // Option 3: Fallback to Gemini (only if Whisper not available)
        if (!localSrtPath && audioUrl) {
            try {
                console.log('⚠️ No Whisper data - falling back to Gemini for captions...');
                const audioBuffer = await downloadFromUrl(audioUrl);
                const srtContent = await generateCaptionsWithGemini(audioBuffer);
                if (srtContent) {
                    localSrtPath = `/tmp/${jobId}-captions.srt`;
                    fs.writeFileSync(localSrtPath, srtContent, 'utf8');
                    console.log(`✅ Gemini captions written to ${localSrtPath}`);
                }
            } catch (err) {
                console.warn('⚠️ Failed to generate Gemini captions:', err.message);
            }
        }

        // 2. FFmpeg Rendering
        const finalLocalPath = `/tmp/${jobId}-final.mp4`;
        // Use actual detected duration instead of expected duration
        await compositeImagesOnVideo(lipSyncPath, downloadedImages, finalLocalPath, localSrtPath, bgMusicPath, actualVideoDuration);

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
            lipSyncPath, finalLocalPath, localSrtPath, bgMusicPath,
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
