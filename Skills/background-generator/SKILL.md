---

## name: background-generator

description: Generate a background image from a text prompt using Fal AI (FLUX). Use when asked to generate a background, create a backdrop, design a scene image, or produce an image for compositing behind a subject.

# Background-Generator Pipeline — Orchestration Skill

## Critical Rules

1. Call `image_generate` with the user's prompt (enrich it per Prompt Rules).
2. Do **not** use `run_command`, curl, or other DIY image generation.
3. Do **not** ask for API keys or Firebase credentials — the tool handles Fal queue submit.
4. If the prompt is missing or vague, ask one short clarifying question first.
5. **Never paste, quote, or invent a media URL in chat.** The UI shows the image in a photo card and Deliverables — you only write short status sentences.

## What This Does

Queues a still backdrop via Fal AI (`fal-ai/flux/schnell`). Generation is **async**: the tool returns `request_id` / `queued` immediately. When ready, the image appears in chat and Deliverables via webhook — never invent or paste a URL.

## UI Activity Trace vs User Text

Keep responses brief. Never mention tool names, API providers, file paths, or URLs.

- After queue: one sentence that the backdrop image is generating
- When the image is ready (webhook): it is already shown in the UI — do not re-fetch and do not paste a link
- On failure: one plain sentence

## Tools Available

- `image_generate` — queues generation; image appears in chat/Deliverables when ready
- `ask_clarification` — only if the prompt needs clarification

## Tool Sequence

**Step 1:** Get a clear prompt.

**Step 2:** `image_generate`

Pass:

- `prompt` — enriched scene description
- `image_size` — optional; default `landscape_16_9`

Returns: `request_id`, `status: queued`, `prompt_used`, `image_size`

## Prompt Rules

Expand short requests into a concrete backdrop prompt:

- No people, faces, hands, or text overlays
- Full-bleed scene suitable as a video backdrop
- Keep the user's intent

Example: "warm classroom" →
`Empty modern classroom interior, warm afternoon light through windows, soft bokeh, no people, no text, photorealistic backdrop`

## On Failure

One plain sentence. Do not invent or paste an image URL.