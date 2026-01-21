import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

class VideoStitcherService {
    private ffmpeg: FFmpeg | null = null;
    private loaded = false;

    async load() {
        if (this.loaded) return;

        this.ffmpeg = new FFmpeg();

        // Log logs to console for debugging
        this.ffmpeg.on('log', ({ message }) => {
            console.log('[FFmpeg]', message);
        });

        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

        try {
            await this.ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            });
            this.loaded = true;
        } catch (error) {
            console.error('Failed to load FFmpeg:', error);
            throw new Error('Failed to initialize video processor');
        }
    }

    private async getVideoDuration(ffmpeg: FFmpeg, filename: string): Promise<number> {
        try {
            // Read the file from ffmpeg's virtual filesystem
            const data = await ffmpeg.readFile(filename) as Uint8Array;
            const blob = new Blob([data as BlobPart], { type: 'video/mp4' });

            // Use HTML5 video element to get duration
            const video = document.createElement('video');
            const url = URL.createObjectURL(blob);

            return new Promise<number>((resolve, reject) => {
                video.onloadedmetadata = () => {
                    const dur = video.duration;
                    URL.revokeObjectURL(url);
                    console.log(`Video ${filename} duration: ${dur}s`);
                    resolve(dur);
                };
                video.onerror = () => {
                    URL.revokeObjectURL(url);
                    reject(new Error('Failed to load video metadata'));
                };
                video.src = url;
            });
        } catch (error) {
            console.error(`Failed to get duration for ${filename}:`, error);
            throw error;
        }
    }

    async stitchVideos(videoUrls: string[], onProgress?: (progress: number) => void): Promise<string> {
        // Ensure FFmpeg is loaded first
        await this.load();

        if (!this.ffmpeg) {
            throw new Error('Failed to initialize FFmpeg');
        }

        const ffmpeg = this.ffmpeg;

        // Progress handler
        const progressListener = ({ progress }: { progress: number }) => {
            if (onProgress) onProgress(Math.round(progress * 100));
        };
        ffmpeg.on('progress', progressListener);

        try {
            // Verify Browser Capabilities
            if (!window.crossOriginIsolated) {
                throw new Error('Browser is not cross-origin isolated. SharedArrayBuffer unavailable. Please restart server/browser to apply COOP/COEP headers.');
            }

            // 1. Write files to FS with explicitly CORS-enabled fetch
            for (let i = 0; i < videoUrls.length; i++) {
                // Fetch directly to Buffer to ensure we control the request
                const response = await fetch(videoUrls[i]);
                if (!response.ok) throw new Error(`Failed to fetch video ${i + 1}: ${response.statusText}`);
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                await ffmpeg.writeFile(`input${i}.mp4`, uint8Array);
            }

            // 2. Probe video durations
            const durations: number[] = [];
            for (let i = 0; i < videoUrls.length; i++) {
                const duration = await this.getVideoDuration(ffmpeg, `input${i}.mp4`);
                durations.push(duration);
            }

            console.log('Video durations:', durations);

            // 3. Build Filter Graph with dynamic offsets based on actual durations
            const transitionDuration = 1.5;

            // Calculate dynamic offsets
            const firstOffset = durations[0] - transitionDuration;
            const secondOffset = durations[0] + durations[1] - (transitionDuration * 2);

            console.log(`Transition timings:`);
            console.log(`  First xfade: offset=${firstOffset}s`);
            console.log(`  Second xfade: offset=${secondOffset}s`);
            console.log(`  Expected total duration: ${durations[0] + durations[1] + durations[2] - (transitionDuration * 2)}s`);

            // Enhanced filter with smooth transitions using actual durations
            const filter =
                // Normalize all video inputs for consistent processing
                `[0:v]scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p[v0];` +
                `[1:v]scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p[v1];` +
                `[2:v]scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p[v2];` +
                // Smooth crossfade with dynamic offsets
                `[v0][v1]xfade=transition=smoothleft:duration=${transitionDuration}:offset=${firstOffset}[v01];` +
                `[v01][v2]xfade=transition=smoothright:duration=${transitionDuration}:offset=${secondOffset}[outv];` +
                // Enhanced audio crossfade with proper timing
                // Trim audio streams to match video durations
                `[0:a]atrim=0:${durations[0]},asetpts=PTS-STARTPTS[a0];` +
                `[1:a]atrim=0:${durations[1]},asetpts=PTS-STARTPTS[a1];` +
                `[2:a]atrim=0:${durations[2]},asetpts=PTS-STARTPTS[a2];` +
                // Crossfade audio streams
                `[a0][a1]acrossfade=d=${transitionDuration}:c1=tri:c2=tri[a01];` +
                `[a01][a2]acrossfade=d=${transitionDuration}:c1=tri:c2=tri[outa]`;

            await ffmpeg.exec([
                '-i', 'input0.mp4',
                '-i', 'input1.mp4',
                '-i', 'input2.mp4',
                '-filter_complex', filter,
                '-map', '[outv]',
                '-map', '[outa]',
                '-c:v', 'libx264',
                '-preset', 'fast',      // Balance between speed and quality
                '-crf', '23',           // Good quality for web
                '-pix_fmt', 'yuv420p',  // Ensure compatibility
                '-movflags', '+faststart', // Enable streaming
                'output.mp4'
            ]);

            // 4. Read result
            const data = await ffmpeg.readFile('output.mp4');
            const blob = new Blob([data as BlobPart], { type: 'video/mp4' });
            return URL.createObjectURL(blob);

        } finally {
            // Cleanup FS to free memory
            for (let i = 0; i < videoUrls.length; i++) {
                try { await ffmpeg.deleteFile(`input${i}.mp4`); } catch (e) { console.error(e); }
            }
            try { await ffmpeg.deleteFile('output.mp4'); } catch (e) { console.error(e); }

            ffmpeg.off('progress', progressListener);
        }
    }
}

export const videoStitcher = new VideoStitcherService();
