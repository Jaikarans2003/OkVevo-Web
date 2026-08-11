---

## name: edu-video

description: >
  Transform a teacher video recording into an educational video with Manim animations,
  karaoke captions, and automatic speaker layout. HyperFrames is the assembly/render layer only.
  Two display modes switch automatically per segment. Use when asked to generate an educational
  video from a recording.

# Edu-Video Pipeline — Orchestration Skill

Transforms a teacher's video recording into an educational video (horizontal 1920×1080 or vertical 1080×1920).
Every extracted concept is animated with Manim. HyperFrames assembles and renders the final composite — no per-segment creative HTML generation.

**Transcription resilience:** `transcribe_video` routes by language choice. **English** extracts FLAC, splits into overlapping ~8 min chunks, and tries Groq then OpenRouter per chunk (Ask-Me chunk failures pause with Retry / Continue-with-gap / Abort). **Auto-detect** sends full audio to Fal ElevenLabs Scribe v2 (no our-side chunking). Language is chosen in the **front-loaded Video preferences** batch (Ask) or defaults to Auto-detect (Auto-Run) — `transcribe_video` does not re-ask if `requestedLanguage` is already on the session.

**Front-loaded preferences (Ask-Me, before transcription):** One paginated checkpoint covers language, orientation, brand colors, and animation style when not already stated in the user prompt. Skip uses defaults (language=`auto`, orientation from ffprobe hint or horizontal, brand from video sample or orange/black, animation=`moderate`). Auto-Run applies those defaults silently. Never re-ask via `ask_clarification`.

**Orientation:** Prefer the front-loaded choice. Legacy fallback: after Concepts approve, a Video orientation checkpoint may still appear only if preferences were not front-loaded. Auto-Run silently uses horizontal when unset. Session field `orientation` drives Manim (vertical = square 1080×1080 pixels + equal `config.frame_width`/`frame_height`) and which template tree is copied.

**Animation style:** Front-loaded choices `minimal` (no arrows) / `moderate` (default) / `detailed`. Session field `animationStyle` is injected into `generate_manim_script`.

Two display modes, auto-assigned per transcript segment:

**Horizontal (16:9):**
- **Mode A:** Ambient gradient + Manim centered 85% canvas + speaker circular PIP bottom-right (237px) + karaoke captions
- **Mode C:** Ambient gradient + speaker video centered 65% canvas + karaoke captions

**Vertical (9:16):**
- **Mode A:** Square Manim pod top ~50% + speaker rounded bottom ~50% + captions in the center gap (plain rounded corners, no liquid-glass)
- **Mode C:** Edge-to-edge speaker + bottom captions (Mode A mid-gap captions unchanged; no liquid-glass)

Mode C covers intros, transitions, narrative, speaker-attention beats between animations (anecdotes, direct appeals, key spoken takeaways), and any time not covered by a successful Manim clip. Every Mode C segment lasts at least 3s — shorter gaps are absorbed into continuous animation. Zero concepts on a very short or meta-only recording is valid (all Mode C).

## Ask-Me check-ins

These apply **only in Ask-Me mode** (`pipelineMode: ask`). In Auto-Run mode, do not call `ask_clarification` for routine phase boundaries — proceed autonomously.

### Tool-owned vs non-tool (do not duplicate)

| Decision | Classification | Where |
| --- | --- | --- |
| Transcription language | Non-tool, front-load | Video preferences batch |
| Video orientation | Non-tool, front-load | Video preferences batch |
| Brand colors | Non-tool, front-load | Video preferences batch |
| Animation style | Non-tool, front-load | Video preferences batch (Skip/Auto default = `moderate`) |
| Concepts approval | Tool-owned | `extract_concepts` |
| "Lecture heard" continue | Tool-owned | Fal STT finalize |
| Chunk-failure retry | Tool-owned | English `transcribe_video` path |

**Never** ask language / orientation / brand / animation style via `ask_clarification` when they were already answered in Video preferences or stated in the prompt.

**Precise preference rule:** Before generating content, if a preference would materially affect output quality and is neither stated in the user's prompt nor derivable from already-available context, surface it as a front-loaded question rather than silently defaulting. Never ask about something already stated. Never ask about something that genuinely depends on a pipeline step that hasn't run yet.

**Mandatory:** Ask-Me mode auto-pauses after `extract_concepts` with a Concepts extracted phase gate (Continue + freeform edits). Approving Continue proceeds to Manim when orientation was front-loaded; otherwise a deterministic Video orientation checkpoint may still open. Do not call `ask_clarification` again for concepts on the approve path — wait for the user.

