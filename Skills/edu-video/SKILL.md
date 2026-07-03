---

## name: edu-video

description: Transform a teacher video recording into an educational video with Manim animations, HyperFrames motion graphics, karaoke captions, and automatic speaker layout. Orchestrates the manim-video skill (concept animations) and hyperframes skill (motion graphic overlays). Three display modes switch automatically per segment. Use when asked to generate an educational video from a recording.

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

- After transcription: title and duration only, one sentence
- After concept extraction: how many Manim concepts found, one sentence
- After segment planning: how many Mode B segments found, one sentence
- After Mode B generation: confirm motion graphics ready, one sentence
- After animations: "animations ready", one sentence
- After final render: show video URL prominently, ask if they want changes

Never mention tool names, file paths, or technical details to the user.

## Tools Available

- `transcribe_video` — transcribes speaker video, returns transcript_text, transcript_words[], duration_seconds, word_count
- `extract_concepts` — extracts Manim concepts from transcript using word-level timestamps, returns concepts[] with snapped start/end seconds
- `generate_manim_script` — writes Python Manim script for one concept, validates syntax
- `render_manim_clips` — renders one Manim script to MP4, returns clip_url, start_seconds, end_seconds
- `plan_hf_segments` — LLM call, assigns Mode A/B/C to each transcript segment, returns segments[]
- `scaffold_hf_project` — deterministic template injector, no LLM, writes full HyperFrames project to disk and Firebase Storage, returns project_dir and composition_url
- `render_hyperframes` — runs hyperframes lint then render, returns structured lint errors on failure or video_url on success
- `run_command` — run shell commands (used for patches, ffmpeg, etc.)
- `write_file` — write files to disk (used for Mode B sub-compositions and patch edits)
- `read_file` — read any file from disk (used before patching, reading manifest)
- `search_files` — find files by name or content (used when manifest is missing)



## Tool Sequence



### Phase 1 — Manim-Video (run first, in order)

**Step 1:** `transcribe_video`

- Pass: video_url from context
- Returns: transcript_url, transcript_text, transcript_words[], duration_seconds, word_count
- transcript_words[] contains word-level timestamps from Groq Whisper — use these always, never estimate timestamps
- Save transcript_words[] — needed for Phase 2, Phase 3, and Phase 4

**Step 2:** `extract_concepts`

- Pass: transcript_text, transcript_words (full array from step 1), duration_seconds
- LLM returns concepts with excerpt field (not timestamps)
- Tool snaps excerpts to word-level timestamps deterministically
- Returns: concepts[] each with concept_name, explanation, start_seconds, end_seconds, needs_animation

**Step 3: For each concept where needs_animation=true (run sequentially)**

- Read `Skills/manim-video/SKILL.md` before writing any Manim script
- `generate_manim_script` — pass concept_name, explanation, duration_seconds=(end_seconds - start_seconds)
- `render_manim_clips` — pass script, class_name, concept_name, start_seconds, end_seconds
- Returns: clip_url, concept_name, start_seconds, end_seconds
- Collect all results into manim_clips[] for Phase 2



### Phase 2 — HyperFrames Segment Planning

**Step 4:** `plan_hf_segments`

- Pass: transcript_text, manim_clips[] (from Phase 1), total_duration (duration_seconds from step 1)
- manim_clips timestamps come from Phase 1 — never invent timestamps
- Returns: segments[] with mode (A/B/C), start, end, manim_index (for A), element_type + content_data (for B)

Mode assignment rules:

- Mode A: must exactly match Manim clip timestamps — one Mode A segment per Manim clip
- Mode B: when transcript segment mentions comparisons, data/statistics/numbers, timelines/steps/processes, lists of 3+ items, charts/graphs/tables
- Mode C: default for all other segments



### Phase 3 — Mode B Sub-Compositions (agent-written HyperFrames HTML)

**Only runs if plan_hf_segments returned any Mode B segments.**

Before writing any files, compute the project directory path:
`project_dir = /tmp/okvevo/{sessionId}/hf-project`

Create the sections directory if it does not exist:
`run_command("mkdir -p /tmp/okvevo/{sessionId}/hf-project/compositions/sections")`

