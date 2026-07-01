# Logo Reveal Example

Full HyperFrames composition (1920×1080, 3s) with an SVG asset demonstrating:
- Asset loading from `assets/` directory
- GSAP timeline with complex animations
- Proper data attributes on root and clip elements
- Timeline registration on `window.__timelines`

## Files

- `index.html` - Main composition with logo reveal animation
- `meta.json` - Project metadata (validated by render API)
- `hyperframes.json` - HyperFrames paths configuration
- `assets/logo.svg` - SVG logo asset (referenced in HTML)
- `assets/gsap.min.js` - GSAP v3.12.5 (bundled; no CDN at render time)

## Testing

From the `examples/logo-reveal` directory:

```bash
# Using the service API
cd ../../
npm start  # In another terminal

curl -X POST "http://localhost:3030/render?quality=draft" \
  -F "index.html=@examples/logo-reveal/index.html" \
  -F "meta.json=@examples/logo-reveal/meta.json" \
  -F "hyperframes.json=@examples/logo-reveal/hyperframes.json" \
  -F "assets/logo.svg=@examples/logo-reveal/assets/logo.svg" \
  -F "assets/gsap.min.js=@examples/logo-reveal/assets/gsap.min.js"
```

## Animation Timeline

- **0.0-0.8s**: Logo scales in with rotation and back easing
- **0.5-1.1s**: Title fades in from below
- **0.8-1.3s**: Subtitle fades in
- **1.2-3.0s**: Logo floats gently (sine wave)

## Asset Loading

The `src="assets/logo.svg"` path is resolved relative to the project root. The HyperFrames CLI captures this asset during render.
