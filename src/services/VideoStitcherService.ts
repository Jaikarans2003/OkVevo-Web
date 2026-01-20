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

            // 2. Build Filter Graph for 3 videos with enhanced smooth transitions
            // Enhanced crossfade with smoother easing for professional results
            // Using 1.5s transitions for more cinematic effect
            const transitionDuration = 1.5;
            const clipDuration = 20;

            // Calculate offsets: 
            // First transition starts at (20 - 1.5) = 18.5s
            // After first merge: 20 + 20 - 1.5 = 38.5s total
            // Second transition starts at (38.5 - 1.5) = 37s

            // Enhanced filter with smooth transitions
            const filter =
                // Normalize all video inputs for consistent processing
                `[0:v]scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p[v0];` +
                `[1:v]scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p[v1];` +
                `[2:v]scale=360:640:force_original_aspect_ratio=decrease,pad=360:640:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p[v2];` +
                // Smooth crossfade with easing for natural transitions
                `[v0][v1]xfade=transition=smoothleft:duration=${transitionDuration}:offset=${clipDuration - transitionDuration}[v01];` +
                `[v01][v2]xfade=transition=smoothright:duration=${transitionDuration}:offset=${(clipDuration * 2) - (transitionDuration * 2)}[outv];` +
                // Enhanced audio crossfade with longer overlap
                `[0:a][1:a]acrossfade=d=${transitionDuration}:c1=tri:c2=tri[a01];` +
                `[a01][2:a]acrossfade=d=${transitionDuration}:c1=tri:c2=tri[outa]`;

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

            // 3. Read result
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
