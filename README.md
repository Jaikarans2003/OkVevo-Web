# Brick2Brick (TuneTalezB2B) — Text to Video

Brick2Brick is a Next.js (App Router) web app that turns a user story into 3 cinematic scenes and generates 3 short videos (one per scene). It includes a Scene Review step (editable prompts) and a simple in-browser video editor with optional stitching.

## What It Does

- Chat-style flow to collect a story (expects `@Script ...` format)
- AI scene breakdown into exactly 3 self-contained scene prompts (20s each)
- Scene Review UI to edit visuals/objective/tone before generating
- “Proceed” confirmation to start video generation
- Video playback/editor tools + optional stitching using ffmpeg.wasm

## Tech Stack

- Next.js (App Router) + React
- Tailwind CSS
- AI providers: Google Gemini with Groq fallback
- Video generation: Replicate (via `/api/replicate/predictions`)
- Video stitching: ffmpeg.wasm (`@ffmpeg/ffmpeg`)

## Run Locally

```bash
npm install
npm run dev
```

Open: http://localhost:3000

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Environment Variables

Set these in `.env.local` (do not commit secrets):

- `NEXT_PUBLIC_GEMINI_API_KEY` (or `NEXT_PUBLIC_GOOGLE_API_KEY`): used by `src/services/AIService.ts`
- `NEXT_PUBLIC_GROQ_API_KEY`: fallback provider used by `src/services/AIService.ts`
- `NEXT_PUBLIC_REPLICATE_API_TOKEN`: used by `src/hooks/useVideoGeneration.ts` for Replicate requests

## How The App Is Structured

**UI**
- `src/app/page.tsx`: main chat UI, scene review renderer, and generation trigger
- `src/components/VideoPlayer.tsx`: playback + editor UI, stitch/download actions

**State / Flow**
- `src/hooks/useChatFlow.ts`: chat state machine and message list; emits `scene_review` message and waits for “Proceed”
- `src/hooks/useVideoGeneration.ts`: turns 3 scenes into 3 Replicate generations; polling + per-scene status

**Services**
- `src/services/AIService.ts`: scene generation prompts + retry; Gemini first, then Groq fallback
- `src/services/VideoStitcherService.ts`: stitches clips in-browser using ffmpeg.wasm

**Configuration**
- `src/config/models.ts`: Replicate model config and payload builder
- `tailwind.config.js`: brand colors and gradients

## FFmpeg / Cross-Origin Isolation

Video stitching requires `SharedArrayBuffer`, which requires cross-origin isolation. This repo sets COOP/COEP headers in `next.config.ts`.

If stitching fails with a `SharedArrayBuffer` or `crossOriginIsolated` error:

- Fully restart the dev server
- Use a fresh browser tab (sometimes a full browser restart helps)

## Notes

- The “Proceed” gate is implemented in `useChatFlow` (`awaiting_proceed_confirmation` → `scenes_ready`).
- Scene prompts are designed to be self-contained so the video model does not need memory across scenes.
