# Talking-head design index

Mix any **style** with any **layout** (except the social / stack rules below). Geometry
lives in `layouts.json`; card seeds live in `styles/`. Aspect ratios supported:
**16:9** (`horizontal`) and **9:16** (`vertical`) only — no 4:5.

## Styles (`styles/`)

| File | Label | Upstream seed |
|------|-------|---------------|
| `academic.html` | Academic | academic |
| `editorial.html` | Editorial | editorial |
| `minimal.html` | Minimal | minimal |
| `corporate.html` | Corporate | swiss |
| `technical.html` | Technical | terminal |
| `whiteboard.html` | Whiteboard | whiteboard |
| `social.html` | Social | xhs |

Each seed is English-localized preview HTML. Header comments keep token /
“Best with” layout hints. Only `technical.html` may use `@keyframes`
(blinking cursor). Motion: `data-anim-*` only — see `motion-catalog.md`.

## Layouts (`layouts.json`)

| Key | Zone | Notes |
|-----|------|-------|
| `split` | side-panel | Card + video side by side — **16:9 default** for non-social |
| `stack` | lower-third | **Cards top, speaker bottom.** Social style only (scaffold coerces stack → split otherwise) |
| `pip` | fullscreen | Full card; video as pip-pill chrome (dense motion / lists / diagrams) |
| `overlay` | video-overlay | Card and video share full frame. Scaffold applies persistent video blur + glass `.root` |

**Social** may only use `stack` or `overlay` (other keys coerce to `overlay`).
**Non-social** never uses `stack`.

Choose **one layout per card**, not per video. Change layout when the card’s job
changes; consecutive cards with the same job keep the previous layout. No mix
quota — mix by beat, do not default to all-split. Overlay cards that share the
frame with video must keep `.root` glass (scaffold injects this).