For each segment where mode=B:

1. Read `Skills/hyperframes/SKILL.md` fully — do not skip this step
2. Extract transcript text for this segment: filter transcript_words where word.start >= segment.start and word.end <= segment.end, join into a string
3. Understand what the transcript is explaining — a process, comparison, statistic, timeline, concept — and decide the best visual representation. Do not use pre-built templates. Generate HTML appropriate to the actual content.
4. Use `write_file` to write a complete valid HyperFrames sub-composition to:
  `/tmp/okvevo/{sessionId}/hf-project/compositions/sections/{NN}-segment-{NN}.html`
   where NN is the zero-padded segment index (01, 02, etc.)

**The file MUST follow the HyperFrames sub-composition contract:**

- Wrapped in `<template id="seg-{NN}-b-template">`
- Inner div: `data-composition-id="seg-{NN}-b"` `data-start="0"` `data-width="1920"` `data-height="1080"` `data-duration="{segment.end - segment.start}"`
- All CSS scoped under `[data-composition-id="seg-{NN}-b"]` — no global selectors
- Load GSAP: `<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>`
- GSAP script block:

```javascript
  (function() {
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    // ... your animations ...
    tl.set({}, {}, SEGMENT_DURATION); // pad to full duration
    window.__timelines["seg-{NN}-b"] = tl;
  })();
```

- All animations use `gsap.from()` for entrances — no `repeat: -1`, all durations finite
- No imperative media calls — no `video.play()`, no `audio.play()`
- No `display` or `visibility` property animations — only opacity, transforms, colors

**Content placement rules:**

- All visual content stays in left 65% of canvas (max x: ~1248px) — right 35% reserved for speaker PIP
- Ambient gradient background: `background: linear-gradient(135deg, var(--brand-bg-dark) 0%, var(--brand-primary) 100%)`
- Use brand CSS variables: `--brand-primary`, `--brand-accent`, `--brand-bg-dark`
- No video or audio elements — those live in index-root.html only
- Do NOT include speaker video or PIP — handled by index-root.html

**On Mode B failure:** fall back to Mode C for that segment — skip writing the file, let scaffold_hf_project use mode-c.html template instead. Tell the user one plain sentence.

### Phase 4 — Assembly and Render

**Step 5:** `scaffold_hf_project`

Pass:

- `speaker_video_url` — original video URL from context
- `manim_clips[]` — all clips from Phase 1 with clip_url, concept_name, start_seconds, end_seconds
- `segments[]` — from plan_hf_segments, with manim_index for Mode A segments
- `transcript_words[]` — full array from transcribe_video (for karaoke captions)
- `total_duration` — duration_seconds from transcribe_video
- `brand_colors` — optional, defaults: primary #1a1a2e, accent #37bdf8, bg_dark #0a0a0f

What scaffold_hf_project does (deterministic, zero LLM calls):

- Copies template scaffold from Skills/edu-video/templates/
- For Mode B segments: uses agent-written file from Phase 3 if it exists on disk — does not overwrite
- For Mode A and C segments: uses mode-a.html / mode-c.html templates
- Injects all segment wiring, Manim clip HTML, speaker GSAP transitions, karaoke captions
- Downloads speaker video to assets/, extracts audio via ffmpeg
- Writes COMPOSITION_MANIFEST.json
- Uploads Phase A checkpoint (index.html only) immediately
- Uploads full project directory to Firebase Storage
- Returns: project_dir, composition_url

**Step 6:** `render_hyperframes`

Pass: composition_url from scaffold_hf_project

Behavior:

- Checks if local project_dir exists with index.html — uses it directly if so
- Otherwise downloads full project from Firebase Storage (hf_project asset URL)
- Runs hyperframes lint on project_dir

**On lint failure:**

- Returns: `{ success: false, lint_errors: "...", project_dir: "..." }`
- Read lint_errors carefully — they name the specific file and line
- Use `read_file` to read that file, understand what's wrong
- Use `write_file` to patch the specific file only
- Call `render_hyperframes` again with the same composition_url
- Repeat until lint passes (max 3 attempts before telling user one plain sentence)

