---

## name: talking-head

description: >
  Package an existing talking-head / interview / podcast video with timed graphic
  overlay cards (titles, side panels, PiP, overlays) synced to the transcript.
  Use when the user asks to dress up a talking-head clip with designed cards.

# Talking-Head — Orchestration Skill

Layers designed **graphic cards** onto a full-length source video. The clip plays
untouched — you design cards from the transcript, then scaffold + render.

**Canvas:** 16:9 (`horizontal`) or 9:16 (`vertical`) only. No 4:5.
Pick canvas from the source probe on the session (else horizontal). Style labels
may show a best-orientation hint — that is informational only, not a user answer.

**Tools available:** `transcribe_video`, `write_file` / `read_file` / `search_files` /
`str_replace`, `ask_clarification`, `scaffold_talking_head_project`, `render_hyperframes`.
**No** `run_command`**.** No CLI, no local Whisper, no Chromium, no `videos/` directory.

## Sequence

1. Prefs are front-loaded (Video preferences batch) — language, card style (+ freeform),
   brand colors. Do **not** ask language, style, palette, orientation, layout, or density.
2. `transcribe_video` on the tagged speaker video.
3. Resolve style: if session `talkingHeadStyle` is a seed id, read that seed; if `custom`,
   pick the **nearest of the 7 seeds** by keyword/tone, then apply `talkingHeadStyleBrief`
   as token-level adjustments (colors, accent, density) only — not open CSS authorship.
   Same contract as seeded styles: scoped CSS, no external URLs, no `<script>`.
   Apply session brand colors. Write `storyboard.json` + `cards/card-XX.html`.
4. **Ask-Me only:** `ask_clarification` with `kind: phase_gate`,
   `phase_label: "Storyboard ready"`, bullets = card titles/kickers from storyboard,
   `allowFreeform: true` for edits. Scaffold only after Continue (or after applying edits
   and re-gating once). This gate is the render-cost guardrail.
5. Auto-Run: skip the storyboard gate → `scaffold_talking_head_project` → `render_hyperframes`.

## Never ask

Never ask orientation, layout, or density as separate questions. Orientation appears
only as label hints on style choices in the front-loaded batch. Choose layout/density
internally from the transcript + style seed “Best with” hints.

## Freeform custom style

When the user describes a custom style: nearest of 7 seeds first, then token adjust.
Persist conceptually as seed + brief. Do not invent a new design system from scratch.

## References (read on demand — do not dump into the prompt)

- Layouts + pixel bounds: `Skills/talking-head/references/layouts.json`
- Style seeds: `Skills/talking-head/references/styles/{academic,editorial,minimal,corporate,technical,whiteboard,social}.html`
- Mix guide: `Skills/talking-head/references/DESIGN_INDEX.md`

Use `read_file` / `search_files` to load what you need.

## Layouts (defaults, not a whitelist — internal only; never show in checkpoints)


| layout    | zone            | use                         |
| --------- | --------------- | --------------------------- |
| `split`   | `side-panel`    | speaker + data side-by-side |
| `stack`   | `lower-third`   | video top, card below       |
| `pip`     | `fullscreen`    | card fills, video PiP pill  |
| `overlay` | `video-overlay` | full-bleed video + glass    |


Each style’s “Best with: layouts” list is a **suggestion** Nia prefers — all four
layouts work in both orientations.

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
tokens. Do **not** use `hyperframes-registry` or any `hyperframes add` CLI —
`run_command` is unavailable.

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

## Ask-Me

Front-loaded prefs replace chat questions for language/style/palette. After storyboard
cards are written, gate with **Storyboard ready** before scaffold/render. After resume,
call the next tool before status text.

Attribution: see `Skills/talking-head/NOTICE.md` (MIT, adapted from vtake-skills).
