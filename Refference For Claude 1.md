**Verdict:** `Skills/hyperframes` is a HeyGen Cursor/Claude-Code skill pack (591 files, ~126k lines, excluding `graphify-out`). Nia can *read* it. Nia cannot *run* it as written. The harness already uses HyperFrames as the **edu-video assembly/render layer** (`scaffold_hf_project` + `render_hyperframes`), not as this pack’s “make any video from HTML” product.

The pack is Cursor-native: `/skill-name` picker, `npx hyperframes` local loop, parallel subagents, Studio preview, Whisper, headless Chrome. The OkVevo harness is a Docker Express worker with **no Chromium**, a 130k-token hard cap, and extra tools only for `edu-video`, `manim-video`, and `hyperframes`.

---

## What “compatible with our harness” means

Nia loads skills like this:

1. `resolveSkill(skillId, message)` looks for `Skills/<skillId>/SKILL.md` (slashes allowed).
2. That whole markdown is **appended to the system prompt**.
3. Extra tools come only from `SKILL_TOOLS` keys: `edu-video`, `manim-video`, `hyperframes`.
4. `isKnownSkill()` **drops any other id** on the next turn, so `hyperframes/talking-head-recut` does not persist.
5. `detectSkill()` only auto-routes `edu-video` and `background-generation`. No HyperFrames workflow triggers.

The agent image has Node, ffmpeg, Manim, and a global `hyperframes` CLI. It **does not** have Chromium (`PUPPETEER_SKIP_DOWNLOAD`, Dockerfile comment: “no Chromium — HeyGen cloud render path”). Local `validate` / `inspect` / `preview` / `capture` / `render` therefore fail. Production render is `render_hyperframes` → zip → HeyGen Cloud or Lambda.

`AGENT.md` also says: if a skill has a dedicated tool, **do not** reinvent the pipeline with `run_command`. These skills *are* bash/`npx` pipelines.

| Harness fact | Effect on this pack |
|---|---|
| Skill dump = entire `SKILL.md` | `talking-head-recut` is 1,191 lines (~15–20k tokens) before any references |
| Session hard cap 130k tokens | Loading one fat skill + references blows the budget |
| `SKILL_TOOLS.hyperframes` = `render_hyperframes` only | No `transcribe`, `init`, `capture`, `scaffold` for these workflows |
| `edu-video` owns `scaffold_hf_project` | Templates are `Skills/edu-video/templates`, not these workflows |
| No subagent tool | Frame-worker fan-out cannot run; degrade to serial inline |
| No Chromium | Capture, Studio, local render, `validate`/`inspect` are dead |
| Transcription = Groq/fal | Not `hyperframes transcribe` / local Whisper |
| Workdir = session `hf-project/` | Skills write `videos/<project>/` at workspace root |

---

## Tree (every directory and file, grouped)

```
Skills/hyperframes/                          19 SKILL.md files + lock + graph
├── SKILL.md                                 ROUTER — intent map for all workflows
├── skills-lock.json                         Upstream hashes from heygen-com/hyperframes
├── graphify-out/                            NOT a skill (693 files, AST cache)
│
├── DOMAIN SKILLS (load-on-demand knowledge)
│   ├── hyperframes-core/                    HTML composition contract
│   ├── hyperframes-cli/                     npx hyperframes command book
│   ├── hyperframes-animation/               GSAP rules, blueprints, adapters
│   ├── hyperframes-creative/                Palettes, frame-presets, house style
│   ├── hyperframes-media/                   TTS / BGM / Whisper / rembg engine
│   ├── hyperframes-registry/                hyperframes add blocks/components
│   └── media-use/                           HeyGen catalog → frozen .media files
│
└── WORKFLOW SKILLS (orchestrators)
    ├── talking-head-recut/                  Graphic overlays on existing footage
    ├── embedded-captions/                   Captions + matte occlusion
    ├── faceless-explainer/                  Topic explainer, invented visuals
    ├── product-launch-video/                Product promo from URL/brief
    ├── website-to-video/                    Site tour via Chrome capture
    ├── pr-to-video/                         GitHub PR → changelog video
    ├── motion-graphics/                     Short unnarrated sting / stat / L3
    ├── music-to-video/                      Beat-synced lyric/kinetic video
    ├── general-video/                       Fallback freeform authoring
    ├── slideshow/                           Interactive deck, not MP4
    └── remotion-to-hyperframes/             Remotion → HF port + SSIM eval
```