**On render success:**

- Returns: `{ success: true, video_url: "..." }`
- Show video_url prominently to user



## Karaoke Captions

Always enabled on every mode. scaffold_hf_project receives transcript_words and generates
word-level karaoke caption groups injected into compositions/captions-overlay.html.
Caption position: bottom 96px, centered. Karaoke highlight animates per word group.
Captions are always on top of everything — z-index 10+.
Caption right edge stops at 1550px to avoid PIP overlap in Mode A and B.

## Deterministic vs Agent-Generated


| Element                                    | Who generates it                                           |
| ------------------------------------------ | ---------------------------------------------------------- |
| Speaker video position and PIP transitions | Deterministic — GSAP presets in scaffold_hf_project        |
| Manim clip placement (full canvas)         | Deterministic — injected by scaffold_hf_project            |
| Mode B safe zone enforcement (left 65%)    | Agent responsibility — follow content placement rules      |
| Caption layer position and structure       | Deterministic — captions-overlay.html template             |
| index-root.html wiring and audio track     | Deterministic — scaffold_hf_project                        |
| All timestamps                             | Always from Groq Whisper word-level data — never estimated |
| Mode B sub-composition HTML/CSS/GSAP       | Agent-written — Phase 3                                    |
| Visual type decision for Mode B            | Agent — based on transcript understanding                  |
| Manim Python scripts                       | Agent — generate_manim_script                              |




## Sub-Skill Reference

Always read the relevant skill file before using that tool:

- Before `generate_manim_script`: read `Skills/manim-video/SKILL.md`
- Before Phase 3 Mode B writing: read `Skills/hyperframes/SKILL.md`
- Before `render_hyperframes`: read `Skills/hyperframes/hyperframes-cli/SKILL.md`



## On Failure

One plain sentence to the user. Never mention tool names, file paths, or technical details.

- Mode B segment fails → fall back to Mode C for that segment, continue
- Manim clip fails → skip that concept, continue with remaining clips
- Lint fails → patch and retry (max 3 attempts), then tell user one plain sentence
- Any other failure → tell user one plain sentence, continue with what worked



## On Edit Requests

Before any edit, always:

1. `read_file("{project_dir}/COMPOSITION_MANIFEST.json")` — get file map and current values
2. If manifest missing, `search_files(directory: project_dir, pattern: "*.html")` to locate files
3. `read_file` the specific file before patching — understand existing structure first
4. `write_file` to patch only the specific file
5. `render_hyperframes` to re-render

Identify which phase is affected. Re-run only from that phase forward. Never restart the full pipeline.

### Speaker position edits

"move speaker to top right" / "make speaker smaller" / "circular frame" / "center the video" / "corner":

- Read manifest `speaker.presets` for named presets: FS, PIP_MANIM, TOP_RIGHT, CENTER, CIRCLE
- `read_file("{project_dir}/index.html")` to see current GSAP tween calls
- `write_file` to patch `tl.set('#speaker-wrap', ...)` and `tl.to('#speaker-wrap', ...)` in index.html
- `render_hyperframes`



### Caption style edits

"bigger captions" / "different color" / "move captions up" / "smaller text":

- Read manifest `captions.current` for current font_size, color, position_bottom values
- `write_file` to patch those values in `compositions/captions-overlay.html`
- `render_hyperframes`



### Mode B content edits

"change that chart" / "use a comparison table" / "make the diagram different":

- Re-run Phase 3 for that specific segment only
- Filter transcript_words for that segment's time window
- Read HyperFrames skill, write new sub-composition HTML via `write_file` to same path
- `render_hyperframes`



### Segment edits

"add an animation at 30s" / "remove the last animation" / "add a chart at 45s":

- Adding Manim: `generate_manim_script` + `render_manim_clips` for new concept
- `plan_hf_segments` with updated clip list
- Phase 3 for any new Mode B segments
- `scaffold_hf_project` with updated segments
- `render_hyperframes`



### Brand/color edits

"change the accent color" / "use red instead of blue":

- `scaffold_hf_project` with updated brand_colors
- `render_hyperframes`

