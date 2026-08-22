Nia does not get every file in `services/agent/src/tools`. She gets a **named allowlist**. `buildTools()` builds all factories, then keeps only the names in `catalog.ts` for the current skill.

There are **19 LLM-callable tools**. Everything else in this folder is helper code those tools use.

---

## How the firewall works

```
runAgent
  → buildTools(ctx, skillsUsed)
      creates ALL factories
      then filters to BASE_TOOLS ∪ SKILL_TOOLS[skill]
```

| Skill | Tools Nia actually sees |
|---|---|
| none / unknown | 11 base tools only |
| `edu-video` | 11 base + 8 pipeline |
| `manim-video` | 11 base + `generate_manim_script`, `render_manim_clip` |
| `hyperframes` | 11 base + `render_hyperframes` |
| `background-generation` | **only** `ask_clarification`, `image_generate`, `video_generate` — no `run_command` |

That last override exists so the model cannot improvise rembg/OpenCV/shell instead of the Fal generate tools.

Session disk is `/tmp/okvevo/<sessionId>/`. Durable copies live in Firebase Storage under `users/<userId>/sessions/<sessionId>/`. Many tools hydrate from Storage if the container is cold (`ensureSessionArtifacts`).

---

## Edu-video pipeline (the 8 extra tools, in order)

```
transcribe_video
  → extract_concepts
      → generate_manim_script  ─┐  (once per concept)
      → render_manim_clip      ─┘
  → plan_segments
  → scaffold_hf_project
  → render_hyperframes

restore_generation  (side door: rebuild hf-project from a past draft, then edit + re-render)
```

---

# Base tools (always on, except background-generation)

## 1. `run_command`

**File:** `general/filesystem.ts`

Runs a shell command in the session workdir via `execCommand`. Default timeout 300s (600s suggested for Manim/HF).

**Inputs:** `command`, optional `timeout_seconds`.

**Returns:** `stdout`, `stderr`, `exit_code`, `success`.

**Guards**
- Blocks `/proc/.../environ` (credential scrape).
- Blocks shell edits of owned files: `hf-project/index.html`, `hf-project/compositions/**/*.html`, `COMPOSITION_MANIFEST.json`, `manim_scripts/*.py`. Those must go through `write_file` / `str_replace`. Copying into `hf-project/assets` is allowed.
- Env is a **sanitized subset** (`PATH`, `HOME`, `TMPDIR`, …) — no API keys in the child.
- If the command string mentions a tagged asset’s local path, that asset is downloaded first.

**What it is for:** ffmpeg, `manim` (normally via `render_manim_clip`), HyperFrames CLI lint (normally via `render_hyperframes`). **What it is not for:** reinventing `transcribe_video` / rembg / caption pipelines.

---

## 2. `write_file`

Writes UTF-8 to a path relative to the session workdir (or absolute).

**Inputs:** `path`, `content`.

**Side effects**
- If the file is missing, restores the parent artifact family from Storage (so a cold container can still patch `hf-project/index.html`).
- Manim scripts (`manim_scripts/*.py`) must keep `MAX_VISIBLE = 6` and `VisibleTracker` — otherwise it returns an error and does not write.
- Edits under `hf-project/` are uploaded back to Storage (`syncHfProjectFileAfterEdit`) so the next turn / next container still sees them.

---

## 3. `read_file`

Reads a file as text. Default cap **50,000 bytes** (truncates from the start of the remainder). Binary files return a stub, not bytes.

**Inputs:** `path`, optional `max_bytes`.

Paths resolve through `resolveToolPath` (session workdir, or `Skills/...` for skill files). Missing session artifacts are hydrated from Storage first.

---

## 4. `search_files`

Walks a directory (max 20 files by default). Optional filename glob (`*.html`) and/or substring `content_search` with line numbers.

Used to find a CSS selector or placeholder inside `hf-project/` without dumping whole files into context.

---