---

## Root files

### `SKILL.md` (router) — **partially adapted, not wired**

Intent router for every “make a video” request. Already has an OkVevo note: when it says `/hyperframes-core`, use `read_file` on `Skills/hyperframes/<name>/SKILL.md`.

**Compatible?** Only if the UI sends `skillId: "hyperframes"`. Then Nia gets this 166-line router **plus** `render_hyperframes`. She does **not** get nested workflow tools, and `detectSkill` will never pick this from chat.

**To make compatible**

1. Keep this as the only system-prompt skill (thin router).
2. Add `hyperframes` (and each workflow you actually ship) to `detectSkill` and `SKILL_TOOLS`.
3. Rewrite Cursor paths (`npx skills add`, Studio, subagents) into harness tools: `read_file`, `ask_clarification`, `render_hyperframes`.
4. Never dump child `SKILL.md` files into the system prompt. Point the router at `read_file` of one child at a time.

### `skills-lock.json` — **runtime-redundant, useful for humans**

Pins hashes from `heygen-com/hyperframes`. Nia never reads it. Keep it if you re-sync from upstream; ignore at runtime.

### `graphify-out/` — **not a skill, not for Nia**

693 files (`graph.json`, `GRAPH_REPORT.md`, 688 AST cache files). Same class as other nested graphs: useful for coding agents, unused at request time.

---

## Domain skills (knowledge libraries)

These are meant to be **read on demand**, not dumped into the prompt. That matches how `edu-video` already uses `loadSkillFile('hyperframes/hyperframes-cli/SKILL.md')` inside `render_hyperframes`.

### `hyperframes-core/` — **knowledge-compatible; execution-partial**

**What it does:** The HTML contract: `data-*` timing, `class="clip"`, tracks, sub-compositions, determinism (no `Math.random`, one paused GSAP timeline), media placement.

| Path | Role |
|---|---|
| `SKILL.md` | Contract summary + validation checklist |
| `references/minimal-composition.md` | Smallest renderable skeleton |
| `references/composition-patterns.md` | Monolithic vs modular |
| `references/data-attributes.md` | Every `data-*` |
| `references/tracks-and-clips.md` | `data-track-index`, overlap |
| `references/sub-compositions.md` | Host wiring, `<template>` rules |
| `references/variables-and-media.md` | Variables, `<video>`/`<audio>` |
| `references/determinism-rules.md` | Seek-safe bans + property allowlist |
| `references/full-screen-motion.md` | Full-frame motion |
| `references/storyboard-format.md` | `STORYBOARD.md` schema |
| `references/script-format.md` | `SCRIPT.md` narration |
| `references/subagent-dispatch.md` | Maps DISPATCH to Claude/Codex/OpenClaw/Hermes — **Nia is not listed** |
| `references/tailwind.md` | Tailwind v4 vs Studio v3 |

**Compatible?** As a reference for HTML Nia writes into `hf-project/`, yes. As a “run `npx hyperframes lint/validate/inspect/preview`” checklist, no — no Chromium, and `render_hyperframes` already runs `hyperframes lint --json` then cloud-renders.

**To make compatible:** Teach Nia “lint happens inside `render_hyperframes`; skip preview/Studio; skip subagent table; degrade to serial `write_file`.” Map `subagent-dispatch.md` to: *this harness has no children; do the worker role inline.*

### `hyperframes-cli/` — **partially wired already**

**What it does:** Command book for `npx hyperframes` (init, lint, validate, inspect, preview, render, lambda, doctor, capture, skills).

