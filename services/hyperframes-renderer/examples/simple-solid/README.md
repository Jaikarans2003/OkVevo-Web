# Example: simple-solid

Minimal vertical composition (1080×1920, 2s) with a single `clip` and GSAP timeline registered on `window.__timelines["simple-solid"]`.

GSAP is **vendored** as `assets/gsap.min.js` (v3.12.5) so Docker/ECS renders do not depend on CDN availability.

## Files

- `index.html` — root composition
- `meta.json` — project metadata (validated by the render API)
- `hyperframes.json` — HyperFrames paths (optional on POST; the service writes a default if omitted)
- `assets/` — `gsap.min.js` (bundled)
