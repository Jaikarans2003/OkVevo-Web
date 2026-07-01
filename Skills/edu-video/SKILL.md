---
name: edu-video
description: Transform a teacher video recording into an educational video with Manim animations, HyperFrames motion graphics, karaoke captions, and automatic speaker layout. Orchestrates the manim-video skill (concept animations) and hyperframes skill (motion graphic overlays). Three display modes switch automatically per segment. Use when asked to generate an educational video from a recording.
---

# Edu-Video Pipeline — Orchestration Skill

## What This Does
Transforms a teacher's video recording into a 1920×1080 educational video.
Coordinates two sub-skills: manim-video (mathematical animations) and
hyperframes (motion graphic overlays for data, comparisons, timelines).

Three display modes, auto-assigned per transcript segment:
- **Mode A:** Manim animation full canvas + speaker PIP bottom-right (422×237px) + karaoke captions
- **Mode B:** Ambient gradient background + HyperFrames motion graphic overlay (agent-written) + speaker PIP bottom-right + karaoke captions
- **Mode C:** Ambient gradient background + speaker video centered 65% canvas + karaoke captions

## UI Activity Trace vs User Text
Activity trace shows each step as collapsible cards. Keep text responses brief.
- After transcription: title and duration only
- After concept extraction: how many Manim concepts found, one sentence
- After segment planning: how many Mode B segments found, one sentence
- After Mode B generation: confirm motion graphics ready, one sentence
- After animations: "animations ready" one sentence
- After final render: show video URL prominently, ask if they want changes

Never mention tool names, file paths, or technical details to the user.

## Tools Available
- `transcribe_video` — transcribes speaker video, returns transcript_text, transcript_words[], duration_seconds, word_count, timing_granularity
- `extract_concepts` — extracts Manim concepts from transcript using word-level timestamps, returns concepts[] with snapped start/end seconds
- `generate_manim_script` — writes Python Manim script for one concept, validates syntax
- `render_manim_clips` — renders one Manim script to MP4, returns clip_url, start_seconds, end_seconds
- `plan_hf_segments` — LLM call, assigns Mode A/B/C to each transcript segment, returns segments[]
- `scaffold_hf_project` — deterministic template injector, no LLM, writes full HyperFrames project to disk and Firebase Storage, returns project_dir and composition_url
- `render_hyperframes` — runs hyperframes lint then render, returns structured lint errors on failure or video_url on success
- `run_command` — run shell commands (used for patches, ffmpeg, etc.)
- `write_file` — write files to session workdir (used for Mode B sub-compositions and patch edits)

## Tool Sequence

### Phase 1 — Manim-Video (run first, in order)

1. `transcribe_video` — pass video_url from context
   - Returns: transcript_url, transcript_text, transcript_words[], duration_seconds, word_count
   - transcript_words contains word-level timestamps from Groq Whisper — use these, never estimate timestamps

2. `extract_concepts` — pass transcript_text, transcript_words, duration_seconds
   - LLM returns concepts with excerpt field (not timestamps)
   - Tool snaps excerpts to word-level timestamps deterministically
   - Returns: concepts[] each with concept_name, explanation, start_seconds, end_seconds, needs_animation

3. For each concept where needs_animation=true (run sequentially):
   - Read `Skills/manim-video/SKILL.md` before writing any Manim script
   - `generate_manim_script` — pass concept_name, explanation, duration_seconds=(end_seconds-start_seconds)
   - `render_manim_clips` — pass script, class_name, concept_name, start_seconds, end_seconds
   - Returns: clip_url, concept_name, start_seconds, end_seconds

### Phase 2 — HyperFrames Segment Planning

4. `plan_hf_segments` — pass transcript_text, manim_clips[], total_duration
   - manim_clips uses timestamps from Phase 1 (never invent timestamps)
   - Returns: segments[] with mode (A/B/C), start, end, manim_index (for A), element_type + content_data (for B)

   Mode A: assigned automatically to match Manim clip timestamps exactly
   Mode B triggers when transcript segment mentions:
   - Comparisons, before/after, side-by-side
   - Data, statistics, numbers, percentages
   - Timelines, steps, processes, frameworks
   - Lists of 3+ items worth visualizing
   - Charts, graphs, tables
   Mode C: default for all other segments

### Phase 3 — Mode B Sub-Compositions (agent-written HyperFrames HTML)

For each segment where mode=B, before calling scaffold_hf_project:

1. Read `Skills/hyperframes/skills/hyperframes/SKILL.md` fully — do not skip this step
2. Extract transcript words for this segment: filter transcript_words where word.start >= segment.start and word.end <= segment.end
3. Understand what the transcript is explaining at this moment — a process, comparison, statistic, timeline, concept — and decide the best visual representation. Do not use pre-built templates. Generate HTML appropriate to the actual content.
4. Use `write_file` to write a complete valid HyperFrames sub-composition to:
   `${project_dir}/compositions/sections/NN-{segmentid}.html`
   where NN is zero-padded segment index and segmentid matches the segment ID scaffold_hf_project will assign (format: `seg-NN-b`)

The file MUST follow HyperFrames sub-composition contract:
- Wrapped in `<template id="seg-NN-b-template">`
- Inner div: `data-composition-id="seg-NN-b"` `data-start="0"` `data-width="1920"` `data-height="1080"` `data-duration="{segment.end - segment.start}"`
- All CSS scoped under `[data-composition-id="seg-NN-b"]`
- GSAP script: `window.__timelines = window.__timelines || {}; const tl = gsap.timeline({ paused: true }); ... window.__timelines["seg-NN-b"] = tl;`
- Load GSAP from `https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js`
- Timeline padded with `tl.set({}, {}, {segment_duration});` at end
- All animations use `gsap.from()` for entrances — no `repeat: -1`, all durations finite
- No imperative media calls (no video.play(), no audio.play())
- No `display`, `visibility` animations — only opacity, transforms, colors