| Path | Role |
|---|---|
| `SKILL.md` | Dev loop + agent conventions |
| `references/init-and-scaffold.md` | `init`, `capture`, skills refresh |
| `references/lint-validate-inspect.md` | Static + Chrome runtime gates |
| `references/preview-render.md` | Studio + local render |
| `references/doctor-browser.md` | Environment diagnosis |
| `references/lambda.md` | `hyperframes lambda deploy/render` — **conflicts with our own Lambda/HeyGen path** |
| `references/upgrade-info-misc.md` | upgrade, docs, telemetry, TTS CLI |

`render_hyperframes` already loads this SKILL.md for CLI guidance, then ignores most of it and zips for HeyGen/Lambda.

**To make compatible:** Strip or wrap: “In OkVevo, `init`/`preview`/`render`/`lambda deploy` are forbidden. Only `lint` (inside `render_hyperframes`) and cloud submit.” Do not let Nia run `hyperframes lambda deploy` — we already have a stack.

### `hyperframes-animation/` — **knowledge-compatible (best reuse)**

**What it does:** Motion cookbook. GSAP is default; also Lottie, Three.js, Anime.js, CSS, WAAPI, TypeGPU.

| Path | Role |
|---|---|
| `SKILL.md` | Router: rules vs blueprints vs adapters |
| `rules-index.md` + `rules/*.md` (36) | Atomic GSAP recipes (count-up, kinetic slam, logo draw, …) |
| `blueprints-index.md` + `blueprints/*.md` (15) | Multi-phase scene templates |
| `techniques.md` | Broader motion-design |
| `adapters/*.md` (12) | Per-runtime APIs |
| `transitions/` | CSS scene transitions + registry |
| `examples/*.html` | Ground-truth HTML |
| `scripts/animation-map.mjs` | Needs a **browser** to sample `window.__timelines` |

**Compatible?** Recipes and HTML examples: yes, via `read_file`. `animation-map.mjs`: no (needs Chrome). Three.js/TypeGPU/WebGPU: risky on cloud renderer; stick to GSAP.

**To make compatible:** Allow `read_file` of one rule/blueprint per scene. Ban `animation-map.mjs`. Prefer GSAP-only for `render_hyperframes`.

### `hyperframes-creative/` — **knowledge-compatible**

**What it does:** Brand, pacing, palettes, 13 `frame-presets/` (each `FRAME.md` + caption-skin + showcase HTML), house style, typography, narration.

`scripts/extract-audio-data.py` needs local Python audio deps. `contrast-report.mjs` needs rendered frames.

**Compatible?** Presets and markdown: yes. Interactive `design-picker.html`: no UI for it — use `ask_clarification`. Showcase HTML files are huge (~40 KB each); do not ingest them into the prompt.

**To make compatible:** Copy a preset into `hf-project/frame.md` with `write_file`. Ask style via `ask_clarification`. Never `read_file` a `frame-showcase.html`.

### `hyperframes-media/` — **conflicts with existing tools**

**What it does:** One audio engine (`scripts/audio.mjs`): HeyGen TTS → ElevenLabs → Kokoro; BGM retrieve/generate; Whisper; rembg.

**Conflicts**

| Skill wants | Harness already has |
|---|---|
| `hyperframes transcribe` (local Whisper) | `transcribe_video` (Groq / fal Scribe) |
| `npx hyperframes auth login` (browser OAuth) | `HEYGEN_API_KEY` in env |
| `remove-background` | Not in image; AGENT.md forbids rembg via shell |
| Kokoro / MusicGen / Lyria local | Not installed |

**To make compatible:** Adapter layer: “TTS/BGM via HeyGen key already on the process; transcription via `transcribe_video`; never `auth login`; never rembg.” Optionally wrap `scripts/audio.mjs` as a dedicated tool that uses env keys and writes into the session workdir.

### `hyperframes-registry/` — **optional, low priority**

`hyperframes add <block>` from GitHub registry. Useful for motion-graphics catalog blocks. Needs network + CLI. Not required for edu-video.

**To make compatible:** Either bake a few blocks into `Skills/edu-video/templates`, or add a `hf_add_block` tool that runs `hyperframes add` in the session workdir.

### `media-use/` — **not compatible as-is**

Resolves BGM/SFX/images/icons via a **separate `heygen` CLI** (`>= v0.1.6`) and `~/.media/` cache. Docker has neither the binary nor a writable home cache that survives.