## 5. `str_replace`

Surgical one-occurrence replace. Fails if `old_string` is missing or appears more than once.

**Quirk:** `pickStrReplacePair` can decode model-escaped `\n` sequences so the model’s escaped string still matches real newlines.

Same Manim `MAX_VISIBLE` guard and same `hf-project` Storage sync as `write_file`.

---

## 6. `web_search`

Tavily search. Needs `TAVILY_API_KEY`.

**Inputs:** `query`, `max_results` 1–10 (default 5).

**Returns:** JSON of title, URL, 500-char snippet, score. No synthesized answer (`include_answer: false`).

---

## 7. `web_extract`

Tavily extract. 1–5 URLs. Each page truncated to **15,000 characters**.

Use after `web_search`, or when the user pastes a URL to analyse. Not a screenshot capture (unlike HyperFrames `capture`).

---

## 8. `vision_analyze`

Downloads an HTTP(S) image to `/tmp/okvevo/<session>/vision_*`, base64-encodes it, sends it to OpenRouter vision (`VISION_MODEL`, default `google/gemini-2.5-flash`), deletes the temp file.

**Inputs:** `image_url`, `question`.

Used for brand-from-thumbnail, reading a screenshot, inspecting a generated backdrop. Not a video analyser.

---

## 9. `ask_clarification`

The **Ask-Me pause**. Writes a Firestore checkpoint and returns `haltTurn: true` so `runAgent` stops the turn. The UI shows a card; the user’s answer resumes the agent.

**Inputs**
- `kind`: `single_select` (numbered choices) or `phase_gate` (Continue only)
- `question`, optional `context`, `phase_label`
- `choices` required for `single_select`, forbidden for `phase_gate`
- `allowFreeform` (required)

**Mode behaviour**
- **Ask-Me:** persist checkpoint, halt.
- **Auto-Run:** does **not** pause; returns the question text for Nia to relay (or skip).

**Hard block:** cannot re-ask tool-owned / front-loaded decisions (transcription language, orientation, brand, animation style) except the two legacy phase labels `Video orientation` and `Transcription language`. Those belong on the Video preferences batch or on `transcribe_video` itself.

Edu-video uses this for “Concepts extracted” (phase gate with freeform edits) and optional milestone check-ins.

---

## 10. `image_generate`

Queues a **still backdrop** on Fal. Returns immediately `{ request_id, status: 'queued' }`. The image lands in chat via webhook — the model must not invent a URL.

**Inputs:** `prompt`, `model` (closed enum), optional `aspect_ratio`, `resolution`.

| Registry key | Fal model |
|---|---|
| `studio_background` | `fal-ai/flux-2/klein/9b` |
| `nano_banana_2` | `fal-ai/nano-banana-2` |
| `nano_banana_2_lite` | `google/nano-banana-2-lite` |
| `nano_banana_pro` | `fal-ai/nano-banana-pro` |
| `gpt_image_2` | `openai/gpt-image-2` |

`mediaModelRegistry.ts` maps unified ratios (`16:9`, `9:16`, …) onto each vendor’s `image_size` vs `aspect_ratio` field. Invalid combos throw.

Auth: `FAL_API_IMAGE` or `FAL_API_KEY`.

This is the **background-generation** skill’s main tool.

---

## 11. `video_generate`

Same queue pattern for a **short backdrop clip** (Seedance 2.0). Default model `seedance_2_fast`. Duration enum `auto` or `4`–`15` seconds. Resolution `480p` or `720p`. Optional `reference_image_url` switches to the image-to-video Fal endpoint.

Auth: `FAL_API_VIDEO` → `FAL_API_KEY` → `FAL_API_IMAGE`.

Webhook task id `fal_video`. Audio generation is off (`generate_audio: false`).

---

# Pipeline tools (edu-video)

## 12. `transcribe_video`

**File:** `pipeline/transcribe.ts` (~1,023 lines)

