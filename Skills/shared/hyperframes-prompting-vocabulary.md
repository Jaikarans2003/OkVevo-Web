# HyperFrames prompting vocabulary

Natural-language words this stack maps to motion, captions, transitions, and audio.
Use them in revision requests. Do not install skills, slash-commands, or `npx skills add`.

On a revision: read this file, then follow the skill's edit playbook.

## Iterate as editor

Treat the current composition as the source of truth. Change the smallest thing that matches the request, then re-render. Do not restart the pipeline from transcription unless the user asked for a new video from scratch.

1. Read the skill playbook (`metadata.editTargets`).
2. Read the files it names (not files you invent).
3. Patch or rewrite only those artifacts.
4. Re-gate / re-scaffold / re-render with that skill's tools.

## Motion & easing

| Say this | Agent uses    | Feels like              |
| -------- | ------------- | ----------------------- |
| smooth   | `power2.out`  | Natural deceleration    |
| snappy   | `power4.out`  | Quick and decisive      |
| bouncy   | `back.out`    | Overshoots then settles |
| springy  | `elastic.out` | Oscillates into place   |
| dramatic | `expo.out`    | Fast start, long glide  |
| dreamy   | `sine.inOut`  | Slow, symmetrical       |

Timing shorthand: fast (0.2s) = energy, medium (0.4s) = professional, slow (0.6s) = luxury, very slow (1–2s) = cinematic.

## Camera language

| Say this          | Agent builds                                        |
| ----------------- | --------------------------------------------------- |
| slow push-in      | 4–8% scale increase across the scene, gentle ease   |
| pull back / widen | scale decrease, often paired with elements entering |
| pan across        | horizontal translate of the scene layer             |
| drone orbit       | continuous camera orbit (Three.js scenes)           |
| crane down/up     | vertical camera drift combined with a look-at shift |
| whip to           | fast blurred slide into the next framing            |
| parallax          | layers translating at different rates for depth     |

## Depth language

| Say this                     | Agent builds                                             |
| ---------------------------- | -------------------------------------------------------- |
| near-lens / foreground bokeh | large, heavily-blurred elements drifting close to camera |
| depth planes                 | 2–3 layers moving at different speeds                    |
| out-of-focus background      | blurred, slower-moving back layer                        |
| shallow depth of field       | sharp subject, blurred everything-else                   |

## Pacing language

| Say this        | Agent builds                                      |
| --------------- | ------------------------------------------------- |
| punchy cuts     | 1.5–4s per idea, hard cuts, overlapping entrances |
| cinematic holds | longer beats with ambient idle motion             |
| beat-synced     | cuts and accents on the music's beat grid         |
| breathing room  | a held moment before the next beat starts         |
| ambient idle    | 1–2% breathing scale + slow drift during holds    |

## Caption tones

| Tone         | Typography         | Animation    | Size range |
| ------------ | ------------------ | ------------ | ---------- |
| Hype         | Heavy weight fonts | Scale-pop    | 72–96px    |
| Corporate    | Clean sans-serif   | Fade + slide | 56–72px    |
| Tutorial     | Monospace          | Typewriter   | 48–64px    |
| Storytelling | Serif              | Slow fade    | 44–56px    |
| Social       | Rounded, playful   | Bounce       | 56–80px    |

Examples: "Hype-style captions with scale-pop". Per-word: "Make brand names larger with accent color".

## Transitions

| Energy | CSS option     | Shader option       |
| ------ | -------------- | ------------------- |
| Calm   | Blur crossfade | Cross-warp morph    |
| Medium | Push slide     | Whip pan            |
| High   | Zoom through   | Glitch, ridged burn |

Mood: "Warm transitions for this wellness brand", "Playful bouncy transitions".

## Audio-reactive animation

| Audio band | Maps to   | Visual effect     |
| ---------- | --------- | ----------------- |
| Bass       | `scale`   | Pulse on the beat |
| Treble     | `glow`    | Shimmer intensity |
| Amplitude  | `opacity` | Breathing         |
| Mids       | `shape`   | Morphing          |

Keep text effects subtle (3–6% intensity). Backgrounds can go larger (10–30%).

## Marker highlights

| Mode        | Effect             | Best for     |
| ----------- | ------------------ | ------------ |
| `highlight` | Marker sweep       | Key phrases  |
| `circle`    | Hand-drawn ellipse | Single words |
| `burst`     | Radiating lines    | Hype moments |
| `scribble`  | Chaotic scratch    | Crossing out |
| `sketchout` | Rectangle outline  | Callouts     |
