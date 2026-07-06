---

## name: edu-video

description: Transform a teacher video recording into an educational video with Manim animations, HyperFrames motion graphics, karaoke captions, and automatic speaker layout. Orchestrates the manim-video skill (concept animations) and hyperframes skill (motion graphic overlays). Three display modes switch automatically per segment. Use when asked to generate an educational video from a recording.

# Edu-Video Pipeline — Orchestration Skill

## What This Does

Transforms a teacher's video recording into a 1920×1080 educational video.
Coordinates two sub-skills: manim-video (mathematical animations) and
hyperframes (motion graphic overlays for data, comparisons, timelines, and general visual reinforcement).

Three display modes, auto-assigned per transcript segment:

- **Mode A:** Manim animation full canvas + speaker PIP bottom-right (422×237px) + karaoke captions
- **Mode B:** Ambient gradient background + HyperFrames motion graphic overlay (agent-written) + speaker PIP bottom-right + karaoke captions
- **Mode C:** Ambient gradient background + speaker video centered 65% canvas + karaoke captions

Every finished video includes all three modes. The agent decides how many concepts fit the lecture length — do not over-clutter short videos.

## UI Activity Trace vs User Text

Activity trace shows each step as collapsible cards. Keep text responses brief.

- After transcription: title and duration only, one sentence
- After concept extraction: how many Manim vs HyperFrames concepts found, one sentence
- After segment planning: confirm all three modes are present, one sentence
- After Mode B generation: confirm motion graphics ready, one sentence
- After animations: "animations ready", one sentence
- After final render: show video URL prominently, ask if they want changes

Never mention tool names, file paths, or technical details to the user.

## Tools Available

- `transcribe_video` — transcribes speaker video, returns transcript_text, transcript_words[], duration_seconds, word_count
- `extract_concepts` — classifies concepts as visual manim, hyperframes, or none; returns snapped timestamps, manim_count, hyperframes_count
- `generate_manim_script` — writes Python Manim script for one concept, validates syntax
- `render_manim_clip` — renders one Manim script to MP4, returns clip_url, start_seconds, end_seconds
- `plan_segments` — deterministic timeline: Mode A at Manim clips, Mode B at HyperFrames concepts, Mode C fills gaps
- `generate_hyperframes_html` — generates and writes one Mode B sub-composition HTML file (loads HyperFrames skills internally)
- `scaffold_hf_project` — deterministic template injector, no LLM, writes full HyperFrames project to disk and Firebase Storage, returns project_dir and composition_url
- `render_hyperframes` — runs hyperframes lint then render, returns structured lint errors on failure or video_url on success
- `run_command` — run shell commands (used for patches, ffmpeg, etc.)
- `write_file` — write files to disk (used for lint patches and small targeted edits)
- `read_file` — read any file from disk (used before patching, reading manifest)
- `search_files` — find files by name or content (used when manifest is missing)



## Tool Sequence



### Phase 1 — Transcription and Concept Classification

**Step 1:** `transcribe_video`

- Pass: video_url from context
- Returns: transcript_url, transcript_text, transcript_words[], duration_seconds, word_count
- transcript_words[] contains word-level timestamps from Groq Whisper — use these always, never estimate timestamps
- Save transcript_words[] — needed for Phase 3 and Phase 4

**Step 2:** `extract_concepts`

- Pass: transcript_text, transcript_words (full array from step 1), duration_seconds
- LLM returns concepts with excerpt field and visual classification (manim / hyperframes / none)
- Tool snaps excerpts to word-level timestamps deterministically and enforces non-overlap
- Returns: concepts[] each with concept_name, explanation, start_seconds, end_seconds, visual
- Also returns manim_count and hyperframes_count — both must be at least 1

**Step 3: For each concept where visual=manim (run sequentially)**

- Read `Skills/manim-video/SKILL.md` before writing any Manim script
- `generate_manim_script` — pass concept_name, explanation, duration_seconds=(end_seconds - start_seconds)
- `render_manim_clip` — pass script, class_name, concept_name, start_seconds, end_seconds
- Returns: clip_url, concept_name, start_seconds, end_seconds
- Collect all results into manim_clips[] for Phase 2
- **On Manim render failure:** reclassify that concept as hyperframes (add to hf_concepts[] for Phase 2) instead of skipping it



### Phase 2 — Segment Planning

**Step 4:** `plan_segments`

- Pass:
  - manim_clips[] — rendered clips from Phase 1 (concept_name, start_seconds, end_seconds; clip_url only needed for scaffold)
  - hf_concepts[] — concepts where visual=hyperframes from extract_concepts, plus any Manim failures reclassified in Step 3 (concept_name, explanation, start_seconds, end_seconds)
  - total_duration — duration_seconds from transcribe_video
- Deterministic — succeeds on first call, no retry loop
- Returns: segments[] with mode (A/B/C), start, end, manim_index (for A), concept_name + explanation (for B)



### Phase 3 — Mode B Sub-Compositions

**Runs on every video** — at least one Mode B segment is mandatory. This phase is BLOCKING: scaffold_hf_project fails if any Mode B segment file is missing. Never call scaffold_hf_project until every Mode B segment has its file written, or has been re-planned as Mode C (last resort only).

For each segment where mode=B:

1. Filter `transcript_words` where `word.start >= segment.start` and `word.end <= segment.end`, join into `transcript_excerpt`
2. `generate_hyperframes_html` — pass:
  - `segment_number` — 1-based position in the FULL segments[] array (counting Mode A and C segments too): first segment = 1
  - `concept_name` — from segment
  - `explanation` — from segment
  - `transcript_excerpt` — filtered words from step 1 (meaning only — tool visualizes, does not subtitle)
  - `duration_seconds` — `segment.end - segment.start`
3. The tool loads creative refs + diagram blueprint + animation rules internally; generates SVG/icon diagrams (not kinetic typography — captions carry spoken words); validates HTML; writes to `hf-project/compositions/sections/{NN}-segment-{NN}.html`
4. Tool returns `archetype`, `blueprint_used`, and `rules_used`

**On tool failure after internal retry:** fall back to Mode C for that segment only — change that segment's `mode` to `"C"` in the segments array you pass to scaffold_hf_project. Tell the user one plain sentence that one motion graphic could not be included.

Then proceed to Phase 4 (`scaffold_hf_project`).

**Contract enforced by the tool** (for reference — you do not write this HTML manually):

- Wrapped in `<template id="seg-{NN}-b-template">`
- Inner div: `data-composition-id="seg-{NN}-b"` `data-start="0"` `data-width="1920"` `data-height="1080"` `data-duration="{segment.end - segment.start}"`
- Root div: `id="seg-{NN}-b"` + `data-composition-id="seg-{NN}-b"`; CSS root via `#seg-{NN}-b`, descendants via plain classes — never `[data-composition-id="..."]` in CSS (HyperFrames double-scopes it)
- GSAP CDN, paused timeline, `tl.set({}, {}, DURATION)` padding
- Visual content in left 65% of canvas — right 35% reserved for speaker PIP
- Brand CSS variables, no video/audio elements, no infinite repeats



### Phase 4 — Assembly and Render

**Step 5:** `scaffold_hf_project`

Pass:

- `speaker_video_url` — original video URL from context
- `manim_clips[]` — all clips from Phase 1 with clip_url, concept_name, start_seconds, end_seconds
- `segments[]` — from plan_segments, with manim_index for Mode A segments
- `transcript_words[]` — array from transcribe_video (for karaoke captions). You may pass an empty array `[]`: scaffold automatically loads the full word list persisted by transcribe_video, which is more reliable than re-passing 1000+ words through context
- `total_duration` — duration_seconds from transcribe_video (scaffold extends this to the real video duration via ffprobe if whisper undershot)
- `brand_colors` — optional, defaults: primary #1a1a2e, accent #37bdf8, bg_dark #0a0a0f

What scaffold_hf_project does (deterministic, zero LLM calls):

- Copies template scaffold from Skills/edu-video/templates/
- For Mode B segments: uses the agent-written file from Phase 3 — does not overwrite. **Fails with an error if any Mode B segment's file is missing** (see Phase 3)
- For Mode A and C segments: uses mode-a.html / mode-c.html templates
- Injects all segment wiring, Manim clip HTML, speaker GSAP transitions, Manim show/hide on the root timeline, karaoke captions
- Downloads speaker video and all Manim clips to assets/, extracts audio via ffmpeg
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


| Element                                      | Who generates it                                           |
| -------------------------------------------- | ---------------------------------------------------------- |
| Speaker video position and PIP transitions   | Deterministic — GSAP presets in scaffold_hf_project        |
| Manim clip placement (full canvas)           | Deterministic — injected by scaffold_hf_project            |
| Mode B safe zone enforcement (left 65%)      | Agent responsibility — follow content placement rules      |
| Caption layer position and structure         | Deterministic — captions-overlay.html template             |
| index-root.html wiring and audio track       | Deterministic — scaffold_hf_project                        |
| All timestamps                               | Always from Groq Whisper word-level data — never estimated |
| Mode B sub-composition HTML/CSS/GSAP         | `generate_hyperframes_html` tool — Phase 3                 |
| Visual type decision for Mode B              | Agent — based on transcript understanding                  |
| Manim Python scripts                         | Agent — generate_manim_script                              |
| Concept count and manim vs hyperframes split | Agent — extract_concepts, guided by duration and content   |
| Mode A/B/C timeline partition                | Deterministic — plan_segments                              |




## Sub-Skill Reference

Always read the relevant skill file before using that tool:

- Before `generate_manim_script`: read `Skills/manim-video/SKILL.md`
- Before `render_hyperframes`: read `Skills/hyperframes/hyperframes-cli/SKILL.md`



## On Failure

One plain sentence to the user. Never mention tool names, file paths, or technical details.

- Mode B segment fails after retry → fall back to Mode C for that segment, continue (mention one graphic was skipped)
- Manim clip fails → reclassify concept as hyperframes for plan_segments; do not drop it
- extract_concepts may return visual=none for overlap-dropped concepts — only render/plan manim and hyperframes entries
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

- Re-call `generate_hyperframes_html` for that segment (same path overwrites)
- `render_hyperframes` — skip re-scaffold if only section content changed



### Segment edits

"add an animation at 30s" / "remove the last animation" / "add a chart at 45s":

- Adding Manim: `generate_manim_script` + `render_manim_clip` for new concept
- `plan_segments` with updated clip list and hf_concepts
- `generate_hyperframes_html` for any new Mode B segments
- `scaffold_hf_project` with updated segments
- `render_hyperframes`



### Brand/color edits

"change the accent color" / "use red instead of blue":

- `scaffold_hf_project` with updated brand_colors
- `render_hyperframes`