**Input:** `video_url` (must be on the tagged-asset allowlist — the user-uploaded lecture).

Two engines, chosen by session language (Ask-Me asks first if unset; Auto-Run defaults to `auto`):

### English (`en`) — Groq Whisper, chunked

1. Download video, extract 16 kHz mono FLAC (`audioChunks.extractFlac`).
2. Split into **480s windows with 2.5s overlap**, max 15 MiB; 413 → split in half, depth ≤ 2.
3. Each window: Groq `whisper-large-v3-turbo` (word+segment timestamps). Transient fail → retry Groq → OpenRouter Whisper. Missing `words` is treated as failure.
4. Stitch overlaps (`transcriptStitch`), sanitize runaway timestamps (`transcriptSanitize`).
5. Persist `transcript.json` locally + Storage.

Ask-Me chunk failure pauses with Retry / Continue-with-gap / Abort. Progress is stored in Firestore so a restart does not re-Whisper completed chunks.

### Auto-detect — Fal ElevenLabs Scribe v2

Uploads full FLAC, queues `fal-ai/elevenlabs/speech-to-text/scribe-v2` with a webhook, returns `{ status: 'queued', haltTurn: true }`. Completion is `falSttDeliver.ts`, not this tool. If a job is already in-flight, it reconciles instead of double-queueing.

**Idempotent:** if progress is `complete` and `transcript.json` exists, it reuses it.

---

## 13. `extract_concepts`

**Input:** optional `duration_seconds` (otherwise taken from `transcript.json`). Transcript is loaded from disk, not passed in.

Calls Claude Haiku with `Skills/manim-video/references/scene-planning.md`. The LLM returns `{ concept_name, explanation, excerpt }` — **no timestamps**. Code snaps excerpts onto word timings (`snapToWords`), drops unmatched excerpts, de-overlaps (`resolveNonOverlappingConcepts`, min 4s), and bridges gaps under the Mode C minimum so you do not get flicker-length speaker flashes.

Retry: if the video is ≥20s and coverage is thin (0 concepts, &lt;2, or &lt;35% of duration), it asks the model once more for extra beats.

Writes `concepts.json` to Storage.

Ask-Me: phase-gate checkpoint “N concept(s) ready. Approve or describe edits.” Auto-Run: silently sets orientation to `horizontal`.

---

## 14. `generate_manim_script`

One concept → one Python file.

**Inputs:** `concept_name`, `explanation`, `window_seconds` (pacing hint only), optional `brand_colors`, optional `orientation`.

Pulls session brand / animation style / orientation. Loads `Skills/manim-video/SKILL.md` plus troubleshooting, animations, production-quality, and a topic file (`equations.md` / `graphs-and-data.md` / `mobjects.md`).

LLM (`AGENT_TOOL_MODEL`, default Sonnet 4.5) must emit:
- class `Scene{SafeName}`
- anti-overlap boilerplate (`MAX_VISIBLE = 6`, `VisibleTracker`)
- brand palette constants
- for vertical: `config.frame_width = config.frame_height = 8`

Then: `ast.parse` syntax check (one rewrite), `assertManimMaxVisible`, square-frame check. Writes `manim_scripts/{SafeName}.py` + Storage.

---

## 15. `render_manim_clip`

Runs Manim CE locally in Docker.

**Inputs:** `class_name`, `concept_name`, `start_seconds`, `end_seconds`, optional `script` / `script_path` / `orientation`.

Resolution order: `script_path` → inline `script` → `manim_scripts/{class without Scene}.py`.

`buildManimRenderCmd` → `execCommand` timeout 600s. Output expected at `videos/<script>/480p15/output.mp4`. Remuxes `+faststart`, copies to `manim/{SafeName}.mp4`, uploads versioned GCS name (`Foo.mp4`, `Foo_2.mp4`, …).

On failure the error tells Nia to **patch with `read_file`/`write_file`, not regenerate**, unless the script is hopeless.

