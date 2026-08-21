# Talking-head design index

Mix any **style** with any **layout**. Geometry lives in `layouts.json`; card
seeds live in `styles/`. Aspect ratios supported: **16:9** (`horizontal`) and
**9:16** (`vertical`) only — no 4:5.

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
(blinking cursor).

## Layouts (`layouts.json`)

| Key | Zone | Notes |
|-----|------|-------|
| `split` | side-panel | Card + video side by side (or stacked in 9:16) |
| `stack` | lower-third | Video above, card below |
| `pip` | fullscreen | Full card; video as pip-pill chrome |
| `overlay` | video-overlay | Card and video share full frame |

Suggested pairings are defaults only — agents may mix freely.
