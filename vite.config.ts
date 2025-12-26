import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/replicate': {
        target: 'https://api.replicate.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/replicate/, ''),
      },
    },
    // Removed Cross-Origin headers to fix external video playback. 
    // This disables SharedArrayBuffer, so multi-threaded ffmpeg.wasm will fail.
  },
})