Vertical render refuses landscape frame units (`assertSquareManimFrame`).

Returns `clip_url`, timestamps, `manim_count`, `dropped_count` (concepts minus successful clips).

---

## 16. `plan_segments`

**Not an LLM planner.** Deterministic: Mode **A** (Manim on canvas + speaker PIP) at each clip’s `[start, end]`; Mode **C** (speaker-only) fills every remaining gap. Short C gaps get absorbed so they do not flash.

**Inputs:** `manim_clips[]` with names + times, `total_duration`.

Writes the plan to Storage (`writeHfSegmentsPlan`). `scaffold_hf_project` refuses to run without it.

---

## 17. `scaffold_hf_project`

The compositor. Copies `Skills/edu-video/templates/{horizontal|vertical}` into `hf-project/`, then wires the lecture.

**Inputs:** speaker video URL, optional audio URL, manim clip URLs + times, transcript words, duration, optional brand, optional orientation.

**Does**
1. Refuses if a render is already `RUNNING`.
2. Allowlists speaker/clip URLs (tagged assets + this session’s Storage URLs). Session-latest Manim URL wins over a stale URL from chat.
3. Diffs vs last `renderSnapshot` so unchanged speaker/manim/brand files are not re-downloaded.
4. ffmpeg: extract MP3, normalize speaker to 1080p 30fps, trim dead air past last word (`resolveCompositionDuration`).
5. Builds one HTML section per segment, GSAP for speaker/manim/captions, karaoke groups from words.
6. Uploads `index.html` + project tree. Stores `renderSnapshot` on the session doc (restore recipe).

**Returns:** `project_dir`, `composition_url`, canvas size.

Speaker file cap: **180 MiB** after normalize.

---

## 18. `restore_generation`

Rebuilds the live `hf-project` from a previous **draft_video** asset’s metadata (`renderSnapshot` keys: orientation, speaker URL, manim clips, transcript, segment plan, brand).

**Inputs:** `asset_id` (preferred) or `url` of that draft.

Does **not** render. After restore, Nia edits HTML / re-scaffolds with a new orientation, then calls `render_hyperframes`. Speaker URL is pushed onto `restoreAllowlistUrls` so scaffold’s allowlist accepts it.

---

## 19. `render_hyperframes`

**Input:** `composition_url` (the scaffolded `index.html` in Storage).

1. Ensures `hf-project/` locally (download + minimal scaffold if missing).
2. Asserts HTML canvas matches session orientation.
3. Runs `hyperframes lint --json` (loads `Skills/hyperframes/hyperframes-cli/SKILL.md` only as log context).
4. Zips the project (Python zipfile, `index.html` at archive root; skips `node_modules`, `.git`, …).
5. **HeyGen cloud** (default `RENDER_BACKEND=heygen_cloud`): zip ≤32 MiB → URL ingest; ≤200 MiB → direct asset-id upload; larger → hard fail. Idempotency key = `sessionId` + zip SHA. Signed callback token. Returns immediately with `render_id`.
6. **Lambda:** `@hyperframes/aws-lambda/sdk` Step Functions path.

Completion is the HeyGen webhook or the render-completion Lambda — not this tool. Duplicate submit with the same zip fingerprint reuses the in-flight job.

May return `manim_fit_note` if a clip’s pixel aspect does not match the canvas (warn, still render).

---

# Files that are not tools

These are the rest of the tree. The model never calls them; the 19 tools do.

### `catalog.ts` / `index.ts`

Allowlist + `buildTools`. `ToolCtx` is `{ sessionId, userId, pipelineMode, skillName, taggedArtifacts, restoreAllowlistUrls }`.

### `general/mediaModelRegistry.ts`

Closed Fal enum, ratio/resolution mapping, selfcheck. Shared by `image_generate` and `video_generate`.

### `lib/` helpers (grouped by job)

