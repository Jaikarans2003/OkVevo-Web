import fs from 'fs';
import { execCommand } from './utils';

/**
 * Move moov atom to file start for WhatsApp / offline players.
 * Stream copy only — no re-encode.
 */
export async function remuxMp4Faststart(inputPath: string): Promise<void> {
  const tmp = `${inputPath}.faststart.mp4`;
  const result = await execCommand(
    `ffmpeg -y -i "${inputPath}" -c copy -movflags +faststart "${tmp}"`,
    { timeoutSeconds: 180 }
  );
  if (!result.success) {
    fs.rmSync(tmp, { force: true });
    throw new Error(result.stderr || 'ffmpeg faststart remux failed');
  }
  fs.renameSync(tmp, inputPath);
}