**To make compatible:** Reuse `HEYGEN_API_KEY` with a small harness tool that searches HeyGen audio/assets APIs and writes into session storage — or skip and keep using tagged assets / fal image gen.

---

## Workflow skills (the product surface)

Each workflow is a full Cursor pipeline: `npx hyperframes init` → artifacts under `videos/<project>/` → subagents → Studio preview → local render. None of that is how Nia ships video today.

### `talking-head-recut/` — **closest to OkVevo, still not runnable**

**What it does:** Keep the talking-head clip playing; layer timed graphic cards (titles, lower-thirds, data, quotes, PiP) from the transcript. Closest sibling to edu-video Mode C + overlays.

| Path | Role |
|---|---|
| `SKILL.md` (1,191 lines) | Full pipeline + card design system |
| `NOTICE.md` | MIT attribution (adapted from vtake-skills) |
| `assets/vendor/gsap.min.js` | Bundled GSAP |
| `references/DESIGN_INDEX.md` | Style × layout matrix |
| `references/frames/*.html` | Frame chrome (clean/hairline/polaroid) |
| `references/layouts/*.html` | overlay / pip / split / stack |
| `references/styles/*.html` | 10 visual styles |

**Broken vs its own SKILL.md:** it tells the agent to `ls assets/fonts` and stage woff2 files. **There is no `assets/fonts/` directory.** Only `vendor/gsap.min.js`.

**Compatible?** No as a dumped skill (token bomb + Whisper + local render + `AskUserQuestion`). Knowledge and HTML templates: yes.

**To make compatible**

1. Split SKILL.md: thin orchestrator (~80 lines) + `references/` loaded via `read_file`.
2. Register `talking-head-recut` in `SKILL_TOOLS` with `transcribe_video` + `render_hyperframes` (no Manim required).
3. Map `AskUserQuestion` → `ask_clarification`.
4. Transcribe with `transcribe_video`, not Whisper.
5. Write composition into session `hf-project/`, not `videos/`.
6. Restore fonts or stop claiming they exist.
7. Render via `render_hyperframes`.

This is the **highest-value** workflow to port if you want something other than edu-video.

### `embedded-captions/` — **incompatible without new tools + Chromium/matte**

**What it does:** Captions on talking-head footage with subject occlusion (RVM/rembg matte). 17 identities, 28 theme JSONs, 21 compiler scripts. `make-theme.cjs` alone is 8,781 lines.

Needs: Whisper, background-removal, frame extraction, Chrome for `preview-frames.cjs`, ffmpeg overlay. AGENT.md explicitly forbids reinventing this with rembg/OpenCV.

**To make compatible:** A dedicated `caption_matte` tool (or skip cinematic occlusion and do karaoke the way edu-video already does). Do not dump this skill into the prompt.

### `faceless-explainer/` / `product-launch-video/` / `pr-to-video/` — **same architecture, three inputs**

Shared pattern: Step 0 `hyperframes init` → design preset → STORYBOARD → `scripts/audio.mjs` → **one subagent per frame** → `assemble-index.mjs` → local render.

| Skill | Input | Extra deps |
|---|---|---|
| `faceless-explainer` | Topic/text, invented visuals | audio engine, frame-worker |
| `product-launch-video` | URL/brief + `hyperframes capture` | **headless Chrome** |
| `pr-to-video` | GitHub PR | **`gh` CLI**, avatar fetch |

Scripts (`assemble-index.mjs`, `build-frame.mjs`, `captions.mjs`, `stage-assets.mjs`) are Node and *could* run via `run_command` in the container. The blockers are: Chrome capture, `gh`, subagents, Studio, local render, and `npx hyperframes init` mutating global skills from GitHub inside the image.

**To make compatible (if you want these products)**

1. One harness skill per workflow, thin SKILL.md.
2. Replace `init` with a `scaffold_blank_hf_project` tool (or reuse `scaffold_hf_project` with a blank template).
3. Replace capture with `web_extract` + `vision_analyze` (lossy vs Chrome screenshots).
4. Replace `gh` with a `fetch_pr` tool or require the user to paste the diff.
5. No subagents: Nia writes each `compositions/frames/NN.html` serially (or you add a real child-agent runtime).
6. Always end at `render_hyperframes`.

