---
name: background-generator
description: Generate a background image from a text prompt using Fal AI (FLUX). Use when asked to generate a background, create a backdrop, design a scene image, or produce an image for compositing behind a subject.
---

# Background-Generator Pipeline — Orchestration Skill

## Critical Rules

1. Call **`generate_background`** with the user's prompt (enrich it per Prompt Rules).
2. Do **not** use `run_command`, curl, or other DIY image generation.
3. Do **not** ask for API keys or Firebase credentials — the tool handles Fal + Storage upload.
4. If the prompt is missing or vague, ask one short clarifying question first.

## What This Does

Generates a still backdrop via Fal AI (`fal-ai/flux/schnell`) and uploads it to Firebase Storage.

## UI Activity Trace vs User Text

Keep responses brief. Never mention tool names, API providers, or file paths.

- After success: share the image URL in one or two sentences
- On failure: one plain sentence

## Tools Available

- `generate_background` — only tool that generates + uploads the image
- `ask_clarification` — only if the prompt needs clarification

## Tool Sequence

**Step 1:** Get a clear prompt.

**Step 2:** `generate_background`

Pass:

- `prompt` — enriched scene description
- `image_size` — optional; default `landscape_16_9`

Returns: `image_url`, `prompt_used`, `width`, `height`

## Prompt Rules

Expand short requests into a concrete backdrop prompt:

- No people, faces, hands, or text overlays
- Full-bleed scene suitable as a video backdrop
- Keep the user's intent

Example: "warm classroom" →
`Empty modern classroom interior, warm afternoon light through windows, soft bokeh, no people, no text, photorealistic backdrop`

## On Failure

One plain sentence. Do not invent an image URL.
