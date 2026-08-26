---
name: talking-head
description: >
  Package an existing talking-head / interview / podcast video with timed graphic
  overlay cards (titles, side panels, PiP, overlays) synced to the transcript.
  Use when the user asks to dress up a talking-head clip with designed cards.
allowed-tools:
  - run_command
  - write_file
  - read_file
  - search_files
  - web_search
  - web_extract
  - vision_analyze
  - str_replace
  - ask_clarification
  - image_generate
  - video_generate
  - transcribe_video
  - scaffold_talking_head_project
  - render_hyperframes
metadata:
  editGuidance: ../shared/hyperframes-prompting-vocabulary.md
  editTargets: references/edit-requests.md
---

# Talking-Head — Orchestration Skill

Layers designed **graphic cards** onto a full-length source video. The clip plays
untouched — you design cards from the transcript, then scaffold + render.

**Canvas:** 16:9 (`horizontal`) or 9:16 (`vertical`) only. No 4:5.
Infer orientation from the source aspect ratio. Ask only when the source is
ambiguous **or** the user request conflicts (e.g. social / vertical style on a
clearly horizontal source). Style “Best with” hints are informational, not a
user answer.

**Tools available:** `transcribe_video`, `write_file` / `read_file` / `search_files` /
`str_replace`, `ask_clarification`, `scaffold_talking_head_project`, `render_hyperframes`.
`run_command` is visible but no binaries are allowed — do not shell out. No CLI, no local Whisper, no Chromium, no `videos/` directory.

## Sequence

1. Ask-Me prefs (see Ask-Me below) — then `transcribe_video` on the tagged speaker video.
2. Resolve style: if session `talkingHeadStyle` is a seed id, read that seed; if `custom`,
   pick the **nearest of the 7 seeds** by keyword/tone, then apply `talkingHeadStyleBrief`
   as token-level adjustments (colors, accent, density) only — not open CSS authorship.
   Same contract as seeded styles: scoped CSS, no external URLs, no `<script>`.
   Apply session brand colors. Write `storyboard.json` + `cards/card-XX.html`.
3. **Ask-Me only:** `ask_clarification` with `kind: phase_gate`,
   `phase_label: "Storyboard ready"`, `question` = one line
   (`"5 cards ready. Approve or describe edits."`), `bullets` = `kicker — title`
   per card (never put the list in `question`), `allowFreeform: true` for edits.
   Scaffold only after Continue (or after applying edits and re-gating once).
   This gate is the render-cost guardrail.
4. Auto-Run: skip prefs and the storyboard gate → `scaffold_talking_head_project` → `render_hyperframes`. Tools use defaults when session fields are unset.

## Never ask

Never ask layout or density as separate questions. Choose them internally from the
transcript + style seed “Best with” hints + `references/motion-catalog.md`.
Do not `str_replace` `hf-project/index.html` — rewrite cards, then re-scaffold.

## Freeform custom style

When the user describes a custom style: nearest of 7 seeds first, then token adjust.
Persist conceptually as seed + brief. Do not invent a new design system from scratch.

## References (read on demand — do not dump into the prompt)

- Layouts + pixel bounds: `Skills/talking-head/references/layouts.json`
- Style seeds: `Skills/talking-head/references/styles/{academic,editorial,minimal,corporate,technical,whiteboard,social}.html`
- Mix guide: `Skills/talking-head/references/DESIGN_INDEX.md`
- Motion catalog: `Skills/talking-head/references/motion-catalog.md`

Use `read_file` / `search_files` to load what you need.

## Layouts (defaults, not a whitelist — internal only; never show in checkpoints)


| layout    | zone            | use                                      |
| --------- | --------------- | ---------------------------------------- |
| `split`   | `side-panel`    | 16:9 default — data / definition beside the face |
| `stack`   | `lower-third`   | **Social only.** Cards top, speaker bottom. Scaffold coerces stack → split for other styles |
| `pip`     | `fullscreen`    | dense motion graphics, lists, diagrams — speaker as pill |
| `overlay` | `video-overlay` | hook / title / mantra / quote (blur + glass — scaffold injects this) |


**Per-card mix** — one layout per card, not per video. Change layout when the card’s
job changes (hook → overlay, definition → split, dense list → pip, social lower-third → stack);
consecutive cards with the same job keep the previous layout. No mix quota — mix by beat,
do not default to all-split. Social style: only `stack` or `overlay`. Non-social: never `stack`.

Each style’s “Best with: layouts” list is a **suggestion** within those rules. Prefer session
uploaded-asset / GCS copy over expiring Firebase `?token=` links for the speaker.

## Styles

`academic` · `editorial` · `minimal` · `corporate` · `technical` · `whiteboard` · `social`

Copy a seed’s structure/tokens; rewrite content to match the transcript. Keep
scoped CSS, `data-anim-*` choreography, and English copy.

## Card HTML contract

- Scoped `<style>` inside the card; **no** `<script>`; **no external URLs**
- Animations via `data-anim-*` only
- Exception: `technical` seed’s blinking-cursor `@keyframes` (do not invent more CSS animations)
- For `kinetic-chars` titles in English: one `.char` span **per word**, not per letter

## Pace (min 5 cards)

```
secPerCard = basePace × densityMultiplier
cardCount  = max(5, round(videoDurationSec / secPerCard))
```

Base pace by duration: <60s → 6–8s; 60s–3m → 8–12s; 3–10m → 12–20s; 10–30m → 20–35s; >30m → 30–60s.
Density: high ×0.7 · medium ×1.0 · low ×1.5. Choose density internally — never ask.

## Animation fallback

Each style ships a small default `data-anim` vocabulary. If the user needs a motion
kind not already used by the active style, `read_file`
`Skills/hyperframes/hyperframes-animation/rules-index.md` first, then the
`rules/<name>.md` it names. Keep new elements inside the active style’s color/font
tokens. Do **not** use `hyperframes-registry` or any `hyperframes add` CLI.

## Storyboard shape

```json
{
  "layout": "split",
  "durationSeconds": 121.2,
  "cards": [
    {
      "id": "card-01",
      "startSec": 1.0,
      "endSec": 7.5,
      "zone": "side-panel",
      "layout": "split",
      "contentHints": { "kicker": "...", "title": "...", "detail": "..." }
    }
  ]
}
```

Write each card to `cards/<id>.html`. Scaffold reads these from disk.
Optional `card.transition`: `"cut"` | `"fade"`. Default is a cut between abutting
same-layout cards; layout changes tween the speaker wrap with motion blur.

## Repair

If the user says the last MP4 is the wrong skill (looks like edu-video, leftover
composition, etc.): call `scaffold_talking_head_project` on the **original tagged
speaker upload**, never `str_replace` an edu `index.html`, and never use
`final*.mp4` / `{skillId}*.mp4` as the speaker.

## Ask-Me (pipelineMode=ask)

Before expensive tools, ask missing prefs with `ask_clarification` —
one question per call (never combine language + orientation + brand + style).

Order:
1. language
2. card style (+ freeform)
3. brand colors
4. orientation ONLY if source is ambiguous or conflicts with style/request

Never ask layout or density.
Then transcribe → storyboard gate → scaffold → render.

Also ask any other blocking doubt.
Auto-Run: do not ask prefs; tools use defaults when session fields unset.
Mid-session “actually make it vertical” is allowed — ask orientation again and overwrite.

After storyboard cards are written, gate with **Storyboard ready** before scaffold/render.
After resume, call the next tool before status text.

Attribution: see `Skills/talking-head/NOTICE.md` (MIT, adapted from vtake-skills).