**After concept revision / freeform edits:** apply edits to `concepts.json` via `write_file` or `str_replace` only. If orientation is already on the session from Video preferences, proceed to `generate_manim_script`. Otherwise call `ask_clarification` exactly once with:
- `phase_label: "Video orientation"`
- `question: "Choose video orientation to continue."`
- `choices: [{ id: "horizontal", label: "Horizontal (16:9)" }, { id: "vertical", label: "Vertical (9:16)" }]`
- `allowFreeform: false`

Do **not** call `generate_manim_script`, `render_manim_clip`, `extract_concepts`, `scaffold_hf_project`, or `render_hyperframes` in that revision turn when orientation is still needed. Manim starts only after orientation is known.

In Ask-Me mode, **consider** calling `ask_clarification` after each major milestone when you want the user to review before continuing:

- After `transcribe_video` — summarize duration and word count
- After all `render_manim_clip` calls complete — summarize clips rendered vs dropped
- After `plan_segments` — summarize segment counts and total duration
- After `scaffold_hf_project` — confirm composition is ready
- **Before** `render_hyperframes` — same soft check-in; final render is irreversible, so wait for explicit approval

Use `phase_label` for a short milestone title, `context` for summary bullets, and optional `choices` / `allowFreeform`. The checkpoint waits indefinitely until the user explicitly answers — closing the browser does not auto-proceed.

After the user responds, pick the next tool freely based on their answer. Do not restart from transcription unless they asked to start over. After checkpoint resume / Continue: call the next tool before any status text — do not re-announce prior phases or invent concept counts, names, or later milestones until this turn's tool results confirm them.

## UI Activity Trace vs User Text

`[[STATUS: …]]` markers belong in **reasoning** only (see AGENT.md). User-facing
progress is normal assistant **text** — short conversational narration after each
major confirmed milestone. Never put status markers in user-visible text.

**Never state a step is done unless that turn’s tool result confirms success.** Mapping:


| Milestone     | Confirmed only by                                                                         |
| ------------- | ----------------------------------------------------------------------------------------- |
| Transcription | successful `transcribe_video`                                                             |
| Concepts      | successful `extract_concepts`                                                             |
| Animations    | successful `render_manim_clip` result(s) in this turn                                     |
| Timeline      | successful `plan_segments`                                                                |
| Scaffold      | successful `scaffold_hf_project`                                                          |
| Render        | `render_hyperframes` with `render_status: RUNNING` only — never claim the MP4 is finished |


If a tool was not called or returned failure: say so in one plain sentence. Do not invent counts (“all 6 clips”), colors, styles, or other completed work. Same rule after checkpoint resume: no status claims until this turn’s tool results confirm them.

After each confirmed milestone, write 1–2 short conversational sentences: what just
finished in plain language, and what’s next. Tone bar: warm and concrete, like a
colleague updating you mid-build — not a bullet card.

Examples (adapt to actual results; never invent numbers):

- Transcription: “Got the transcript — about 12 minutes, roughly 1,800 words. Pulling out the concepts worth animating next.”
- Concepts: “Found 4 concepts worth animating — I’ll generate those animations next.”
- Animations: “Animations are ready. Lining up the timeline so each clip lands with the right segment.”
- Timeline: “Timeline’s set. Setting up the video composition next.”
- Scaffold: “Your video’s structure is ready. Kicking off the final render in the background.”
- Render dispatch: “Final render is running in the background — I’ll surface the MP4 when it’s ready.”

Never mention tool names, file paths, or technical details to the user.

## Tools Available

- `transcribe_video` — English: chunked Whisper (Groq→OpenRouter); Auto-detect: Fal ElevenLabs Scribe v2 on full audio. Ask-Me may pause for English/Auto-detect then chunk-failure Retry/Continue/Abort (English path only); returns transcript_url, transcript_text, duration_seconds, word_count; may return `gaps` (Auto-Run English). Word timings on disk/Storage. Simulate Groq outage with `TRANSCRIBE_FORCE_GROQ_FAIL=1`.
- `extract_concepts` — extracts Manim-worthy concepts from the session transcript on disk; returns snapped timestamps and concept_count
- `generate_manim_script` — writes Python Manim script for one concept, validates syntax, persists script_path on disk
- `render_manim_clip` — renders one Manim script to MP4; accepts script_path for patch-and-re-render
- `plan_segments` — deterministic timeline: Mode A at Manim clips, Mode C fills gaps
- `scaffold_hf_project` — deterministic template injector, no LLM, writes full HyperFrames project to disk and Firebase Storage
- `render_hyperframes` — runs HyperFrames lint, dispatches an AWS Lambda render, and returns the background job
- `run_command` — run shell commands (misc utilities). Not for orientation / format / re-encode of the composition — those go through pipeline tools (`scaffold_hf_project`, `render_hyperframes`, …) or `ask_clarification`.
- `write_file` — write files to disk (used for Manim script patches and lint fixes)
- `read_file` — read any file from disk (used before patching scripts or manifest)
- `search_files` — find files by name or content (used when manifest is missing)