| Helper | Serves |
|---|---|
| `utils.ts` (1,012 lines) | Workdir, path resolve, artifact hydrate, sanitized shell, OpenRouter, download, speaker normalize, HTML/GSAP builders, caption grouping, brand CSS, snap-to-words |
| `audioChunks.ts` | FLAC extract, 480s windows, 15 MiB re-split |
| `transcriptStitch.ts` | Overlap merge for English chunks |
| `transcriptSanitize.ts` | Clamp runaway word times before captions |
| `transcriptionProgress.ts` | Firestore chunk progress + Storage chunk blobs |
| `transcriptionLanguage.ts` | `en` vs `auto` |
| `elevenLabsStt.ts` | Fal Scribe v2 submit |
| `ensureFullAudio.ts` | Cached full FLAC for auto-detect |
| `flacSourceUrl.ts` | Invalidate FLAC if the video URL changed |
| `normalizeElevenLabsTranscript.ts` | Scribe words → session transcript shape |
| `manimGuard.ts` | `MAX_VISIBLE=6` + VisibleTracker |
| `manimOrientation.ts` | Square frame + render argv |
| `manimScriptPath.ts` | Default `manim_scripts/{class}.py` |
| `sessionManimClips.ts` | List rendered clips from assets |
| `remuxMp4Faststart.ts` | `ffmpeg -movflags +faststart` |
| `ownedEditFiles.ts` | Shell-edit ban |
| `hfProjectSync.ts` | Push HTML edits to Storage |
| `strReplaceDecode.ts` | `\n` unescape for `str_replace` |
| `orientationGuard.ts` | HTML canvas vs orientation; manim fit notes |
| `renderSnapshot.ts` | Draft metadata ↔ restore recipe |
| `scaffoldInputDiff.ts` | Skip re-download of unchanged media |
| `resolveCompositionDuration.ts` | Timeline length from words vs media probe |
| `*.selfcheck.ts` | Assert-based regression (not loaded at request time) |

`pipeline/transcriptionLanguage.selfcheck.ts` sits next to transcribe for the same reason.

---

## What each tool is *not*

| Tool | Common misuse the code tries to stop |
|---|---|
| `run_command` | Rewriting `index.html` with sed; reading env secrets; calling rembg |
| `ask_clarification` | Re-asking language/orientation/brand after Video preferences |
| `transcribe_video` | Polling `transcript.json` while Fal is still queued |
| `extract_concepts` | Passing the transcript in the tool args (it reads the file) |
| `generate_manim_script` | Regenerating after a render fail instead of patching |
| `plan_segments` | Inventing Mode B (removed); skipping it before scaffold |
| `scaffold_hf_project` | Invented clip URLs; scaffolding while `renderStatus=RUNNING` |
| `render_hyperframes` | Local `npx hyperframes render`; pasting a player URL in chat |
| `image_generate` / `video_generate` | Returning a made-up CDN URL before the webhook |

---

## Size / complexity (where the weight is)

| File | Lines | Why it is large |
|---|---|---|
| `pipeline/hyperframes.ts` | 1,266 | Scaffold + restore + zip + HeyGen/Lambda submit |
| `pipeline/transcribe.ts` | 1,023 | Two STT engines, chunk resume, Ask-Me failure UI |
| `lib/utils.ts` | 1,012 | Shared kernel: FS, HTML builders, captions, OpenRouter |
| `pipeline/manim.ts` | 460 | Script gen + local render |
| `general/mediaModelRegistry.ts` | 458 | Fal vendor mapping |
| `general/filesystem.ts` | 403 | Five base FS tools + guards |
| `pipeline/concepts.ts` | 266 | Extract + snap + Ask-Me gate |

The 11 base tools are small. Almost all of the harness’s product behaviour is the 8 pipeline tools plus `utils.ts`.

If you want this as a live canvas beside the chat, switch to Agent mode and ask; Ask mode can only report.