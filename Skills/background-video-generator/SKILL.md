---
name: background-video-generator
description: Generate a short backdrop video from a text prompt using Fal Wan 2.1. Hard-capped at 15 seconds. Use when asked to generate a background video, moving backdrop, animated scene, or video plate for compositing behind a subject.
---

# Background-Video-Generator Pipeline — Orchestration Skill

## Critical Rules

1. Call **`video_generate`** with the user's prompt (enrich it per Prompt Rules).
2. **Duration guardrail:** never request more than **15 seconds**. If the user asks for longer (20s, 30s, 1 min, etc.), clamp to 15 and say so in one plain sentence.
3. Do **not** use `run_command`, curl, or DIY video generation.
4. Do **not** ask for API keys or Firebase credentials — the tool handles Fal queue submit.
5. If the prompt is missing or vague, ask one short clarifying question first.
6. **Never paste, quote, or invent a media URL in chat.** The UI shows the video in a player and Deliverables — you only write short status sentences.

## What This Does

Queues a short MP4 backdrop via Fal **Wan 2.1** (`fal-ai/wan-t2v`). Generation is **async**: the tool returns `request_id` / `queued` immediately. When ready, the video appears in chat and Deliverables via webhook — never invent or paste a URL.

Default length ~5 seconds. Allowed range **4–15 seconds** (hard max 15).

## UI Activity Trace vs User Text

Keep responses brief. Never mention tool names, API providers, file paths, or URLs.

- After queue: one sentence that the backdrop video is generating (can take a minute or two)
- When the video is ready (webhook): it is already shown in the UI — do not re-fetch and do not paste a link
- If duration was clamped, mention the 15s cap once when acknowledging the queue
- On failure: one plain sentence

## Tools Available

- `video_generate` — queues generation; video appears in chat/Deliverables when ready
- `ask_clarification` — only if the prompt needs clarification

## Tool Sequence

**Step 1:** Get a clear prompt. If they ask for a still image instead, tell them to use Background Generator.

**Step 2:** `video_generate`

Pass:

- `prompt` — enriched scene description
- `duration_seconds` — optional; default 5; **clamp anything above 15 to 15**
- `resolution` — optional; default `720p` (`480p` | `580p` | `720p`)
- `aspect_ratio` — optional; default `16:9` (`16:9` | `9:16`)

Returns: `request_id`, `status: queued`, `duration_seconds`, `duration_clamped`, `prompt_used`

## Prompt Rules

Expand short requests into a concrete moving backdrop prompt:

- No people, faces, hands, or text overlays in the foreground
- Prefer gentle camera motion / ambient motion suitable behind a speaker
- Keep the center relatively clean for compositing a cutout on top
- Keep the user's intent

Example: "ocean sunset" →
`Wide cinematic ocean sunset backdrop, gentle waves, soft golden light, slow camera drift, empty horizon, no people, no text, photorealistic`

## On Failure

One plain sentence. Do not invent or paste a video URL.