## Tool Sequence



### Phase 1 — Transcription and Concept Extraction

**Step 1:** `transcribe_video`

- Pass: video_url from context
- Ask-Me: language/orientation/brand/style come from the front-loaded Video preferences batch (or prompt). On resume call `transcribe_video` with the same `video_url`. English pins Whisper `language: en`; Auto-detect uses Fal Scribe v2 (native script). Auto-Run defaults to Auto-detect.
- Returns: transcript_url, transcript_text, duration_seconds, word_count
- Word-level timestamps are written to session `transcript.json` (disk + Storage). Later tools load them — do not re-pass the words array.
- **Auto-detect (`haltTurn`):** when `transcribe_video` returns `{ status: 'queued', haltTurn: true }`, end the turn immediately. Do **not** call `run_command` with `sleep` / `ls` / `find` (or any filesystem poll) looking for `transcript.json`. Completion arrives via webhook + entry-gate wake (Ask checkpoint or Auto continue) — never via shell discovery.

**Step 2:** `extract_concepts`

- Pass: duration_seconds only (from step 1). Do **not** pass `transcript_text` or `transcript_words` — the tool loads both from the session transcript written by `transcribe_video`
- LLM returns concepts with excerpt field; every concept is implicitly Manim
- Tool snaps excerpts to word-level timestamps deterministically, drops failed snaps and overlaps
- Returns: concepts[] each with concept_name, explanation, start_seconds, end_seconds, concept_count
- Zero concepts is valid for very short or meta-only recordings



### Phase 2 — Manim (all extracted concepts, run sequentially)

For **each** concept from extract_concepts:

1. Read `Skills/manim-video/SKILL.md` before the first `generate_manim_script` for that concept
2. `generate_manim_script` — pass concept_name, explanation, window_seconds=(end_seconds - start_seconds) as pacing context only (not a target), and the same optional `brand_colors` you will pass to `scaffold_hf_project` (omit to use template defaults: primary #f97316 orange, accent #fb923c, bg_dark #0a0a0a black; caption text is white)
3. `render_manim_clip` — pass script_path (from generate_manim_script), class_name, concept_name, start_seconds, end_seconds
4. Collect successful results into manim_clips[] for Phase 3

**On Manim render failure — patch, do NOT regenerate:**

1. Read `Skills/manim-video/references/troubleshooting.md` (and the relevant concept ref if domain-specific)
2. `read_file` the failed script using script_path from generate_manim_script — not memory
3. Identify the specific line(s) from stderr (traceback, LaTeX error, TypeError, etc.)
4. `write_file` a minimal patch — change only the broken lines/blocks; preserve class name, imports, scene structure, and working animations
5. `render_manim_clip` again with script_path — do not re-paste the full script through context

**Patch by default for:** LaTeX/raw-string issues, VGroup vs Group errors, invalid Text() kwargs, missing self.wait(), buff/FadeOut issues, any localized traceback, `AssertionError` from `VisibleTracker.check` / "N tracked visible items (...), max is MAX_VISIBLE — hide() some before adding more" (Group related eqs into one VGroup, `tracker.hide()` spent labels/rects, or `clear_scene` between beats — not a full-regen case). **Never raise `MAX_VISIBLE`** — it is immutable at 6.

**Full regenerate via** `generate_manim_script` **only when:** 3 patch cycles exhausted and error persists, script is structurally wrong (wrong scene class, empty construct, fundamentally wrong approach), or error spans most of the file.

**After 3 failed patch cycles + optional one full regen:** drop that clip from manim_clips[]; that window becomes Mode C at plan_segments time; one plain sentence to user.

### Phase 3 — Segment Planning

**Step 3:** `plan_segments`

- Pass:
  - manim_clips[] — successfully rendered clips (concept_name, start_seconds, end_seconds; clip_url only needed for scaffold)
  - total_duration — duration_seconds from transcribe_video
- Deterministic — succeeds on first call, no retry loop
- Returns: segments[] with mode (A/C), start, end, manim_index (for A)



### Phase 4 — Assembly and Render

**Step 4:** `scaffold_hf_project`

Pass:

- `speaker_video_url` — original video URL from context
- `manim_clips[]` — all clips from Phase 2 with clip_url, concept_name, start_seconds, end_seconds
- `transcript_words[]` — array from transcribe_video (for karaoke captions). You may pass an empty array `[]`: scaffold automatically loads the full word list persisted by transcribe_video
- Segments are loaded automatically from the session plan written by `plan_segments` — do not pass `segments[]`
- `total_duration` — duration_seconds from transcribe_video (scaffold extends this to the real video duration via ffprobe if whisper undershot)
- `brand_colors` — optional, defaults: primary `#f97316` (orange), accent `#fb923c` (light orange), bg_dark `#0a0a0a` (black); captions use white text

What scaffold_hf_project does (deterministic, zero LLM calls):

- Copies template scaffold from `Skills/edu-video/templates/{horizontal|vertical}/` based on session orientation
- For Mode A and C segments: uses mode-a.html / mode-c.html templates
- Injects all segment wiring, Manim clip HTML, speaker GSAP transitions, Manim show/hide on the root timeline, karaoke captions
- Writes orientation into meta.json and COMPOSITION_MANIFEST.json
- Downloads speaker video, always normalizes to ≤1080p H.264 (CRF 20, 30fps, no audio track), extracts audio.mp3 from the raw download, then downloads Manim clips to assets/
- If normalized speaker still exceeds ~180MB → fail; tell user one plain sentence (see On Failure)
- Writes COMPOSITION_MANIFEST.json
- Uploads Phase A checkpoint (index.html only) immediately
- Uploads full project directory to Firebase Storage
- Returns: project_dir, composition_url

**Step 5:** `render_hyperframes`

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

- Returns immediately: `{ success: true, render_status: "RUNNING", execution_arn, output_key, composition_url }`
- Tell the user the final render is running in the background. Completion updates the session and video URL independently.



## Karaoke Captions

Always enabled on every mode. scaffold_hf_project receives transcript_words and generates
word-level karaoke caption groups injected into compositions/captions-overlay.html.
Caption position: bottom 96px, centered. Karaoke highlight animates per word group.
Captions are always on top of everything — z-index 10+.
Caption right edge stops at 1550px to avoid PIP overlap in Mode A.

## Deterministic vs Agent-Generated


| Element                          | Who generates it                                                         |
| -------------------------------- | ------------------------------------------------------------------------ |
| Speaker video position and PIP   | Deterministic — GSAP presets in scaffold_hf_project                      |
| Manim clip placement (85% float) | Deterministic — injected by scaffold_hf_project                          |
| Caption layer position           | Deterministic — captions-overlay.html template                           |
| index-root.html wiring           | Deterministic — scaffold_hf_project                                      |
| All timestamps                   | Always from Groq Whisper word-level data — never estimated               |
| Manim Python scripts             | Agent — generate_manim_script; patch via read_file/write_file on failure |
| Concept count and selection      | Agent — extract_concepts, guided by duration and content                 |
| Mode A/C timeline partition      | Deterministic — plan_segments                                            |
| Final composite render           | Deterministic — render_hyperframes (HyperFrames AWS Lambda)              |




## Sub-Skill Reference

Always read the relevant skill file before using that tool:

- Before `generate_manim_script`: read `Skills/manim-video/SKILL.md`
- On Manim render failure: read `Skills/manim-video/references/troubleshooting.md`
- Before `render_hyperframes`: read `Skills/hyperframes/hyperframes-cli/SKILL.md`
- On edit requests for an existing draft: read `Skills/edu-video/references/edit-requests.md`



## On Failure

One plain sentence to the user. Never mention tool names, file paths, or technical details.

- Manim clip fails after patch cycles → drop clip, Mode C fills that window; continue
- extract_concepts may return zero concepts on short/meta recordings — all-C timeline is valid
- Lint fails → patch and retry (max 3 attempts), then tell user one plain sentence
- Speaker video still too large after 1080p normalization → tell user the recording is too long to process
- Any other failure → tell user one plain sentence, continue with what worked



## On Edit Requests

Before making any edit to an existing draft, read `Skills/edu-video/references/edit-requests.md`.

## Background job rule

Any tool whose own execution could plausibly leave the SSE stream silent for **~60–90+ seconds** (unlike Manim's naturally chunked per-clip renders) **must** submit as a background job and return an immediate handle, ending the turn. The agent must not block inside a held SSE connection waiting for completion.

**Pattern:** submit job → persist job handle on session (Firestore) → return `{ job_status: 'RUNNING', job_id }` → turn ends → completion arrives via webhook/callback or entry-gate wake → fresh invocation resumes with `ensureSessionArtifacts`. Do **not** poll the filesystem (`ls`/`find`/`sleep` loops) for artifacts such as `transcript.json` after `haltTurn`.

**Existing example:** `render_hyperframes` (HeyGen `--no-wait` + callback); Fal auto-detect STT via `transcribe_video` (`haltTurn` + webhook wake).

**Future candidates:** cleanup service, bulk asset processing, long ffmpeg batch jobs. Do not add synchronous wrappers for these.