**Product-fit note:** OkVevo’s persona is teachers + lecture recordings. These three are marketing/dev tools. Porting them is a product decision, not a plumbing one.

### `website-to-video/` — **incompatible (Chrome capture is the product)**

Step 0 is `npx hyperframes capture` (headless Chrome screenshots + brand tokens). No Chromium in the image. `web_extract` is not a substitute.

**To make compatible:** Add a capture Lambda/sidecar with Chrome, or drop this workflow.

### `motion-graphics/` — **knowledge-partial; runtime-incompatible**

Short unnarrated stings. Dispatches Director/Builder/Finalize **subagents**. Categories: kinetic-type, stat, charts, logo-reveal, lower-thirds, maps, news, tweet, webpage, asset-fusion.

`catalog-map.md` + `categories/*/module.md` are useful if Nia authors a lower-third. Subagent + `hyperframes add` + local render are not.

### `music-to-video/` — **incompatible (librosa + no narration product)**

`analyze-beatgrid.py` needs `librosa`/`numpy`/`soundfile` (not in the image). Then frame-workers + beat-synced templates. OkVevo is narrated lecture video, not lyric videos.

### `general-video/` — **knowledge-compatible as a fallback authoring guide**

Single `SKILL.md`, no scripts. “Layout before animation” + route into domain skills. Usable if the router is loaded and Nia `read_file`s creative/core/animation. Still assumes `npx hyperframes lint/validate/inspect/preview`.

### `slideshow/` — **wrong deliverable**

Output is a **navigable deck** (`hyperframes present`), not an MP4. OkVevo’s player is a rendered video. 544-line SKILL.md + 1,020-line standalone-harness. Skip unless you want in-app decks.

### `remotion-to-hyperframes/` — **out of scope**

Ports Remotion React → HF HTML, then SSIM-diffs two renders. Needs Remotion, Chrome, and a test corpus. Not an OkVevo user journey.

---

## Compatibility scoreboard

| Item | What it is | Loadable today? | Runnable in Nia? | Product-fit | Effort to make compatible |
|---|---|---|---|---|---|
| `SKILL.md` router | Intent map | Yes, if `skillId=hyperframes` | Router only | High as a switchboard | Small wrap |
| `hyperframes-cli` | CLI book | Loaded inside `render_hyperframes` | Lint only | High | Rewrite “render = our tool” |
| `hyperframes-core` | HTML contract | Via `read_file` | Author HTML yes | High | Prompt mapping |
| `hyperframes-animation` | Motion recipes | Via `read_file` | GSAP yes | High | Don’t dump indexes |
| `hyperframes-creative` | Presets/palettes | Via `read_file` | Copy preset yes | Medium | `ask_clarification` for picker |
| `hyperframes-media` | TTS/Whisper/rembg | No | Conflicts with Groq/fal | Overlap | Adapter or ignore |
| `hyperframes-registry` | `hf add` | No | CLI maybe | Low | Optional tool |
| `media-use` | HeyGen catalog CLI | No | Missing `heygen` binary | Low | New tool or skip |
| `talking-head-recut` | Overlay packaging | Dump would blow tokens | No | **Highest** after edu-video | Split skill + wire tools |
| `embedded-captions` | Matte captions | Token bomb | No (rembg/Chrome) | Overlaps karaoke | New matte tool or skip |
| `faceless-explainer` | Topic video | No | Partial scripts | Low vs teachers | Full workflow port |
| `product-launch-video` | Promo from URL | No | No Chrome | Low | Capture sidecar |
| `website-to-video` | Site tour | No | No Chrome | Low | Capture sidecar |
| `pr-to-video` | PR explainer | No | No `gh` | None | Skip |
| `motion-graphics` | Short sting | No | No subagents | Medium (L3s) | Serial authoring |
| `music-to-video` | Beat-sync | No | No librosa | None | Skip |
| `general-video` | Freeform | Thin enough to dump | Author-only | Medium | Map CLI → our render |
| `slideshow` | Interactive deck | Token bomb | Wrong output | None | Skip |
| `remotion-to-hyperframes` | Framework port | No | No | None | Skip |
| `graphify-out` | Code graph | N/A | N/A | Dev-only | Leave it |

