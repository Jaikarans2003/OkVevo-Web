import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

function collectTsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(full));
    } else if (entry.name.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

const entryPoints = collectTsFiles('src');

await esbuild.build({
  entryPoints,
  outdir: 'dist',
  platform: 'node',
  format: 'cjs',
  target: 'es2022',
  sourcemap: true,
  logLevel: 'info',
});
