---
name: remove-background
description: Remove the background from an uploaded person/portrait video using HyperFrames local matting, producing a transparent WebM cutout. Use when asked to remove background, create a transparent subject, matte a talking head, or cut out a speaker from a recording.
---

# Remove-Background Pipeline — Orchestration Skill

## Critical Rules

1. Call **`remove_background` exactly once** with the uploaded `video_url`.
2. Do **not** use `run_command`, rembg, OpenCV, ffmpeg masks, pip install, or any other DIY approach.
3. Do **not** ask the user for Firebase credentials — `remove_background` uploads to Storage itself.
4. If `video_url` is missing, ask them to upload a video. Otherwise call the tool immediately.

## What This Does

Takes a user-uploaded video and removes the background with HyperFrames `remove-background` (u²-net_human_seg, local). Output is a transparent VP9-with-alpha WebM with the original audio remuxed on by default.

Optional: also emit an inverse-alpha background plate (`emit_background_plate: true`) for text-behind-subject layouts.

## UI Activity Trace vs User Text

Keep responses brief. Never mention tool names, file paths, or technical details.

- After start: one sentence that background removal is running (can take a few minutes on CPU)
- After success: share the cutout URL (and plate URL if requested)
- On failure: one plain sentence

## Tools Available

- `remove_background` — only tool that performs matting + Storage upload
- `ask_clarification` — only if video is missing or the request is ambiguous

## Tool Sequence

**Step 1:** Confirm `video_url` from context.

**Step 2:** `remove_background`

Pass:

- `video_url` — required
- `quality` — optional: `fast` | `balanced` (default) | `best`
- `emit_background_plate` — optional; true only for hole-cut plate / text-behind-subject
- `keep_audio` — optional; default `true` (remuxes source audio onto the cutout)

Returns: `cutout_url`, optional `plate_url`, `kept_audio`

## On Failure

One plain sentence. Do not invent a cutout URL. Do not fall back to shell hacks.