Content placement rules:
- All visual content stays in left 65% of canvas (x: 0 to ~1248px) — right 35% reserved for speaker PIP
- Ambient gradient background using brand CSS vars: `var(--brand-bg-dark)` to `var(--brand-primary)`
- Use brand CSS variables: `--brand-primary`, `--brand-accent`, `--brand-bg-dark`, `--brand-text`
- No video or audio elements — those live in index-root.html only
- Speaker PIP slot is handled by index-root.html — do NOT include speaker video here

On Mode B failure: fall back to Mode C for that segment (skip writing the file, let scaffold_hf_project use mode-c.html template instead).

### Phase 4 — Assembly and Render

5. `scaffold_hf_project` — pass:
   - speaker_video_url
   - manim_clips[] (with clip_url, concept_name, start_seconds, end_seconds)
   - segments[] (from plan_hf_segments, with manim_index for Mode A)
   - transcript_words[] (for karaoke caption generation)
   - total_duration
   - brand_colors (optional, defaults: primary #1a1a2e, accent #37bdf8, bg_dark #0a0a0f)

   What it does (deterministic, no LLM):
   - Copies template scaffold from Skills/edu-video/templates/
   - For Mode B segments: uses agent-written file if it already exists on disk, skips template
   - For Mode A/C segments: uses mode-a.html / mode-c.html templates
   - Injects all segment wiring, Manim clip HTML, speaker GSAP transitions, karaoke captions
   - Downloads speaker video, extracts audio via ffmpeg
   - Writes COMPOSITION_MANIFEST.json for edit requests
   - Uploads full project to Firebase Storage
   - Returns: project_dir, composition_url

6. `render_hyperframes` — pass composition_url from scaffold_hf_project
   - Checks local project_dir first, then Firebase Storage, then fallback
   - Runs hyperframes lint — on failure returns { success: false, lint_errors, project_dir }
   - On lint failure: read lint_errors, use write_file to patch the specific file, call render_hyperframes again
   - On render success: returns { video_url }

## Karaoke Captions
Always enabled. scaffold_hf_project receives transcript_words and generates
word-level karaoke caption groups injected into compositions/captions-overlay.html.
Caption position: bottom 96px, centered, karaoke highlight per word group.
Always visible across all three modes. Captions are on top of everything (z-index 10+).

## Deterministic vs Agent-Generated

**Always deterministic (never LLM-generated):**
- Speaker video position and PIP transitions (GSAP presets: FS, PIP_MANIM, PIP_VIZ)
- Manim clip placement (full canvas, #manim-stage, z-index 2)
- Mode B content safe zone (left 65% of canvas)
- Caption layer position and structure
- index-root.html wiring and audio track separation
- All timestamps (always from transcription word-level data, never estimated)

**Always agent-generated (LLM writes this):**
- Mode B sub-composition HTML, CSS, and GSAP (Phase 3)
- What visual type to use for each Mode B segment (based on transcript understanding)
- Manim Python scripts (Phase 1)

## Sub-Skill Reference
- Manim animations: read `Skills/manim-video/SKILL.md` before generate_manim_script
- HyperFrames compositions: read `Skills/hyperframes/skills/hyperframes/SKILL.md` before Phase 3
- HyperFrames CLI rules: read `Skills/hyperframes/skills/hyperframes-cli/SKILL.md` before render_hyperframes

## On Failure
One plain sentence to the user. Continue with what worked.
- If a Mode B segment fails: fall back to Mode C for that segment, continue pipeline
- If a Manim clip fails: skip that concept, continue with remaining clips
- If lint fails: read structured lint_errors, patch with write_file, retry render_hyperframes
- Never mention tool names, file paths, or technical details to the user

## On Edit Requests

Before any edit:
1. `read_file("${project_dir}/COMPOSITION_MANIFEST.json")` to get file map and current values
2. If manifest missing, use `search_files` to locate relevant files by pattern or content
3. `read_file` the specific file before patching it — understand existing structure first
4. `write_file` to patch, then `render_hyperframes`

Identify which phase is affected and re-run only from that phase forward. Never restart the full pipeline.

### Speaker position edits
"move speaker to top right" / "make speaker smaller" / "circular frame" / "center the video" / "put in corner":
- Read manifest speaker.presets for available named presets (FS, PIP_MANIM, TOP_RIGHT, CENTER, CIRCLE)
- Use write_file to patch the tl.set('#speaker-wrap', ...) and tl.to('#speaker-wrap', ...) calls in index.html
- Call render_hyperframes

### Caption style edits
"bigger captions" / "different color" / "move captions up" / "smaller text":
- Read manifest captions.current for current values
- Use write_file to patch font-size, color, or bottom value in compositions/captions-overlay.html
- Call render_hyperframes

### Mode B content edits
"change that chart" / "use a comparison table instead" / "make the diagram different":
- Re-run Phase 3 for that specific segment only
- Read transcript words for that segment's time window
- Read HyperFrames skill, write new sub-composition HTML via write_file to same path
- Call render_hyperframes

### Segment edits (add/remove/change animations)
"add an animation at 30 seconds" / "remove the last animation" / "add a chart at 45s":
- For adding Manim: run generate_manim_script + render_manim_clips for new concept
- Call plan_hf_segments with updated clip list
- Run Phase 3 for any new Mode B segments
- Call scaffold_hf_project with updated segments
- Call render_hyperframes

### Brand/color edits
"change the accent color" / "use red instead of blue":
- Call scaffold_hf_project with updated brand_colors
- Call render_hyperframes