---

## How to make the pack compatible (one plan, fewest files)

Do not install these as 19 separate `SKILL_TOOLS` entries and dump each `SKILL.md`. That fights the session cap and AGENT.md.

**Layer 1 — already done (keep)**  
edu-video: transcribe → concepts → Manim → `scaffold_hf_project` → `render_hyperframes`. HyperFrames stays the compositor.

**Layer 2 — make the router safe (small)**

1. Treat `Skills/hyperframes/SKILL.md` as the only auto-loaded HyperFrames prompt.
2. Add `hyperframes` to `detectSkill` for explicit `/hyperframes` (not for every “video” — that would steal edu-video).
3. Fix persistence: `isKnownSkill` must accept nested ids you care about, or persist `skillsUsed: ['hyperframes']` while routing internally.
4. Rewrite the router’s “if not installed, tell user to `npx skills add`” — in Docker they *are* on disk.
5. Add a 20-line **OkVevo adapter** at the top: workdir = session `hf-project`; render = `render_hyperframes`; transcribe = `transcribe_video`; no Studio; no subagents; `ask_clarification` not `AskUserQuestion`; `read_file` one reference at a time.

**Layer 3 — port at most one new workflow: talking-head-recut**

Closest to the product (existing teacher clip + graphics). Needs:

- Thin `Skills/talking-head-recut/SKILL.md` or keep it nested and load on demand.
- `SKILL_TOOLS['talking-head-recut'] = ['transcribe_video', 'render_hyperframes']` (plus base file tools).
- Path rewrite `videos/` → session workdir.
- Fonts: add them or delete the `ls fonts` step.
- Card HTML templates already in `references/` — Nia copies via `read_file`/`write_file`.

**Layer 4 — do not port without new infrastructure**

| Need | Workflows blocked |
|---|---|
| Chromium sidecar | website-to-video, product-launch capture, inspect/preview, remotion eval |
| Matte / rembg tool | embedded-captions cinematic |
| Subagent runtime | All shot-sequence workflows (PLV, faceless, PR, music, motion-graphics) |
| `gh` | pr-to-video |
| librosa | music-to-video |
| `heygen` CLI | media-use |

**Layer 5 — reuse as libraries, not as skills**

Even without new workflows, Nia can `read_file`:

- `hyperframes-core/references/data-attributes.md` when editing `hf-project/index.html`
- one `hyperframes-animation/rules/*.md` when adding motion
- one `hyperframes-creative/frame-presets/<name>/FRAME.md` for brand

`run_command` description already allows HyperFrames CLI; the missing piece is a **policy** in the system prompt: “CLI is for `lint` inside `render_hyperframes` only.”

---

## What the harness already uses from this tree

```
Skills/hyperframes/hyperframes-cli/SKILL.md
    ↑ loadSkillFile() inside render_hyperframes (guidance only)
Skills/edu-video/templates/* 
    ↑ actual HTML Nia scaffolds (not this pack’s workflows)
@hyperframes/aws-lambda + HEYGEN cloud
    ↑ real render backend (not npx hyperframes render)
```

There is **no graphify path** from `Skills/hyperframes` into `services/agent` except that CLI file load. The rest of the 591 files are unused at runtime.

---

## Practical recommendation

Ship **edu-video as-is**. Treat `Skills/hyperframes` as a **reference library**, not 19 products. If you want a second skill, port **talking-head-recut** with a thin SKILL.md and existing tools. Leave capture/matte/Remotion/slideshow/music/PR on disk until you add Chromium, a matte tool, or a subagent runtime.

I’m in Ask mode, so this is the report only. If you want this as a live [canvas](https://cursor.com/docs/features/canvas) beside the chat, or a first adapter patch (router + `detectSkill` + talking-head-recut split), switch to Agent mode and say which layer to implement.