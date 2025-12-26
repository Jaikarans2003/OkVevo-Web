import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

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
        if (!this.ffmpeg || !this.loaded) {
            await this.load();
        }

        const ffmpeg = this.ffmpeg!;

        // Progress handler
        const progressListener = ({ progress }: { progress: number }) => {
            if (onProgress) onProgress(Math.round(progress * 100));
        };
        ffmpeg.on('progress', progressListener);

        try {
            // 1. Write files to FS
            for (let i = 0; i < videoUrls.length; i++) {
                const data = await fetchFile(videoUrls[i]);
                await ffmpeg.writeFile(`input${i}.mp4`, data);
            }

            // 2. Build Filter Graph for 3 videos
            // 20s clips. 1s overlap for crossfade.
            // Clip 0 ends at 20s. Fade starts at 19s.
            // Clip 1 starts. Joined at 19s.
            // Result of [0][1] duration = 20 + 20 - 1 = 39s.
            // Next fade starts at 39s - 1s = 38s.

            // Inputs: [0:v][1:v][2:v]
            // Crossfade 0+1: [0][1]xfade=transition=fade:duration=1:offset=19[v01];
            // Crossfade v01+2: [v01][2]xfade=transition=fade:duration=1:offset=38[outv]
            // Note: We also need to handle AUDIO (afade/acrossfade) if there is audio.
            // Provided videos usually have audio. Simplest is amix or acrossfade.
            // For now, let's assume we just concatenate/crossfade video. If audio is missing it might fail.
            // Let's use a simpler "concat" demuxer approach IF the user accepts straightforward cuts (safer).
            // But user asked for "smooth fade".

            // Complex filter for 3 videos
            const filter =
                `[0:v][1:v]xfade=transition=fade:duration=1:offset=19[v01];` +
                `[v01][2:v]xfade=transition=fade:duration=1:offset=38,format=yuv420p[outv];` +
                `[0:a][1:a]acrossfade=d=1:c1=tri:c2=tri[a01];` +
                `[a01][2:a]acrossfade=d=1:c1=tri:c2=tri[outa]`;

            await ffmpeg.exec([
                '-i', 'input0.mp4',
                '-i', 'input1.mp4',
                '-i', 'input2.mp4',
                '-filter_complex', filter,
                '-map', '[outv]',
                '-map', '[outa]',
                '-c:v', 'libx264',
                '-preset', 'ultrafast', // Speed over compression ratio
                '-crf', '28',
                'output.mp4'
            ]);

            // 3. Read result
            const data = await ffmpeg.readFile('output.mp4');
            const blob = new Blob([data as any], { type: 'video/mp4' });
            return URL.createObjectURL(blob);

        } finally {
            // Cleanup FS to free memory
            for (let i = 0; i < videoUrls.length; i++) {
                try { await ffmpeg.deleteFile(`input${i}.mp4`); } catch { }
            }
            try { await ffmpeg.deleteFile('output.mp4'); } catch { }

            ffmpeg.off('progress', progressListener);
        }
    }
}

export const videoStitcher = new VideoStitcherService();
