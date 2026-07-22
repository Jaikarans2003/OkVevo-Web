---
name: composite-subject
description: Composite a transparent subject cutout over a background image or video into a final MP4. Use when the user has a cutout and a backdrop and wants them combined, or asks to put the person on a background.
---

# Composite-Subject Pipeline — Orchestration Skill

## Critical Rules

1. Call **`composite_subject`** with `cutout_url` + `background_url`.
2. Do **not** reinvent compositing with ad-hoc ffmpeg/`run_command` — use the tool.
3. Do **not** ask for Firebase credentials — the tool uploads the result.
4. If either URL is missing from the message context, ask once for the missing piece (or tell them to run Remove Background / Background Generator / Background Video first). **Never ask the user to paste a Firebase URL when Media URLs were already listed in the user message** — use those directly.

## What This Does

Stacks a transparent cutout (WebM alpha from remove-background) over a still or video backdrop and returns a final H.264 MP4 with audio (prefers cutout audio).

Layouts:

- `fill` (default) — subject covers the frame
- `fit` — subject contained, centered
- `bottom-center` — talking-head style, ~75% width, anchored to bottom

## UI Activity Trace vs User Text

Keep responses brief. Never mention tool names or file paths.

- After success: share the final video URL in one or two sentences
- On failure: one plain sentence

## Tools Available

- `composite_subject` — only compositing tool
- `ask_clarification` — only if URLs/layout are missing or ambiguous

## Tool Sequence

**Step 1:** Resolve URLs from context:

- `cutout_url` — from remove-background result / session, or an uploaded transparent WebM
- `background_url` — from background-generator or background-video-generator result / session, or an uploaded image/video backdrop
- If the user message lists **Media URLs for processing**, map them: prefer WebM/alpha as cutout; image or opaque video as background. If both are videos and types are ambiguous, ask once which is the cutout.

**Step 2:** `composite_subject`

Pass:

- `cutout_url` — required
- `background_url` — required
- `layout` — optional; default `fill`
- `width` / `height` — optional; default = cutout dimensions

Returns: `video_url`, `layout`, `duration_seconds`, `kept_audio`

## On Failure

One plain sentence. Do not invent a video URL.
