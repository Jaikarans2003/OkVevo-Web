# Skills/manim-video — Full Directory Inventory

Generated dump of every directory and file under `Skills/manim-video`, including full source/text of each file.

## Summary

- Root: `Skills/manim-video`
- Directories: 3 (including root)
- Files: 17

## Directory Tree

```
Skills/manim-video/
├── references/
│   ├── animation-design-thinking.md
│   ├── animations.md
│   ├── camera-and-3d.md
│   ├── decorations.md
│   ├── equations.md
│   ├── graphs-and-data.md
│   ├── mobjects.md
│   ├── paper-explainer.md
│   ├── production-quality.md
│   ├── rendering.md
│   ├── scene-planning.md
│   ├── troubleshooting.md
│   ├── updaters-and-trackers.md
│   └── visual-design.md
├── scripts/
│   └── setup.sh
├── README.md
└── SKILL.md
```



## Directory Listing



### Directories

- `Skills/manim-video/`
- `Skills/manim-video/references/`
- `Skills/manim-video/scripts/`



### Files

- `Skills/manim-video/README.md` (886 bytes)
- `Skills/manim-video/SKILL.md` (14,352 bytes)
- `Skills/manim-video/references/animation-design-thinking.md` (7,205 bytes)
- `Skills/manim-video/references/animations.md` (8,836 bytes)
- `Skills/manim-video/references/camera-and-3d.md` (4,132 bytes)
- `Skills/manim-video/references/decorations.md` (5,006 bytes)
- `Skills/manim-video/references/equations.md` (6,086 bytes)
- `Skills/manim-video/references/graphs-and-data.md` (4,628 bytes)
- `Skills/manim-video/references/mobjects.md` (9,739 bytes)
- `Skills/manim-video/references/paper-explainer.md` (9,333 bytes)
- `Skills/manim-video/references/production-quality.md` (5,904 bytes)
- `Skills/manim-video/references/rendering.md` (5,375 bytes)
- `Skills/manim-video/references/scene-planning.md` (2,751 bytes)
- `Skills/manim-video/references/troubleshooting.md` (5,030 bytes)
- `Skills/manim-video/references/updaters-and-trackers.md` (8,500 bytes)
- `Skills/manim-video/references/visual-design.md` (4,762 bytes)
- `Skills/manim-video/scripts/setup.sh` (921 bytes)

---



## File Contents



### `Skills/manim-video/README.md`

```markdown
# Manim Video Skill

Production pipeline for mathematical and technical animations using [Manim Community Edition](https://www.manim.community/).

## What it does

Creates 3Blue1Brown-style animated videos from text prompts. The agent handles the full pipeline: creative planning, Python code generation, rendering, scene stitching, and iterative refinement.

## Use cases

- **Concept explainers** — "Explain how neural networks learn"
- **Equation derivations** — "Animate the proof of the Pythagorean theorem"
- **Algorithm visualizations** — "Show how quicksort works step by step"
- **Data stories** — "Animate our before/after performance metrics"
- **Architecture diagrams** — "Show our microservice architecture building up"

## Prerequisites

Python 3.10+, Manim CE (`pip install manim`), LaTeX, ffmpeg.

``​`bash
bash skills/creative/manim-video/scripts/setup.sh
``​`
```



### `Skills/manim-video/SKILL.md`

```markdown
---

## name: manim-video

description: "Production pipeline for mathematical and technical animations using Manim Community Edition. Creates 3Blue1Brown-style explainer videos, algorithm visualizations, equation derivations, architecture diagrams, and data stories. Use when users request: animated explanations, math animations, concept visualizations, algorithm walkthroughs, technical explainers, 3Blue1Brown style videos, or any programmatic animation with geometric/mathematical content."
version: 1.0.0

# Manim Video Production Pipeline

## Creative Standard

This is educational cinema. Every frame teaches. Every animation reveals structure.

**Before writing a single line of code**, articulate the narrative arc. What misconception does this correct? What is the "aha moment"? What visual story takes the viewer from confusion to understanding? The user's prompt is a starting point — interpret it with pedagogical ambition.

**Geometry before algebra.** Show the shape first, the equation second. Visual memory encodes faster than symbolic memory. When the viewer sees the geometric pattern before the formula, the equation feels earned.

**First-render excellence is non-negotiable.** The output must be visually clear and aesthetically cohesive without revision rounds. If something looks cluttered, poorly timed, or like "AI-generated slides," it is wrong.

**Opacity layering directs attention.** Never show everything at full brightness. Primary elements at 1.0, contextual elements at 0.4, structural elements (axes, grids) at 0.15. The brain processes visual salience in layers.

**Breathing room.** Every animation needs `self.wait()` after it. The viewer needs time to absorb what just appeared. Never rush from one animation to the next. A 2-second pause after a key reveal is never wasted.

**Cohesive visual language.** All scenes share a color palette, consistent typography sizing, matching animation speeds. A technically correct video where every scene uses random different colors is an aesthetic failure.

## Prerequisites

Run `scripts/setup.sh` to verify all dependencies. Requires: Python 3.10+, Manim Community Edition v0.20+ (`pip install manim`), LaTeX (`texlive-full` on Linux, `mactex` on macOS), and ffmpeg. Reference docs tested against Manim CE v0.20.1.

## Modes


| Mode                        | Input                 | Output                                                 | Reference                       |
| --------------------------- | --------------------- | ------------------------------------------------------ | ------------------------------- |
| **Concept explainer**       | Topic/concept         | Animated explanation with geometric intuition          | `references/scene-planning.md`  |
| **Equation derivation**     | Math expressions      | Step-by-step animated proof                            | `references/equations.md`       |
| **Algorithm visualization** | Algorithm description | Step-by-step execution with data structures            | `references/graphs-and-data.md` |
| **Data story**              | Data/metrics          | Animated charts, comparisons, counters                 | `references/graphs-and-data.md` |
| **Architecture diagram**    | System description    | Components building up with connections                | `references/mobjects.md`        |
| **Paper explainer**         | Research paper        | Key findings and methods animated                      | `references/scene-planning.md`  |
| **3D visualization**        | 3D concept            | Rotating surfaces, parametric curves, spatial geometry | `references/camera-and-3d.md`   |




## Stack

Single Python script per project. No browser, no Node.js, no GPU required.


| Layer     | Tool                              | Purpose                                          |
| --------- | --------------------------------- | ------------------------------------------------ |
| Core      | Manim Community Edition           | Scene rendering, animation engine                |
| Math      | LaTeX (texlive/MiKTeX)            | Equation rendering via `MathTex`                 |
| Video I/O | ffmpeg                            | Scene stitching, format conversion, audio muxing |
| TTS       | ElevenLabs / Qwen3-TTS (optional) | Narration voiceover                              |




## Pipeline

``​`
PLAN --> CODE --> RENDER --> STITCH --> AUDIO (optional) --> REVIEW
``​`

1. **PLAN** — Write `plan.md` with narrative arc, scene list, visual elements, color palette, voiceover script
2. **CODE** — Write `script.py` with one class per scene, each independently renderable
3. **RENDER** — `manim -ql script.py Scene1 Scene2 ...` for draft, `-qh` for production
4. **STITCH** — ffmpeg concat of scene clips into `final.mp4`
5. **AUDIO** (optional) — Add voiceover and/or background music via ffmpeg. See `references/rendering.md`
6. **REVIEW** — Render preview stills, verify against plan, adjust



### Edu-video integration

When used inside the edu-video pipeline, each concept gets one `generate_manim_script` call. Colors come from `brand_colors` (or edu-video template defaults: bg `#0a0a0a`, accent `#fb923c`, primary `#f97316`) — not Classic 3B1B. On `render_manim_clip` failure, patch the persisted script via `read_file` + `write_file` and re-render with `script_path` — see `references/troubleshooting.md` (Edu-Video Patch Loop). Full regeneration is the exception, not the default.

## Project Structure

``​`
project-name/
  plan.md                # Narrative arc, scene breakdown
  script.py              # All scenes in one file
  concat.txt             # ffmpeg scene list
  final.mp4              # Stitched output
  media/                 # Auto-generated by Manim
    videos/script/480p15/
``​`



## Creative Direction



### Color Palettes


| Palette           | Background | Primary          | Secondary         | Accent             | Use case              |
| ----------------- | ---------- | ---------------- | ----------------- | ------------------ | --------------------- |
| **Classic 3B1B**  | `#1C1C1C`  | `#58C4DD` (BLUE) | `#83C167` (GREEN) | `#FFFF00` (YELLOW) | General math/CS       |
| **Warm academic** | `#2D2B55`  | `#FF6B6B`        | `#FFD93D`         | `#6BCB77`          | Approachable          |
| **Neon tech**     | `#0A0A0A`  | `#00F5FF`        | `#FF00FF`         | `#39FF14`          | Systems, architecture |
| **Monochrome**    | `#1A1A2E`  | `#EAEAEA`        | `#888888`         | `#FFFFFF`          | Minimalist            |




### Animation Speed


| Context             | run_time | self.wait() after |
| ------------------- | -------- | ----------------- |
| Title/intro appear  | 1.5s     | 1.0s              |
| Key equation reveal | 2.0s     | 2.0s              |
| Transform/morph     | 1.5s     | 1.5s              |
| Supporting label    | 0.8s     | 0.5s              |
| FadeOut cleanup     | 0.5s     | 0.3s              |
| "Aha moment" reveal | 2.5s     | 3.0s              |




### Typography Scale


| Role    | Font size | Usage                          |
| ------- | --------- | ------------------------------ |
| Title   | 48        | Scene titles, opening text     |
| Heading | 36        | Section headers within a scene |
| Body    | 30        | Explanatory text               |
| Label   | 24        | Annotations, axis labels       |
| Caption | 20        | Subtitles, fine print          |




### Fonts

**Use monospace fonts for all text.** Manim's Pango renderer produces broken kerning with proportional fonts at all sizes. See `references/visual-design.md` for full recommendations.

``​`python
MONO = "Menlo"  # define once at top of file

Text("Fourier Series", font_size=48, font=MONO, weight=BOLD)  # titles
Text("n=1: sin(x)", font_size=20, font=MONO)                  # labels
MathTex(r"\nabla L")                                            # math (uses LaTeX)
``​`

Minimum `font_size=18` for readability.

### Per-Scene Variation

Never use identical config for all scenes. For each scene:

- **Different dominant color** from the palette
- **Different layout** — don't always center everything
- **Different animation entry** — vary between Write, FadeIn, GrowFromCenter, Create
- **Different visual weight** — some scenes dense, others sparse



## Workflow



### Step 1: Plan ([plan.md](http://plan.md))

Before any code, write `plan.md`. See `references/scene-planning.md` for the comprehensive template.

### Step 2: Code ([script.py](http://script.py))

One class per scene. Every scene is independently renderable.

``​`python
from manim import *

BG = "#1C1C1C"
PRIMARY = "#58C4DD"
SECONDARY = "#83C167"
ACCENT = "#FFFF00"
MONO = "Menlo"

class Scene1_Introduction(Scene):
    def construct(self):
        self.camera.background_color = BG
        title = Text("Why Does This Work?", font_size=48, color=PRIMARY, weight=BOLD, font=MONO)
        self.add_subcaption("Why does this work?", duration=2)
        self.play(Write(title), run_time=1.5)
        self.wait(1.0)
        self.play(FadeOut(title), run_time=0.5)
``​`

Key patterns:

- **Subtitles** on every animation: `self.add_subcaption("text", duration=N)` or `subcaption="text"` on `self.play()`
- **Shared color constants** at file top for cross-scene consistency
- `**self.camera.background_color`** set in every scene
- **Clean exits** — FadeOut all mobjects at scene end: `self.play(FadeOut(Group(*self.mobjects)))`



### Step 3: Render

``​`bash
manim -ql script.py Scene1_Introduction Scene2_CoreConcept  # draft
manim -qh script.py Scene1_Introduction Scene2_CoreConcept  # production
``​`



### Step 4: Stitch

``​`bash
cat > concat.txt << 'EOF'
file 'media/videos/script/480p15/Scene1_Introduction.mp4'
file 'media/videos/script/480p15/Scene2_CoreConcept.mp4'
EOF
ffmpeg -y -f concat -safe 0 -i concat.txt -c copy final.mp4
``​`



### Step 5: Review

``​`bash
manim -ql --format=png -s script.py Scene2_CoreConcept  # preview still
``​`



## Critical Implementation Notes



### Raw Strings for LaTeX

``​`python
# WRONG: MathTex("\frac{1}{2}")
# RIGHT:
MathTex(r"\frac{1}{2}")
``​`



### buff >= 0.5 for Edge Text

``​`python
label.to_edge(DOWN, buff=0.5)  # never < 0.5
``​`



### FadeOut Before Replacing Text

``​`python
self.play(ReplacementTransform(note1, note2))  # not Write(note2) on top
``​`



### Never Animate Non-Added Mobjects

``​`python
self.play(Create(circle))  # must add first
self.play(circle.animate.set_color(RED))  # then animate
``​`



## Performance Targets


| Quality            | Resolution | FPS | Speed         |
| ------------------ | ---------- | --- | ------------- |
| `-ql` (draft)      | 854x480    | 15  | 5-15s/scene   |
| `-qm` (medium)     | 1280x720   | 30  | 15-60s/scene  |
| `-qh` (production) | 1920x1080  | 60  | 30-120s/scene |


Always iterate at `-ql`. Only render `-qh` for final output.

## References


| File                                      | Contents                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| `references/animations.md`                | Core animations, rate functions, composition, `.animate` syntax, timing patterns |
| `references/mobjects.md`                  | Text, shapes, VGroup/Group, positioning, styling, custom mobjects                |
| `references/visual-design.md`             | 12 design principles, opacity layering, layout templates, color palettes         |
| `references/equations.md`                 | LaTeX in Manim, TransformMatchingTex, derivation patterns                        |
| `references/graphs-and-data.md`           | Axes, plotting, BarChart, animated data, algorithm visualization                 |
| `references/camera-and-3d.md`             | MovingCameraScene, ThreeDScene, 3D surfaces, camera control                      |
| `references/scene-planning.md`            | Narrative arcs, layout templates, scene transitions, planning template           |
| `references/rendering.md`                 | CLI reference, quality presets, ffmpeg, voiceover workflow, GIF export           |
| `references/troubleshooting.md`           | LaTeX errors, animation errors, common mistakes, debugging                       |
| `references/animation-design-thinking.md` | When to animate vs show static, decomposition, pacing, narration sync            |
| `references/updaters-and-trackers.md`     | ValueTracker, add_updater, always_redraw, time-based updaters, patterns          |
| `references/paper-explainer.md`           | Turning research papers into animations — workflow, templates, domain patterns   |
| `references/decorations.md`               | SurroundingRectangle, Brace, arrows, DashedLine, Angle, annotation lifecycle     |
| `references/production-quality.md`        | Pre-code, pre-render, post-render checklists, spatial layout, color, tempo       |


---



## Creative Divergence (use only when user requests experimental/creative/unique output)

If the user asks for creative, experimental, or unconventional explanatory approaches, select a strategy and reason through it BEFORE designing the animation.

- **SCAMPER** — when the user wants a fresh take on a standard explanation
- **Assumption Reversal** — when the user wants to challenge how something is typically taught



### SCAMPER Transformation

Take a standard mathematical/technical visualization and transform it:

- **Substitute**: replace the standard visual metaphor (number line → winding path, matrix → city grid)
- **Combine**: merge two explanation approaches (algebraic + geometric simultaneously)
- **Reverse**: derive backward — start from the result and deconstruct to axioms
- **Modify**: exaggerate a parameter to show why it matters (10x the learning rate, 1000x the sample size)
- **Eliminate**: remove all notation — explain purely through animation and spatial relationships



### Assumption Reversal

1. List what's "standard" about how this topic is visualized (left-to-right, 2D, discrete steps, formal notation)
2. Pick the most fundamental assumption
3. Reverse it (right-to-left derivation, 3D embedding of a 2D concept, continuous morphing instead of steps, zero notation)
4. Explore what the reversal reveals that the standard approach hides
```



### `Skills/manim-video/references/animation-design-thinking.md`

```markdown
# Animation Design Thinking

How to decide WHAT to animate and HOW to structure it — before writing any code.

## Should I animate this?

Not everything benefits from animation. Motion adds cognitive load. Bad animation is worse than a good static diagram.

**Animate when:**
- A sequence unfolds over time (algorithm steps, derivation, pipeline stages)
- Spatial relationships change (transformation, deformation, rotation)
- Something is built from parts (construction, assembly, accumulation)
- You're comparing states (before/after, method A vs method B)
- Temporal evolution is the point (training curves, wave propagation, gradient descent)

**Show static when:**
- The concept is a single labeled diagram (circuit, anatomy, architecture overview)
- Motion would distract from spatial layout
- The viewer needs to study it carefully (dense table, reference chart)
- The concept is already intuitive from a well-labeled figure

**Rule of thumb:** If you'd explain it with "first X, then Y, then Z" — animate it. If you'd explain it by pointing at parts of one picture — show it static.

## Decomposing a concept into animation

### Step 1: Write the narration first

Before any code, write what the narrator would say. This determines:
- **Order** — what concept comes first
- **Duration** — how long each idea gets
- **Visuals** — what the viewer must SEE when they HEAR each sentence

A scene where the narration says "the gradient points uphill" must show a gradient arrow at that moment. If the visual doesn't match the audio, the viewer's brain splits attention and both tracks are lost.

### Step 2: Identify visual beats

A "beat" is a moment where something changes on screen. Mark each beat in your narration:

``​`
"Consider a function f of x."         → [BEAT: axes + curve appear]
"At this point..."                     → [BEAT: dot appears on curve]
"...the slope is positive."            → [BEAT: tangent line drawn]
"So the gradient tells us to go left." → [BEAT: arrow points left, dot moves]
``​`

Each beat is one `self.play()` call or a small group of simultaneous animations.

### Step 3: Choose the right tool per beat

| Visual need | Manim approach |
|-------------|----------------|
| Object appears for first time | `Create`, `Write`, `FadeIn`, `GrowFromCenter` |
| Object transforms into another | `Transform`, `ReplacementTransform`, `FadeTransform` |
| Attention drawn to existing object | `Indicate`, `Circumscribe`, `Flash`, `ShowPassingFlash` |
| Continuous relationship maintained | `add_updater`, `always_redraw`, `ValueTracker` |
| Object leaves the scene | `FadeOut`, `Uncreate`, `ShrinkToCenter` |
| Static context that stays visible | `self.add()` (no animation) |

## Pacing: the universal mistake is too fast

### Timing rules

| Content type | Minimum on-screen time |
|-------------|----------------------|
| New equation appearing | 2.0s animation + 2.0s pause |
| New concept label | 1.0s animation + 1.0s pause |
| Key insight ("aha moment") | 2.5s animation + 3.0s pause |
| Supporting annotation | 0.8s animation + 0.5s pause |
| Scene transition (FadeOut all) | 0.5s animation + 0.3s pause |

### Breathing room

After every reveal, add `self.wait()`. The viewer needs time to:
1. Read the new text
2. Connect it to what's already on screen
3. Form an expectation about what comes next

**No wait = the viewer is always behind you.** They're still reading the equation when you've already started transforming it.

### Tempo variation

Monotonous pacing feels like a lecture. Vary the tempo:
- **Slow build** for core concepts (long run_time, long pauses)
- **Quick succession** for supporting details (short run_time, minimal pauses)
- **Dramatic pause** before the key reveal (extra `self.wait(2.0)` before the "aha")
- **Rapid montage** for "and this applies to X, Y, Z..." sequences (`LaggedStart` with tight lag_ratio)

## Narration synchronization

### The "see then hear" principle

The visual should appear slightly BEFORE the narration describes it. When the viewer sees a circle appear and THEN hears "consider a circle," the visual primes their brain for the concept. The reverse — hearing first, seeing second — creates confusion because they're searching the screen for something that isn't there yet.

### Practical timing

``​`python
# Scene duration should match narration duration.
# If narration for this scene is 8 seconds:
# Total animation run_times + total self.wait() times = ~8 seconds.

# Use manim-voiceover for automatic sync:
with self.voiceover(text="The gradient points downhill") as tracker:
    self.play(GrowArrow(gradient_arrow), run_time=tracker.duration)
``​`

## Equation decomposition strategy

### The "dim and reveal" pattern

When building a complex equation step by step:
1. Show the full equation dimmed at `opacity=0.2` (sets expectation for where you're going)
2. Highlight the first term at full opacity
3. Explain it
4. Highlight the next term, dim the first to `0.5` (it's now context)
5. Repeat until the full equation is bright

This is better than building left-to-right because the viewer always sees the destination.

### Term ordering

Animate terms in the order the viewer needs to understand them, not in the order they appear in the equation. For `E = mc²`:
- Show `E` (the thing we want to know)
- Then `m` (the input)
- Then `c²` (the constant that makes it work)
- Then the `=` (connecting them)

## Architecture and pipeline diagrams

### Box granularity

The most common mistake: too many boxes. Each box is a concept the viewer must track. Five boxes with clear labels beats twelve boxes with abbreviations.

**Rule:** If two consecutive boxes could be labeled "X" and "process X output," merge them into one box.

### Animation strategy

Build pipelines left-to-right (or top-to-bottom) with arrows connecting them:
1. First box appears alone → explain it
2. Arrow grows from first to second → "the output feeds into..."
3. Second box appears → explain it
4. Repeat

Then show data flowing through: `ShowPassingFlash` along the arrows, or a colored dot traversing the path.

### The zoom-and-return pattern

For complex systems:
1. Show the full overview (all boxes, small)
2. Zoom into one box (`MovingCameraScene.camera.frame.animate`)
3. Expand that box into its internal components
4. Zoom back out to the overview
5. Zoom into the next box

## Common design mistakes

1. **Animating everything at once.** The viewer can track 1-2 simultaneous animations. More than that and nothing registers.
2. **No visual hierarchy.** Everything at the same opacity/size/color means nothing stands out. Use opacity layering.
3. **Equations without context.** An equation appearing alone means nothing. Always show the geometric/visual interpretation first or simultaneously.
4. **Skipping the "why."** Showing HOW a transformation works without WHY it matters. Add a sentence/label explaining the purpose.
5. **Identical pacing throughout.** Every animation at run_time=1.5, every wait at 1.0. Vary it.
6. **Forgetting the audience.** A video for high schoolers needs different pacing and complexity than one for PhD students. Decide the audience in the planning phase.
```



### `Skills/manim-video/references/animations.md`

```markdown
# Animations Reference

## Core Concept

An animation is a Python object that computes intermediate visual states of a mobject over time. Animations are objects passed to `self.play()`, not functions.

`run_time` controls seconds (default: 1). Always specify it explicitly for important animations.

## Creation Animations

``​`python
self.play(Create(circle))          # traces outline
self.play(Write(equation))         # simulates handwriting (for Text/MathTex)
self.play(FadeIn(group))           # opacity 0 -> 1
self.play(GrowFromCenter(dot))     # scale 0 -> 1 from center
self.play(DrawBorderThenFill(sq))  # outline first, then fill
``​`

## Removal Animations

``​`python
self.play(FadeOut(mobject))         # opacity 1 -> 0
self.play(Uncreate(circle))        # reverse of Create
self.play(ShrinkToCenter(group))   # scale 1 -> 0
``​`

## Transform Animations

``​`python
# Transform -- modifies the original in place
self.play(Transform(circle, square))
# After: circle IS the square (same object, new appearance)

# ReplacementTransform -- replaces old with new
self.play(ReplacementTransform(circle, square))
# After: circle removed, square on screen

# TransformMatchingTex -- smart equation morphing
eq1 = MathTex(r"a^2 + b^2")
eq2 = MathTex(r"a^2 + b^2 = c^2")
self.play(TransformMatchingTex(eq1, eq2))
``​`

**Critical**: After `Transform(A, B)`, variable `A` references the on-screen mobject. Variable `B` is NOT on screen. Use `ReplacementTransform` when you want to work with `B` afterwards.

## The .animate Syntax

``​`python
self.play(circle.animate.set_color(RED))
self.play(circle.animate.shift(RIGHT * 2).scale(0.5))  # chain multiple
``​`

## Additional Creation Animations

``​`python
self.play(GrowFromPoint(circle, LEFT * 3))     # scale 0 -> 1 from a specific point
self.play(GrowFromEdge(rect, DOWN))             # grow from one edge
self.play(SpinInFromNothing(square))            # scale up while rotating (default PI/2)
self.play(GrowArrow(arrow))                     # grows arrow from start to tip
``​`

## Movement Animations

``​`python
# Move a mobject along an arbitrary path
path = Arc(radius=2, angle=PI)
self.play(MoveAlongPath(dot, path), run_time=2)

# Rotate (as a Transform, not .animate — supports about_point)
self.play(Rotate(square, angle=PI / 2, about_point=ORIGIN), run_time=1.5)

# Rotating (continuous rotation, updater-style — good for spinning objects)
self.play(Rotating(gear, angle=TAU, run_time=4, rate_func=linear))
``​`

`MoveAlongPath` takes any `VMobject` as the path — use `Arc`, `CubicBezier`, `Line`, or a custom `VMobject`. Position is computed via `path.point_from_proportion()`.

## Emphasis Animations

``​`python
self.play(Indicate(mobject))             # brief yellow flash + scale
self.play(Circumscribe(mobject))         # draw rectangle around it
self.play(Flash(point))                  # radial flash
self.play(Wiggle(mobject))               # shake side to side
``​`

## Rate Functions

``​`python
self.play(FadeIn(mob), rate_func=smooth)          # default: ease in/out
self.play(FadeIn(mob), rate_func=linear)           # constant speed
self.play(FadeIn(mob), rate_func=rush_into)        # start slow, end fast
self.play(FadeIn(mob), rate_func=rush_from)        # start fast, end slow
self.play(FadeIn(mob), rate_func=there_and_back)   # animate then reverse
``​`

## Composition

``​`python
# Simultaneous
self.play(FadeIn(title), Create(circle), run_time=2)

# AnimationGroup with lag
self.play(AnimationGroup(*[FadeIn(i) for i in items], lag_ratio=0.2))

# LaggedStart
self.play(LaggedStart(*[Write(l) for l in lines], lag_ratio=0.3, run_time=3))

# Succession (sequential in one play call)
self.play(Succession(FadeIn(title), Wait(0.5), Write(subtitle)))
``​`

## Updaters

``​`python
tracker = ValueTracker(0)
dot = Dot().add_updater(lambda m: m.move_to(axes.c2p(tracker.get_value(), 0)))
self.play(tracker.animate.set_value(5), run_time=3)
``​`

## Subtitles

``​`python
# Method 1: standalone
self.add_subcaption("Key insight", duration=2)
self.play(Write(equation), run_time=2.0)

# Method 2: inline
self.play(Write(equation), subcaption="Key insight", subcaption_duration=2)
``​`

Manim auto-generates `.srt` subtitle files. Always add subcaptions for accessibility.

## Timing Patterns

``​`python
# Pause-after-reveal
self.play(Write(key_equation), run_time=2.0)
self.wait(2.0)

# Dim-and-focus
self.play(old_content.animate.set_opacity(0.3), FadeIn(new_content))

# Clean exit
self.play(FadeOut(Group(*self.mobjects)), run_time=0.5)
self.wait(0.3)
``​`

## Reactive Mobjects: always_redraw()

Rebuild a mobject from scratch every frame — essential when its geometry depends on other animated objects:

``​`python
# Brace that follows a resizing square
brace = always_redraw(Brace, square, UP)
self.add(brace)
self.play(square.animate.scale(2))  # brace auto-adjusts

# Horizontal line that tracks a moving dot
h_line = always_redraw(lambda: axes.get_h_line(dot.get_left()))

# Label that always stays next to another mobject
label = always_redraw(lambda: Text("here", font_size=20).next_to(dot, UP, buff=0.2))
``​`

Note: `always_redraw` recreates the mobject every frame. For simple property tracking, use `add_updater` instead (cheaper):
``​`python
label.add_updater(lambda m: m.next_to(dot, UP))
``​`

## TracedPath — Trajectory Tracing

Draw the path a point has traveled:

``​`python
dot = Dot(color=YELLOW)
path = TracedPath(dot.get_center, stroke_color=YELLOW, stroke_width=2)
self.add(dot, path)
self.play(dot.animate.shift(RIGHT * 3 + UP * 2), run_time=2)
# path shows the trail the dot left behind

# Fading trail (dissipates over time):
path = TracedPath(dot.get_center, dissipating_time=0.5, stroke_opacity=[0, 1])
``​`

Use cases: gradient descent paths, planetary orbits, function tracing, particle trajectories.

## FadeTransform — Smoother Cross-Fades

`Transform` morphs shapes through ugly intermediate warping. `FadeTransform` cross-fades with position matching — use it when source and target look different:

``​`python
# UGLY: Transform warps circle into square through a blob
self.play(Transform(circle, square))

# SMOOTH: FadeTransform cross-fades cleanly
self.play(FadeTransform(circle, square))

# FadeTransformPieces: per-submobject FadeTransform
self.play(FadeTransformPieces(group1, group2))

# TransformFromCopy: animate a COPY while keeping the original visible
self.play(TransformFromCopy(source, target))
# source stays on screen, a copy morphs into target
``​`

**Recommendation:** Use `FadeTransform` as default for dissimilar shapes. Use `Transform`/`ReplacementTransform` only for similar shapes (circle→ellipse, equation→equation).

## ApplyMatrix — Linear Transformation Visualization

Animate a matrix transformation on mobjects:

``​`python
# Apply a 2x2 matrix to a grid
matrix = [[2, 1], [1, 1]]
self.play(ApplyMatrix(matrix, number_plane), run_time=2)

# Also works on individual mobjects
self.play(ApplyMatrix([[0, -1], [1, 0]], square))  # 90-degree rotation
``​`

Pairs with `LinearTransformationScene` — see `camera-and-3d.md`.

## squish_rate_func — Time-Window Staggering

Compress any rate function into a time window within an animation. Enables overlapping stagger without `LaggedStart`:

``​`python
self.play(
    FadeIn(a, rate_func=squish_rate_func(smooth, 0, 0.5)),    # 0% to 50%
    FadeIn(b, rate_func=squish_rate_func(smooth, 0.25, 0.75)), # 25% to 75%
    FadeIn(c, rate_func=squish_rate_func(smooth, 0.5, 1.0)),  # 50% to 100%
    run_time=2
)
``​`

More precise than `LaggedStart` when you need exact overlap control.

## Additional Rate Functions

``​`python
from manim import (
    smooth, linear, rush_into, rush_from,
    there_and_back, there_and_back_with_pause,
    running_start, double_smooth, wiggle,
    lingering, exponential_decay, not_quite_there,
    squish_rate_func
)

# running_start: pulls back before going forward (anticipation)
self.play(FadeIn(mob, rate_func=running_start))

# there_and_back_with_pause: goes there, holds, comes back
self.play(mob.animate.shift(UP), rate_func=there_and_back_with_pause)

# not_quite_there: stops at a fraction of the full animation
self.play(FadeIn(mob, rate_func=not_quite_there(0.7)))
``​`

## ShowIncreasingSubsets / ShowSubmobjectsOneByOne

Reveal group members progressively — ideal for algorithm visualization:

``​`python
# Reveal array elements one at a time
array = Group(*[Square() for _ in range(8)]).arrange(RIGHT)
self.play(ShowIncreasingSubsets(array), run_time=3)

# Show submobjects with staggered appearance
self.play(ShowSubmobjectsOneByOne(code_lines), run_time=4)
``​`

## ShowPassingFlash

A flash of light travels along a path:

``​`python
# Flash traveling along a curve
self.play(ShowPassingFlash(curve.copy().set_color(YELLOW), time_width=0.3))

# Great for: data flow, electrical signals, network traffic
``​`
```



### `Skills/manim-video/references/camera-and-3d.md`

```markdown
# Camera and 3D Reference

## MovingCameraScene (2D Camera Control)

``​`python
class ZoomExample(MovingCameraScene):
    def construct(self):
        circle = Circle(radius=2, color=BLUE)
        self.play(Create(circle))
        # Zoom in
        self.play(self.camera.frame.animate.set(width=4).move_to(circle.get_top()), run_time=2)
        self.wait(2)
        # Zoom back out
        self.play(self.camera.frame.animate.set(width=14.222).move_to(ORIGIN), run_time=2)
``​`

### Camera Operations

``​`python
self.camera.frame.animate.set(width=6)     # zoom in
self.camera.frame.animate.set(width=20)    # zoom out
self.camera.frame.animate.move_to(target)  # pan
self.camera.frame.save_state()             # save
self.play(Restore(self.camera.frame))      # restore
``​`

## ThreeDScene

``​`python
class ThreeDExample(ThreeDScene):
    def construct(self):
        self.set_camera_orientation(phi=60*DEGREES, theta=-45*DEGREES)
        axes = ThreeDAxes()
        surface = Surface(
            lambda u, v: axes.c2p(u, v, np.sin(u) * np.cos(v)),
            u_range=[-PI, PI], v_range=[-PI, PI], resolution=(30, 30)
        )
        surface.set_color_by_gradient(BLUE, GREEN, YELLOW)
        self.play(Create(axes), Create(surface))
        self.begin_ambient_camera_rotation(rate=0.2)
        self.wait(5)
        self.stop_ambient_camera_rotation()
``​`

### Camera Control in 3D

``​`python
self.set_camera_orientation(phi=70*DEGREES, theta=-45*DEGREES)
self.move_camera(phi=45*DEGREES, theta=30*DEGREES, run_time=2)
self.begin_ambient_camera_rotation(rate=0.2)
``​`

### 3D Mobjects

``​`python
sphere = Sphere(radius=1).set_color(BLUE).set_opacity(0.7)
cube = Cube(side_length=2, fill_color=GREEN, fill_opacity=0.5)
arrow = Arrow3D(start=ORIGIN, end=[2, 1, 1], color=RED)
# 2D text facing camera:
label = Text("Label", font_size=30)
self.add_fixed_in_frame_mobjects(label)
``​`

### Parametric Curves

``​`python
helix = ParametricFunction(
    lambda t: [np.cos(t), np.sin(t), t / (2*PI)],
    t_range=[0, 4*PI], color=YELLOW
)
``​`

## When to Use 3D
- Surfaces, vector fields, spatial geometry, 3D transforms
## When NOT to Use 3D
- 2D concepts, text-heavy scenes, flat data (bar charts, time series)

## ZoomedScene — Inset Zoom

Show a magnified inset of a detail while keeping the full view visible:

``​`python
class ZoomExample(ZoomedScene):
    def __init__(self, **kwargs):
        super().__init__(
            zoom_factor=0.3,           # how much of the scene the zoom box covers
            zoomed_display_height=3,   # size of the inset
            zoomed_display_width=3,
            zoomed_camera_frame_starting_position=ORIGIN,
            **kwargs
        )

    def construct(self):
        self.camera.background_color = BG
        # ... create your scene content ...

        # Activate the zoom
        self.activate_zooming()

        # Move the zoom frame to a point of interest
        self.play(self.zoomed_camera.frame.animate.move_to(detail_point))
        self.wait(2)

        # Deactivate
        self.play(self.get_zoomed_display_pop_out_animation(), rate_func=lambda t: smooth(1-t))
``​`

Use cases: zooming into a specific term in an equation, showing fine detail in a diagram, magnifying a region of a plot.

## LinearTransformationScene — Linear Algebra

Pre-built scene with basis vectors and grid for visualizing matrix transformations:

``​`python
class LinearTransformExample(LinearTransformationScene):
    def __init__(self, **kwargs):
        super().__init__(
            show_coordinates=True,
            show_basis_vectors=True,
            **kwargs
        )

    def construct(self):
        matrix = [[2, 1], [1, 1]]

        # Add a vector before applying the transform
        vector = self.get_vector([1, 2], color=YELLOW)
        self.add_vector(vector)

        # Apply the transformation — grid, basis vectors, and your vector all transform
        self.apply_matrix(matrix)
        self.wait(2)
``​`

This produces the signature 3Blue1Brown "Essence of Linear Algebra" look — grid lines deforming, basis vectors stretching, determinant visualized through area change.
```



### `Skills/manim-video/references/decorations.md`

```markdown
# Decorations and Visual Polish

Decorations are mobjects that annotate, highlight, or frame other mobjects. They turn a technically correct animation into a visually polished one.

## SurroundingRectangle

Draws a rectangle around any mobject. The go-to for highlighting:

``​`python
highlight = SurroundingRectangle(
    equation[2],            # the term to highlight
    color=YELLOW,
    buff=0.15,              # padding between content and border
    corner_radius=0.1,      # rounded corners
    stroke_width=2
)
self.play(Create(highlight))
self.wait(1)
self.play(FadeOut(highlight))
``​`

### Around part of an equation

``​`python
eq = MathTex(r"E", r"=", r"m", r"c^2")
box = SurroundingRectangle(eq[2:], color=YELLOW, buff=0.1)  # highlight "mc²"
label = Text("mass-energy", font_size=18, font="Menlo", color=YELLOW)
label.next_to(box, DOWN, buff=0.2)
self.play(Create(box), FadeIn(label))
``​`

## BackgroundRectangle

Semi-transparent background behind text for readability over complex scenes:

``​`python
bg = BackgroundRectangle(equation, fill_opacity=0.7, buff=0.2, color=BLACK)
self.play(FadeIn(bg), Write(equation))

# Or using set_stroke for a "backdrop" effect on the text itself:
label.set_stroke(BLACK, width=5, background=True)
``​`

The `set_stroke(background=True)` approach is cleaner for text labels over graphs/diagrams.

## Brace and BraceLabel

Curly braces that annotate sections of a diagram or equation:

``​`python
brace = Brace(equation[2:4], DOWN, color=YELLOW)
brace_label = brace.get_text("these terms", font_size=20)
self.play(GrowFromCenter(brace), FadeIn(brace_label))

# Between two specific points
brace = BraceBetweenPoints(point_a, point_b, direction=UP)
``​`

### Brace placement

``​`python
# Below a group
Brace(group, DOWN)
# Above a group
Brace(group, UP)
# Left of a group
Brace(group, LEFT)
# Right of a group
Brace(group, RIGHT)
``​`

## Arrows for Annotation

### Straight arrows pointing to mobjects

``​`python
arrow = Arrow(
    start=label.get_bottom(),
    end=target.get_top(),
    color=YELLOW,
    stroke_width=2,
    buff=0.1,                    # gap between arrow tip and target
    max_tip_length_to_length_ratio=0.15  # small arrowhead
)
self.play(GrowArrow(arrow), FadeIn(label))
``​`

### Curved arrows

``​`python
arrow = CurvedArrow(
    start_point=source.get_right(),
    end_point=target.get_left(),
    angle=PI/4,                  # curve angle
    color=PRIMARY
)
``​`

### Labeling with arrows

``​`python
# LabeledArrow: arrow with built-in text label
arr = LabeledArrow(
    Text("gradient", font_size=16, font="Menlo"),
    start=point_a, end=point_b, color=RED
)
``​`

## DashedLine and DashedVMobject

``​`python
# Dashed line (for asymptotes, construction lines, implied connections)
asymptote = DashedLine(
    axes.c2p(2, -3), axes.c2p(2, 3),
    color=YELLOW, dash_length=0.15
)

# Make any VMobject dashed
dashed_circle = DashedVMobject(Circle(radius=2, color=BLUE), num_dashes=30)
``​`

## Angle and RightAngle Markers

``​`python
line1 = Line(ORIGIN, RIGHT * 2)
line2 = Line(ORIGIN, UP * 2 + RIGHT)

# Angle arc between two lines
angle = Angle(line1, line2, radius=0.5, color=YELLOW)
angle_value = angle.get_value()  # radians

# Right angle marker (the small square)
right_angle = RightAngle(line1, Line(ORIGIN, UP * 2), length=0.3, color=WHITE)
``​`

## Cross (strikethrough)

Mark something as wrong or deprecated:

``​`python
cross = Cross(old_equation, color=RED, stroke_width=4)
self.play(Create(cross))
# Then show the correct version
``​`

## Underline

``​`python
underline = Underline(important_text, color=ACCENT, stroke_width=3)
self.play(Create(underline))
``​`

## Color Highlighting Workflow

### Method 1: At creation with t2c

``​`python
text = Text("The gradient is negative here", t2c={"gradient": BLUE, "negative": RED})
``​`

### Method 2: set_color_by_tex after creation

``​`python
eq = MathTex(r"\nabla L = -\frac{\partial L}{\partial w}")
eq.set_color_by_tex(r"\nabla", BLUE)
eq.set_color_by_tex(r"\partial", RED)
``​`

### Method 3: Index into submobjects

``​`python
eq = MathTex(r"a", r"+", r"b", r"=", r"c")
eq[0].set_color(RED)    # "a"
eq[2].set_color(BLUE)   # "b"
eq[4].set_color(GREEN)  # "c"
``​`

## Combining Annotations

Layer multiple annotations for emphasis:

``​`python
# Highlight a term, add a brace, and an arrow — in sequence
box = SurroundingRectangle(eq[2], color=YELLOW, buff=0.1)
brace = Brace(eq[2], DOWN, color=YELLOW)
label = brace.get_text("learning rate", font_size=18)

self.play(Create(box))
self.wait(0.5)
self.play(FadeOut(box), GrowFromCenter(brace), FadeIn(label))
self.wait(1.5)
self.play(FadeOut(brace), FadeOut(label))
``​`

### The annotation lifecycle

Annotations should follow a rhythm:
1. **Appear** — draw attention (Create, GrowFromCenter)
2. **Hold** — viewer reads and understands (self.wait)
3. **Disappear** — clear the stage for the next thing (FadeOut)

Never leave annotations on screen indefinitely — they become visual noise once their purpose is served.
```



### `Skills/manim-video/references/equations.md`

```markdown
# Equations and LaTeX Reference

## Basic LaTeX

``​`python
eq = MathTex(r"E = mc^2")
eq = MathTex(r"f(x) &= x^2 + 2x + 1 \\ &= (x + 1)^2")  # multi-line aligned
``​`

**Always use raw strings (`r""`).**

## Step-by-Step Derivations

``​`python
step1 = MathTex(r"a^2 + b^2 = c^2")
step2 = MathTex(r"a^2 = c^2 - b^2")
self.play(Write(step1), run_time=1.5)
self.wait(1.5)
self.play(TransformMatchingTex(step1, step2), run_time=1.5)
``​`

## Selective Color

``​`python
eq = MathTex(r"a^2", r"+", r"b^2", r"=", r"c^2")
eq[0].set_color(RED)
eq[4].set_color(GREEN)
``​`

## Building Incrementally

``​`python
parts = MathTex(r"f(x)", r"=", r"\sum_{n=0}^{\infty}", r"\frac{f^{(n)}(a)}{n!}", r"(x-a)^n")
self.play(Write(parts[0:2]))
self.wait(0.5)
self.play(Write(parts[2]))
self.wait(0.5)
self.play(Write(parts[3:]))
``​`

## Highlighting

``​`python
highlight = SurroundingRectangle(eq[2], color=YELLOW, buff=0.1)
self.play(Create(highlight))
self.play(Indicate(eq[4], color=YELLOW))
``​`

## Annotation

``​`python
brace = Brace(eq, DOWN, color=YELLOW)
label = brace.get_text("Fundamental Theorem", font_size=24)
self.play(GrowFromCenter(brace), Write(label))
``​`

## Common LaTeX

``​`python
MathTex(r"\frac{a}{b}")                  # fraction
MathTex(r"\alpha, \beta, \gamma")         # Greek
MathTex(r"\sum_{i=1}^{n} x_i")           # summation
MathTex(r"\int_{0}^{\infty} e^{-x} dx")  # integral
MathTex(r"\vec{v}")                       # vector
MathTex(r"\lim_{x \to \infty} f(x)")    # limit
``​`

## Matrices

`MathTex` supports standard LaTeX matrix environments via `amsmath` (loaded by default):

``​`python
# Bracketed matrix
MathTex(r"\begin{bmatrix} 1 & 0 \\ 0 & 1 \end{bmatrix}")

# Parenthesized matrix
MathTex(r"\begin{pmatrix} a & b \\ c & d \end{pmatrix}")

# Determinant (vertical bars)
MathTex(r"\begin{vmatrix} a & b \\ c & d \end{vmatrix}")

# Plain (no delimiters)
MathTex(r"\begin{matrix} x_1 \\ x_2 \\ x_3 \end{matrix}")
``​`

For matrices you need to animate element-by-element or color individual entries, use the `IntegerMatrix`, `DecimalMatrix`, or `MobjectMatrix` mobjects instead — see `mobjects.md`.

## Cases and Piecewise Functions

``​`python
MathTex(r"""
    f(x) = \begin{cases}
        x^2    & \text{if } x \geq 0 \\
        -x^2   & \text{if } x < 0
    \end{cases}
""")
``​`

## Aligned Environments

For multi-line derivations with alignment, use `aligned` inside `MathTex`:

``​`python
MathTex(r"""
    \begin{aligned}
        \nabla \cdot \mathbf{E} &= \frac{\rho}{\epsilon_0} \\
        \nabla \cdot \mathbf{B} &= 0 \\
        \nabla \times \mathbf{E} &= -\frac{\partial \mathbf{B}}{\partial t} \\
        \nabla \times \mathbf{B} &= \mu_0 \mathbf{J} + \mu_0 \epsilon_0 \frac{\partial \mathbf{E}}{\partial t}
    \end{aligned}
""")
``​`

Note: `MathTex` wraps content in `align*` by default. Override with `tex_environment` if needed:
``​`python
MathTex(r"...", tex_environment="gather*")
``​`

## Derivation Pattern

``​`python
class DerivationScene(Scene):
    def construct(self):
        self.camera.background_color = BG
        s1 = MathTex(r"ax^2 + bx + c = 0")
        self.play(Write(s1))
        self.wait(1.5)
        s2 = MathTex(r"x^2 + \frac{b}{a}x + \frac{c}{a} = 0")
        s2.next_to(s1, DOWN, buff=0.8)
        self.play(s1.animate.set_opacity(0.4), TransformMatchingTex(s1.copy(), s2))
``​`

## substrings_to_isolate for Complex Equations

For dense equations where manually splitting into parts is impractical, use `substrings_to_isolate` to tell Manim which substrings to track as individual elements:

``​`python
# Without isolation — the whole expression is one blob
lagrangian = MathTex(
    r"\mathcal{L} = \bar{\psi}(i \gamma^\mu D_\mu - m)\psi - \tfrac{1}{4}F_{\mu\nu}F^{\mu\nu}"
)

# With isolation — each named substring is a separate submobject
lagrangian = MathTex(
    r"\mathcal{L} = \bar{\psi}(i \gamma^\mu D_\mu - m)\psi - \tfrac{1}{4}F_{\mu\nu}F^{\mu\nu}",
    substrings_to_isolate=[r"\psi", r"D_\mu", r"\gamma^\mu", r"F_{\mu\nu}"]
)
# Now you can color individual terms
lagrangian.set_color_by_tex(r"\psi", BLUE)
lagrangian.set_color_by_tex(r"F_{\mu\nu}", YELLOW)
``​`

Essential for `TransformMatchingTex` on complex equations — without isolation, matching fails on dense expressions.

## Multi-Line Complex Equations

For equations with multiple related lines, pass each line as a separate argument:

``​`python
maxwell = MathTex(
    r"\nabla \cdot \mathbf{E} = \frac{\rho}{\epsilon_0}",
    r"\nabla \times \mathbf{B} = \mu_0\mathbf{J} + \mu_0\epsilon_0\frac{\partial \mathbf{E}}{\partial t}"
).arrange(DOWN)

# Each line is a separate submobject — animate independently
self.play(Write(maxwell[0]))
self.wait(1)
self.play(Write(maxwell[1]))
``​`

## TransformMatchingTex with key_map

Map specific substrings between source and target equations during transformation:

``​`python
eq1 = MathTex(r"A^2 + B^2 = C^2")
eq2 = MathTex(r"A^2 = C^2 - B^2")

self.play(TransformMatchingTex(
    eq1, eq2,
    key_map={"+": "-"},   # map "+" in source to "-" in target
    path_arc=PI / 2,      # arc the pieces into position
))
``​`

## set_color_by_tex — Color by Substring

``​`python
eq = MathTex(r"E = mc^2")
eq.set_color_by_tex("E", BLUE)
eq.set_color_by_tex("m", RED)
eq.set_color_by_tex("c", GREEN)
``​`

## TransformMatchingTex with matched_keys

When matching substrings are ambiguous, specify which to align explicitly:

``​`python
kw = dict(font_size=72, t2c={"A": BLUE, "B": TEAL, "C": GREEN})
lines = [
    MathTex(r"A^2 + B^2 = C^2", **kw),
    MathTex(r"A^2 = C^2 - B^2", **kw),
    MathTex(r"A^2 = (C + B)(C - B)", **kw),
    MathTex(r"A = \sqrt{(C + B)(C - B)}", **kw),
]

self.play(TransformMatchingTex(
    lines[0].copy(), lines[1],
    matched_keys=["A^2", "B^2", "C^2"],  # explicitly match these
    key_map={"+": "-"},                    # map + to -
    path_arc=PI / 2,                       # arc pieces into position
))
``​`

Without `matched_keys`, the animation matches the longest common substrings, which can produce unexpected results on complex equations (e.g., "^2 = C^2" matching across terms).
```



### `Skills/manim-video/references/graphs-and-data.md`

```markdown
# Graphs, Plots, and Data Visualization

## Axes

``​`python
axes = Axes(
    x_range=[-3, 3, 1], y_range=[-2, 2, 1],
    x_length=8, y_length=5,
    axis_config={"include_numbers": True, "font_size": 24}
)
axes.set_opacity(0.15)  # structural element
x_label = axes.get_x_axis_label(r"x")
``​`

## Plotting

``​`python
graph = axes.plot(lambda x: x**2, color=BLUE)
graph_label = axes.get_graph_label(graph, label=r"x^2", x_val=2)
area = axes.get_area(graph, x_range=[0, 2], color=BLUE, opacity=0.3)
``​`

## Animated Plotting

``​`python
self.play(Create(graph), run_time=3)  # trace the graph

# Moving dot along curve
dot = Dot(color=YELLOW).move_to(axes.c2p(0, 0))
self.play(MoveAlongPath(dot, graph), run_time=3)

# Dynamic parameter
tracker = ValueTracker(1)
dynamic = always_redraw(lambda: axes.plot(lambda x: tracker.get_value() * x**2, color=BLUE))
self.add(dynamic)
self.play(tracker.animate.set_value(3), run_time=2)
``​`

## Bar Charts

``​`python
chart = BarChart(
    values=[4, 6, 2, 8, 5], bar_names=["A", "B", "C", "D", "E"],
    y_range=[0, 10, 2], bar_colors=[RED, GREEN, BLUE, YELLOW, PURPLE]
)
self.play(Create(chart), run_time=2)
self.play(chart.animate.change_bar_values([6, 3, 7, 4, 9]))
``​`

## Number Lines

``​`python
nl = NumberLine(x_range=[0, 10, 1], length=10, include_numbers=True)
pointer = Arrow(nl.n2p(3) + UP * 0.5, nl.n2p(3), color=RED, buff=0)
tracker = ValueTracker(3)
pointer.add_updater(lambda m: m.put_start_and_end_on(
    nl.n2p(tracker.get_value()) + UP * 0.5, nl.n2p(tracker.get_value())))
self.play(tracker.animate.set_value(8), run_time=2)
``​`

## Animated Counters

``​`python
counter = DecimalNumber(0, font_size=72, num_decimal_places=0)
self.play(counter.animate.set_value(1000), run_time=3, rate_func=rush_from)
``​`

## Algorithm Visualization Pattern

``​`python
values = [5, 2, 8, 1, 9, 3]
bars = VGroup(*[
    Rectangle(width=0.6, height=v * 0.4, color=BLUE, fill_opacity=0.7)
    for v in values
]).arrange(RIGHT, buff=0.2, aligned_edge=DOWN).move_to(ORIGIN)
self.play(LaggedStart(*[GrowFromEdge(b, DOWN) for b in bars], lag_ratio=0.1))
# Highlight, swap, etc.
``​`

## Data Story Pattern

``​`python
# Before/After comparison
before = BarChart(values=[3, 5, 2], bar_colors=[RED]*3).shift(LEFT * 3)
after = BarChart(values=[8, 9, 7], bar_colors=[GREEN]*3).shift(RIGHT * 3)
self.play(Create(before)); self.wait(1)
self.play(Create(after)); self.wait(1)
arrow = Arrow(before.get_right(), after.get_left(), color=YELLOW)
label = Text("+167%", font_size=36, color=YELLOW).next_to(arrow, UP)
self.play(GrowArrow(arrow), Write(label))
``​`

## Graph / DiGraph — Graph Theory Visualization

Built-in graph mobjects with automatic layout:

``​`python
# Undirected graph
g = Graph(
    vertices=[1, 2, 3, 4, 5],
    edges=[(1, 2), (2, 3), (3, 4), (4, 5), (5, 1), (1, 3)],
    layout="spring",  # or "circular", "kamada_kawai", "planar", "tree"
    labels=True,
    vertex_config={"fill_color": PRIMARY},
    edge_config={"stroke_color": SUBTLE},
)
self.play(Create(g))

# Directed graph
dg = DiGraph(
    vertices=["A", "B", "C"],
    edges=[("A", "B"), ("B", "C"), ("C", "A")],
    layout="circular",
    labels=True,
    edge_config={("A", "B"): {"stroke_color": RED}},
)

# Add/remove vertices and edges dynamically
self.play(g.animate.add_vertices(6, positions={6: RIGHT * 2}))
self.play(g.animate.add_edges((1, 6)))
self.play(g.animate.remove_vertices(3))
``​`

Layout algorithms: `"spring"`, `"circular"`, `"kamada_kawai"`, `"planar"`, `"spectral"`, `"tree"` (for rooted trees, specify `root=`).

## ArrowVectorField / StreamLines — Vector Fields

``​`python
# Arrow field: arrows showing direction at each point
field = ArrowVectorField(
    lambda pos: np.array([-pos[1], pos[0], 0]),  # rotation field
    x_range=[-3, 3], y_range=[-3, 3],
    colors=[BLUE, GREEN, YELLOW, RED]
)
self.play(Create(field))

# StreamLines: flowing particle traces through the field
stream = StreamLines(
    lambda pos: np.array([-pos[1], pos[0], 0]),
    stroke_width=2, max_anchors_per_line=30
)
self.add(stream)
stream.start_animation(warm_up=True, flow_speed=1.5)
self.wait(3)
stream.end_animation()
``​`

Use cases: electromagnetic fields, fluid flow, gradient fields, ODE phase portraits.

## ComplexPlane / PolarPlane

``​`python
# Complex plane with Re/Im labels
cplane = ComplexPlane().add_coordinates()
dot = Dot(cplane.n2p(2 + 1j), color=YELLOW)
label = Text("2+i", font_size=20).next_to(dot, UR, buff=0.1)

# Apply complex function to the plane
self.play(cplane.animate.apply_complex_function(lambda z: z**2), run_time=3)

# Polar plane
polar = PolarPlane(radius_max=3).add_coordinates()
``​`
```



### `Skills/manim-video/references/mobjects.md`

```markdown
# Mobjects Reference

Everything visible on screen is a Mobject. They have position, color, opacity, and can be animated.

## Text

``​`python
title = Text("Hello World", font_size=48, color=BLUE)
eq = MathTex(r"E = mc^2", font_size=40)

# Multi-part (for selective coloring)
eq = MathTex(r"a^2", r"+", r"b^2", r"=", r"c^2")
eq[0].set_color(RED)
eq[4].set_color(BLUE)

# Mixed text and math
t = Tex(r"The area is $\pi r^2$", font_size=36)

# Styled markup
t = MarkupText('<span foreground="#58C4DD">Blue</span> text', font_size=30)
``​`

**Always use raw strings (`r""`) for any string with backslashes.**

## Shapes

``​`python
circle = Circle(radius=1, color=BLUE, fill_opacity=0.5)
square = Square(side_length=2, color=RED)
rect = Rectangle(width=4, height=2, color=GREEN)
dot = Dot(point=ORIGIN, radius=0.08, color=YELLOW)
line = Line(LEFT * 2, RIGHT * 2, color=WHITE)
arrow = Arrow(LEFT, RIGHT, color=ORANGE)
rrect = RoundedRectangle(corner_radius=0.3, width=4, height=2)
brace = Brace(rect, DOWN, color=YELLOW)
``​`

## Polygons and Arcs

``​`python
# Arbitrary polygon from vertices
poly = Polygon(LEFT, UP * 2, RIGHT, color=GREEN, fill_opacity=0.3)

# Regular n-sided polygon
hexagon = RegularPolygon(n=6, color=TEAL, fill_opacity=0.4)

# Triangle (shorthand for RegularPolygon(n=3))
tri = Triangle(color=YELLOW, fill_opacity=0.5)

# Arc (portion of a circle)
arc = Arc(radius=2, start_angle=0, angle=PI / 2, color=BLUE)

# Arc between two points
arc_between = ArcBetweenPoints(LEFT * 2, RIGHT * 2, angle=TAU / 4, color=RED)

# Curved arrow (arc with tip)
curved_arrow = CurvedArrow(LEFT * 2, RIGHT * 2, color=ORANGE)
``​`

## Sectors and Annuli

``​`python
# Sector (pie slice)
sector = Sector(outer_radius=2, start_angle=0, angle=PI / 3, fill_opacity=0.7, color=BLUE)

# Annulus (ring)
ring = Annulus(inner_radius=1, outer_radius=2, fill_opacity=0.5, color=GREEN)

# Annular sector (partial ring)
partial_ring = AnnularSector(
    inner_radius=1, outer_radius=2,
    angle=PI / 2, start_angle=0,
    fill_opacity=0.7, color=TEAL
)

# Cutout (punch holes in a shape)
background = Square(side_length=4, fill_opacity=1, color=BLUE)
hole = Circle(radius=0.5)
cutout = Cutout(background, hole, fill_opacity=1, color=BLUE)
``​`

Use cases: pie charts, ring progress indicators, Venn diagrams with arcs, geometric proofs.

## Positioning

``​`python
mob.move_to(ORIGIN)                        # center
mob.move_to(UP * 2 + RIGHT)               # relative
label.next_to(circle, DOWN, buff=0.3)     # next to another
title.to_edge(UP, buff=0.5)               # screen edge (buff >= 0.5!)
mob.to_corner(UL, buff=0.5)               # corner
``​`

## VGroup vs Group

**VGroup** is for collections of shapes (VMobjects only — Circle, Square, Arrow, Line, MathTex):
``​`python
shapes = VGroup(circle, square, arrow)
shapes.arrange(DOWN, buff=0.5)
shapes.set_color(BLUE)
``​`

**Group** is for mixed collections (Text + shapes, or any Mobject types):
``​`python
# Text objects are Mobjects, not VMobjects — use Group when mixing
labeled_shape = Group(circle, Text("Label").next_to(circle, DOWN))
labeled_shape.move_to(ORIGIN)

# FadeOut everything on screen (may contain mixed types)
self.play(FadeOut(Group(*self.mobjects)))
``​`

**Rule: if your group contains any `Text()` objects, use `Group`, not `VGroup`.** VGroup will raise a TypeError on Manim CE v0.20+. MathTex and Tex are VMobjects and work with VGroup.

Both support `arrange()`, `arrange_in_grid()`, `set_opacity()`, `shift()`, `scale()`, `move_to()`.

## Styling

``​`python
mob.set_color(BLUE)
mob.set_fill(RED, opacity=0.5)
mob.set_stroke(WHITE, width=2)
mob.set_opacity(0.4)
mob.set_z_index(1)                         # layering
``​`

## Specialized Mobjects

``​`python
nl = NumberLine(x_range=[-3, 3, 1], length=8, include_numbers=True)
table = Table([["A", "B"], ["C", "D"]], row_labels=[Text("R1"), Text("R2")])
code = Code("example.py", tab_width=4, font_size=20, language="python")
highlight = SurroundingRectangle(target, color=YELLOW, buff=0.2)
bg = BackgroundRectangle(equation, fill_opacity=0.7, buff=0.2)
``​`

## Custom Mobjects

``​`python
class NetworkNode(Group):
    def __init__(self, label_text, color=BLUE, **kwargs):
        super().__init__(**kwargs)
        self.circle = Circle(radius=0.4, color=color, fill_opacity=0.3)
        self.label = Text(label_text, font_size=20).move_to(self.circle)
        self.add(self.circle, self.label)
``​`

## Matrix Mobjects

Display matrices as grids of numbers or mobjects:

``​`python
# Integer matrix
m = IntegerMatrix([[1, 2], [3, 4]])

# Decimal matrix (control decimal places)
m = DecimalMatrix([[1.5, 2.7], [3.1, 4.9]], element_to_mobject_config={"num_decimal_places": 2})

# Mobject matrix (any mobject in each cell)
m = MobjectMatrix([
    [MathTex(r"\pi"), MathTex(r"e")],
    [MathTex(r"\phi"), MathTex(r"\tau")]
])

# Bracket types: "(" "[" "|" or "\\{"
m = IntegerMatrix([[1, 0], [0, 1]], left_bracket="[", right_bracket="]")
``​`

Use cases: linear algebra, transformation matrices, system-of-equations coefficient display.

## Constants

Directions: `UP, DOWN, LEFT, RIGHT, ORIGIN, UL, UR, DL, DR`
Colors: `RED, BLUE, GREEN, YELLOW, WHITE, GRAY, ORANGE, PINK, PURPLE, TEAL, GOLD`
Frame: `config.frame_width = 14.222, config.frame_height = 8.0`

## SVGMobject — Import SVG Files

``​`python
logo = SVGMobject("path/to/logo.svg")
logo.set_color(WHITE).scale(0.5).to_corner(UR)
self.play(FadeIn(logo))

# SVG submobjects are individually animatable
for part in logo.submobjects:
    self.play(part.animate.set_color(random_color()))
``​`

## ImageMobject — Display Images

``​`python
img = ImageMobject("screenshot.png")
img.set_height(3).to_edge(RIGHT)
self.play(FadeIn(img))
``​`

Note: images cannot be animated with `.animate` (they're raster, not vector). Use `FadeIn`/`FadeOut` and `shift`/`scale` only.

## Variable — Auto-Updating Display

``​`python
var = Variable(0, Text("x"), num_decimal_places=2)
var.move_to(ORIGIN)
self.add(var)

# Animate the value
self.play(var.tracker.animate.set_value(5), run_time=2)
# Display auto-updates: "x = 5.00"
``​`

Cleaner than manual `DecimalNumber` + `add_updater` for simple labeled-value displays.

## BulletedList

``​`python
bullets = BulletedList(
    "First key point",
    "Second important fact",
    "Third conclusion",
    font_size=28
)
bullets.to_edge(LEFT, buff=1.0)
self.play(Write(bullets))

# Highlight individual items
self.play(bullets[1].animate.set_color(YELLOW))
``​`

## DashedLine and Angle Markers

``​`python
# Dashed line (asymptotes, construction lines)
dashed = DashedLine(LEFT * 3, RIGHT * 3, color=SUBTLE, dash_length=0.15)

# Angle marker between two lines
line1 = Line(ORIGIN, RIGHT * 2)
line2 = Line(ORIGIN, UP * 2 + RIGHT)
angle = Angle(line1, line2, radius=0.5, color=YELLOW)
angle_label = angle.get_value()  # returns the angle in radians

# Right angle marker
right_angle = RightAngle(line1, Line(ORIGIN, UP * 2), length=0.3, color=WHITE)
``​`

## Boolean Operations (CSG)

Combine, subtract, or intersect 2D shapes:

``​`python
circle = Circle(radius=1.5, color=BLUE, fill_opacity=0.5).shift(LEFT * 0.5)
square = Square(side_length=2, color=RED, fill_opacity=0.5).shift(RIGHT * 0.5)

# Union, Intersection, Difference, Exclusion
union = Union(circle, square, color=GREEN, fill_opacity=0.5)
intersect = Intersection(circle, square, color=YELLOW, fill_opacity=0.5)
diff = Difference(circle, square, color=PURPLE, fill_opacity=0.5)
exclude = Exclusion(circle, square, color=ORANGE, fill_opacity=0.5)
``​`

Use cases: Venn diagrams, set theory, geometric proofs, area calculations.

## LabeledArrow / LabeledLine

``​`python
# Arrow with built-in label (auto-positioned)
arr = LabeledArrow(Text("force", font_size=18), start=LEFT, end=RIGHT, color=RED)

# Line with label
line = LabeledLine(Text("d = 5m", font_size=18), start=LEFT * 2, end=RIGHT * 2)
``​`

Auto-handles label positioning — cleaner than manual `Arrow` + `Text().next_to()`.

## Text Color/Font/Style Per-Substring (t2c, t2f, t2s, t2w)

``​`python
# Color specific words (t2c = text-to-color)
text = Text(
    "Gradient descent minimizes the loss function",
    t2c={"Gradient descent": BLUE, "loss function": RED}
)

# Different fonts per word (t2f = text-to-font)
text = Text(
    "Use Menlo for code and Inter for prose",
    t2f={"Menlo": "Menlo", "Inter": "Inter"}
)

# Italic/slant per word (t2s = text-to-slant)
text = Text("Normal and italic text", t2s={"italic": ITALIC})

# Bold per word (t2w = text-to-weight)
text = Text("Normal and bold text", t2w={"bold": BOLD})
``​`

These are much cleaner than creating separate Text objects and grouping them.

## Backstroke for Readability Over Backgrounds

When text overlaps other content (graphs, diagrams, images), add a dark stroke behind it:

``​`python
# CE syntax:
label.set_stroke(BLACK, width=5, background=True)

# Apply to a group
for mob in labels:
    mob.set_stroke(BLACK, width=4, background=True)
``​`

This is how 3Blue1Brown keeps text readable over complex backgrounds without using BackgroundRectangle.

## Complex Function Transforms

Apply complex functions to entire mobjects — transforms the plane:

``​`python
c_grid = ComplexPlane()
moving_grid = c_grid.copy()
moving_grid.prepare_for_nonlinear_transform()  # adds more sample points for smooth deformation

self.play(
    moving_grid.animate.apply_complex_function(lambda z: z**2),
    run_time=5,
)

# Also works with R3->R3 functions:
self.play(grid.animate.apply_function(
    lambda p: [p[0] + 0.5 * math.sin(p[1]), p[1] + 0.5 * math.sin(p[0]), p[2]]
), run_time=5)
``​`

**Critical:** Call `prepare_for_nonlinear_transform()` before applying nonlinear functions — without it, the grid has too few sample points and the deformation looks jagged.
```



### `Skills/manim-video/references/paper-explainer.md`

```markdown
# Paper Explainer Workflow

How to turn a research paper into an animated explainer video.

## Why animate a paper?

A research paper is optimized for precision and completeness. A video is optimized for understanding and retention. The translation is NOT "read the paper aloud with pictures" — it's "extract the core insight and make it feel obvious through visual storytelling."

The paper has one job: prove the claim is true. The video has a different job: make the viewer understand WHY the claim is true, and WHY it matters.

## Who is watching?

Before anything, decide the audience:

| Audience | Prerequisites | Pacing | Depth |
|----------|--------------|--------|-------|
| General public | None | Slow, many analogies | Intuition only, skip proofs |
| Undergrad students | Basic math/CS | Medium, some formalism | Key equations, skip derivations |
| Grad students / researchers | Domain knowledge | Faster, more notation | Full equations, sketch proofs |

This determines everything: vocabulary, pacing, which sections to animate, how much math to show.

## The 5-minute template

Most paper explainers fit this structure (scale times proportionally for longer videos):

| Section | Duration | Purpose |
|---------|----------|---------|
| **Hook** | 0:00-0:30 | Surprising result or provocative question |
| **Problem** | 0:30-1:30 | What was broken/missing before this paper |
| **Key insight** | 1:30-3:00 | The core idea, explained visually |
| **How it works** | 3:00-4:00 | Method/algorithm, simplified |
| **Evidence** | 4:00-4:30 | Key result that proves it works |
| **Implications** | 4:30-5:00 | Why it matters, what it enables |

### What to skip

- Related work survey → one sentence: "Previous approaches did X, which had problem Y"
- Implementation details → skip unless they're the contribution
- Ablation studies → show one chart at most
- Proofs → show the key step, not the full proof
- Hyperparameter tuning → skip entirely

### What to expand

- The core insight → this gets the most screen time
- Geometric/visual intuition → if the paper has math, show what it MEANS
- Before/after comparison → the most compelling evidence

## Pre-code workflow

### Gate 1: Narration script

Write the full narration before any code. Every sentence maps to a visual beat. If you can't write the narration, you don't understand the paper well enough to animate it.

``​`markdown
## Hook (30s)
"What if I told you that a model with 7 billion parameters can outperform
one with 70 billion — if you train it on the right data?"

## Problem (60s)
"The standard approach is to scale up. More parameters, more compute.
[VISUAL: bar chart showing model sizes growing exponentially]
But Chinchilla showed us that most models are undertrained..."
``​`

### Gate 2: Scene list

After the narration, break it into scenes. Each scene is one Manim class.

``​`markdown
Scene 1: Hook — surprising stat with animated counter
Scene 2: Problem — model size bar chart growing
Scene 3: Key insight — training data vs parameters, animated 2D plot
Scene 4: Method — pipeline diagram building left to right
Scene 5: Results — before/after comparison with animated bars
Scene 6: Closing — implications text
``​`

### Gate 3: Style constants

Before coding scenes, define the visual language:

``​`python
# style.py — import in every scene file
BG = "#0D1117"
PRIMARY = "#58C4DD"
SECONDARY = "#83C167"
ACCENT = "#FFFF00"
HIGHLIGHT = "#FF6B6B"
MONO = "Menlo"

# Color meanings for THIS paper
MODEL_COLOR = PRIMARY      # "the model"
DATA_COLOR = SECONDARY     # "training data"
BASELINE_COLOR = HIGHLIGHT # "previous approach"
RESULT_COLOR = ACCENT      # "our result"
``​`

## First-principles equation explanation

When the paper has a key equation, don't just show it — build it from intuition:

### The "what would you do?" pattern

1. Pose the problem in plain language
2. Ask what the simplest solution would be
3. Show why it doesn't work (animate the failure)
4. Introduce the paper's solution as the fix
5. THEN show the equation — it now feels earned

``​`python
# Scene: Why we need attention (for a Transformer paper)
# Step 1: "How do we let each word look at every other word?"
# Step 2: Show naive approach (fully connected = O(n²) everything)
# Step 3: Show it breaks (information overload, no selectivity)
# Step 4: "What if each word could CHOOSE which words to attend to?"
# Step 5: Show attention equation — Q, K, V now mean something
``​`

### Equation reveal strategy

``​`python
# Show equation dimmed first (full destination)
eq = MathTex(r"Attention(Q,K,V) = softmax\left(\frac{QK^T}{\sqrt{d_k}}\right)V")
eq.set_opacity(0.15)
self.play(FadeIn(eq))

# Highlight Q, K, V one at a time with color + label
for part, color, label_text in [
    (r"Q", PRIMARY, "Query: what am I looking for?"),
    (r"K", SECONDARY, "Key: what do I contain?"),
    (r"V", ACCENT, "Value: what do I output?"),
]:
    eq.set_color_by_tex(part, color)
    label = Text(label_text, font_size=18, color=color, font=MONO)
    # position label, animate it, wait, then dim it
``​`

## Building architecture diagrams

### The progressive build pattern

Don't show the full architecture at once. Build it:

1. First component appears alone → explain
2. Arrow grows → "this feeds into..."
3. Second component appears → explain
4. Repeat until complete

``​`python
# Component factory
def make_box(label, color, width=2.0, height=0.8):
    box = RoundedRectangle(corner_radius=0.1, width=width, height=height,
                           color=color, fill_opacity=0.1, stroke_width=1.5)
    text = Text(label, font_size=18, font=MONO, color=color).move_to(box)
    return Group(box, text)

encoder = make_box("Encoder", PRIMARY)
decoder = make_box("Decoder", SECONDARY).next_to(encoder, RIGHT, buff=1.5)
arrow = Arrow(encoder.get_right(), decoder.get_left(), color=DIM, stroke_width=1.5)

self.play(FadeIn(encoder))
self.wait(1)  # explain encoder
self.play(GrowArrow(arrow))
self.play(FadeIn(decoder))
self.wait(1)  # explain decoder
``​`

### Data flow animation

After building the diagram, show data moving through it:

``​`python
# Dot traveling along the pipeline
data_dot = Dot(color=ACCENT, radius=0.1).move_to(encoder)
self.play(FadeIn(data_dot))
self.play(MoveAlongPath(data_dot, arrow), run_time=1)
self.play(data_dot.animate.move_to(decoder), run_time=0.5)
self.play(Flash(data_dot.get_center(), color=ACCENT), run_time=0.3)
``​`

## Animating results

### Bar chart comparison (most common)

``​`python
# Before/after bars
before_data = [45, 52, 38, 61]
after_data = [78, 85, 72, 91]
labels = ["Task A", "Task B", "Task C", "Task D"]

before_chart = BarChart(before_data, bar_names=labels,
    y_range=[0, 100, 20], bar_colors=[HIGHLIGHT]*4).scale(0.6).shift(LEFT*3)
after_chart = BarChart(after_data, bar_names=labels,
    y_range=[0, 100, 20], bar_colors=[SECONDARY]*4).scale(0.6).shift(RIGHT*3)

before_label = Text("Baseline", font_size=20, color=HIGHLIGHT, font=MONO)
after_label = Text("Ours", font_size=20, color=SECONDARY, font=MONO)

# Reveal baseline first, then ours (dramatic comparison)
self.play(Create(before_chart), FadeIn(before_label))
self.wait(1.5)
self.play(Create(after_chart), FadeIn(after_label))
self.wait(0.5)

# Highlight the improvement
improvement = Text("+35% avg", font_size=24, color=ACCENT, font=MONO)
self.play(FadeIn(improvement))
``​`

### Training curve (for ML papers)

``​`python
tracker = ValueTracker(0)
curve = always_redraw(lambda: axes.plot(
    lambda x: 1 - 0.8 * np.exp(-x / 3),
    x_range=[0, tracker.get_value()], color=PRIMARY
))
epoch_label = always_redraw(lambda: Text(
    f"Epoch {int(tracker.get_value())}", font_size=18, font=MONO
).to_corner(UR))

self.add(curve, epoch_label)
self.play(tracker.animate.set_value(10), run_time=5, rate_func=linear)
``​`

## Domain-specific patterns

### ML papers
- Show data flow through the model (animated pipeline)
- Training curves with `ValueTracker`
- Attention heatmaps as colored grids
- Embedding space as 2D scatter (PCA/t-SNE visualization)
- Loss landscape as 3D surface with gradient descent dot

### Physics/math papers
- Use `LinearTransformationScene` for linear algebra
- Vector fields with `ArrowVectorField` / `StreamLines`
- Phase spaces with `NumberPlane` + trajectories
- Wave equations with time-parameterized plots

### Systems/architecture papers
- Pipeline diagrams built progressively
- `ShowPassingFlash` for data flow along arrows
- `ZoomedScene` for zooming into components
- Before/after latency/throughput comparisons

## Common mistakes

1. **Trying to cover the whole paper.** A 5-minute video can explain ONE core insight well. Covering everything means explaining nothing.
2. **Reading the abstract as narration.** Academic writing is designed for readers, not listeners. Rewrite in conversational language.
3. **Showing notation without meaning.** Never show a symbol without first showing what it represents visually.
4. **Skipping the motivation.** Jumping straight to "here's our method" without showing why the problem matters. The Problem section is what makes the viewer care.
5. **Identical pacing throughout.** The hook and key insight need the most visual energy. The method section can be faster. Evidence should land with impact (pause after showing the big number).
```



### `Skills/manim-video/references/production-quality.md`

```markdown
# Production Quality Checklist

Standards and checks for ensuring animation output is publication-ready.

## Pre-Code Checklist

Before writing any Manim code:

- [ ] Narration script written with visual beats marked
- [ ] Scene list with purpose, duration, and layout for each
- [ ] Color palette defined with meaning assignments (`PRIMARY` = main concept, etc.)
- [ ] `MONO = "Menlo"` set as the font constant
- [ ] Target resolution and aspect ratio decided

## Text Quality

### Overlap prevention

``​`python
# RULE: buff >= 0.5 for edge text
label.to_edge(DOWN, buff=0.5)     # GOOD
label.to_edge(DOWN, buff=0.3)     # BAD — may clip

# RULE: FadeOut previous before adding new at same position
self.play(ReplacementTransform(note1, note2))  # GOOD
self.play(Write(note2))                          # BAD — overlaps note1

# RULE: Reduce font size for dense scenes
# When > 4 text elements visible, use font_size=20 not 28
``​`

### Width enforcement

Long text strings overflow the frame:

``​`python
# RULE: Set max width for any text that might be long
text = Text("This is a potentially long description", font_size=22, font=MONO)
if text.width > config.frame_width - 1.0:
    text.set_width(config.frame_width - 1.0)
``​`

### Font consistency

``​`python
# RULE: Define MONO once, use everywhere
MONO = "Menlo"

# WRONG: mixing fonts
Text("Title", font="Helvetica")
Text("Label", font="Arial")
Text("Code", font="Courier")

# RIGHT: one font
Text("Title", font=MONO, weight=BOLD, font_size=48)
Text("Label", font=MONO, font_size=20)
Text("Code", font=MONO, font_size=18)
``​`

## Spatial Layout

### The coordinate budget

The visible frame is approximately 14.2 wide × 8.0 tall (default 16:9). With mandatory margins:

``​`
Usable area: x ∈ [-6.5, 6.5], y ∈ [-3.5, 3.5]
Top title zone: y ∈ [2.5, 3.5]
Bottom note zone: y ∈ [-3.5, -2.5]
Main content: y ∈ [-2.5, 2.5], x ∈ [-6.0, 6.0]
``​`

### Fill the frame

Empty scenes look unfinished. If the main content is small, add context:
- A dimmed grid/axes behind the content
- A title/subtitle at the top
- A source citation at the bottom
- Decorative geometry at low opacity

### Maximum simultaneous elements

**Hard limit: 6 actively visible elements.** Beyond that, the viewer can't track everything. If you need more:
- Dim old elements to opacity 0.3
- Remove elements that have served their purpose
- Split into two scenes

## Animation Quality

### Variety audit

Check that no two consecutive scenes use the exact same:
- Animation type (if Scene 3 uses Write for everything, Scene 4 should use FadeIn or Create)
- Color emphasis (rotate through palette colors)
- Layout (center, left-right, grid — alternate)
- Pacing (if Scene 2 was slow and deliberate, Scene 3 can be faster)

### Tempo curve

A good video follows a tempo curve:

``​`
Slow ──→ Medium ──→ FAST (climax) ──→ Slow (conclusion)

Scene 1: Slow (introduction, setup)
Scene 2: Medium (building understanding)
Scene 3: Medium-Fast (core content, lots of animation)
Scene 4: FAST (montage of applications/results)
Scene 5: Slow (conclusion, key takeaway)
``​`

### Transition quality

Between scenes:
- **Clean exit**: `self.play(FadeOut(Group(*self.mobjects)), run_time=0.5)`
- **Brief pause**: `self.wait(0.3)` after fadeout, before next scene's first animation
- **Never hard-cut**: always animate the transition

## Color Quality

### Dimming on dark backgrounds

Colors that look vibrant on white look muddy on dark backgrounds (#0D1117, #1C1C1C). Test your palette:

``​`python
# Colors that work well on dark backgrounds:
# Bright and saturated: #58C4DD, #83C167, #FFFF00, #FF6B6B
# Colors that DON'T work: #666666 (invisible), #2244AA (too dark)

# RULE: Structural elements (axes, grids) at opacity 0.15
# Context elements at 0.3-0.4
# Primary elements at 1.0
``​`

### Color meaning consistency

Once a color is assigned a meaning, it keeps that meaning for the entire video:

``​`python
# If PRIMARY (#58C4DD) means "the model" in Scene 1,
# it means "the model" in every scene.
# Never reuse PRIMARY for a different concept later.
``​`

## Data Visualization Quality

### Minimum requirements for charts

- Axis labels on every axis
- Y-axis range starts at 0 (or has a clear break indicator)
- Bar/line colors match the legend
- Numbers on notable data points (at least the maximum and the comparison point)

### Animated counters

When showing a number changing:
``​`python
# GOOD: DecimalNumber with smooth animation
counter = DecimalNumber(0, font_size=48, num_decimal_places=0, font="Menlo")
self.play(counter.animate.set_value(1000), run_time=3, rate_func=rush_from)

# BAD: Text that jumps between values
``​`

## Pre-Render Checklist

Before running `manim -qh`:

- [ ] All scenes render without errors at `-ql`
- [ ] Preview stills at `-qm` for text-heavy scenes (check kerning)
- [ ] Background color set in every scene (`self.camera.background_color = BG`)
- [ ] `add_subcaption()` or `subcaption=` on every significant animation
- [ ] No text smaller than font_size=18
- [ ] No text using proportional fonts (use monospace)
- [ ] buff >= 0.5 on all `.to_edge()` calls
- [ ] Clean exit (FadeOut all) at end of every scene
- [ ] `self.wait()` after every reveal
- [ ] Color constants used (no hardcoded hex strings in scene code)
- [ ] All scenes use the same quality flag (don't mix `-ql` and `-qh`)

## Post-Render Checklist

After stitching the final video:

- [ ] Watch the complete video at 1x speed — does it feel rushed anywhere?
- [ ] Is there a moment where two things animate simultaneously and it's confusing?
- [ ] Does every text label have enough time to be read?
- [ ] Are transitions between scenes smooth (no black frames, no jarring cuts)?
- [ ] Is the audio in sync with the visuals (if using voiceover)?
- [ ] Is the Gibbs-like "first impression" good? The first 5 seconds determine if someone keeps watching
```



### `Skills/manim-video/references/rendering.md`

```markdown
# Rendering Reference

## Prerequisites

``​`bash
manim --version       # Manim CE
pdflatex --version    # LaTeX
ffmpeg -version       # ffmpeg
``​`

## CLI Reference

``​`bash
manim -ql script.py Scene1 Scene2    # draft (480p 15fps)
manim -qm script.py Scene1           # medium (720p 30fps)
manim -qh script.py Scene1           # production (1080p 60fps)
manim -ql --format=png -s script.py Scene1  # preview still (last frame)
manim -ql --format=gif script.py Scene1     # GIF output
``​`

## Quality Presets

| Flag | Resolution | FPS | Use case |
|------|-----------|-----|----------|
| `-ql` | 854x480 | 15 | Draft iteration (layout, timing) |
| `-qm` | 1280x720 | 30 | Preview (use for text-heavy scenes) |
| `-qh` | 1920x1080 | 60 | Production |

**Text rendering quality:** `-ql` (480p15) produces noticeably poor text kerning and readability. For scenes with significant text, preview stills at `-qm` to catch issues invisible at 480p. Use `-ql` only for testing layout and animation timing.

## Output Structure

``​`
media/videos/script/480p15/Scene1_Intro.mp4
media/images/script/Scene1_Intro.png  (from -s flag)
``​`

## Stitching with ffmpeg

``​`bash
cat > concat.txt << 'EOF'
file 'media/videos/script/480p15/Scene1_Intro.mp4'
file 'media/videos/script/480p15/Scene2_Core.mp4'
EOF
ffmpeg -y -f concat -safe 0 -i concat.txt -c copy final.mp4
``​`

## Add Voiceover

``​`bash
# Mux narration
ffmpeg -y -i final.mp4 -i narration.mp3 -c:v copy -c:a aac -b:a 192k -shortest final_narrated.mp4

# Concat per-scene audio first
cat > audio_concat.txt << 'EOF'
file 'audio/scene1.mp3'
file 'audio/scene2.mp3'
EOF
ffmpeg -y -f concat -safe 0 -i audio_concat.txt -c copy full_narration.mp3
``​`

## Add Background Music

``​`bash
ffmpeg -y -i final.mp4 -i music.mp3 \
  -filter_complex "[1:a]volume=0.15[bg];[0:a][bg]amix=inputs=2:duration=shortest" \
  -c:v copy final_with_music.mp4
``​`

## GIF Export

``​`bash
ffmpeg -y -i scene.mp4 \
  -vf "fps=15,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
  output.gif
``​`

## Aspect Ratios

``​`bash
manim -ql --resolution 1080,1920 script.py Scene  # 9:16 vertical
manim -ql --resolution 1080,1080 script.py Scene  # 1:1 square
``​`

## Render Workflow

1. Draft render all scenes at `-ql`
2. Preview stills at key moments (`-s`)
3. Fix and re-render only broken scenes
4. Stitch with ffmpeg
5. Review stitched output
6. Production render at `-qh`
7. Re-stitch + add audio

## manim.cfg — Project Configuration

Create `manim.cfg` in the project directory for per-project defaults:

``​`ini
[CLI]
quality = low_quality
preview = True
media_dir = ./media

[renderer]
background_color = #0D1117

[tex]
tex_template_file = custom_template.tex
``​`

This eliminates repetitive CLI flags and `self.camera.background_color` in every scene.

## Sections — Chapter Markers

Mark sections within a scene for organized output:

``​`python
class LongVideo(Scene):
    def construct(self):
        self.next_section("Introduction")
        # ... intro content ...

        self.next_section("Main Concept")
        # ... main content ...

        self.next_section("Conclusion")
        # ... closing ...
``​`

Render individual sections: `manim --save_sections script.py LongVideo`
This outputs separate video files per section — useful for long videos where you want to re-render only one part.

## manim-voiceover Plugin (Recommended for Narrated Videos)

The official `manim-voiceover` plugin integrates TTS directly into scene code, auto-syncing animation duration to voiceover length. This is significantly cleaner than the manual ffmpeg muxing approach above.

### Installation

``​`bash
pip install "manim-voiceover[elevenlabs]"
# Or for free/local TTS:
pip install "manim-voiceover[gtts]"    # Google TTS (free, lower quality)
pip install "manim-voiceover[azure]"   # Azure Cognitive Services
``​`

### Usage

``​`python
from manim import *
from manim_voiceover import VoiceoverScene
from manim_voiceover.services.elevenlabs import ElevenLabsService

class NarratedScene(VoiceoverScene):
    def construct(self):
        self.set_speech_service(ElevenLabsService(
            voice_name="Alice",
            model_id="eleven_multilingual_v2"
        ))

        # Voiceover auto-controls scene duration
        with self.voiceover(text="Here is a circle being drawn.") as tracker:
            self.play(Create(Circle()), run_time=tracker.duration)

        with self.voiceover(text="Now let's transform it into a square.") as tracker:
            self.play(Transform(circle, Square()), run_time=tracker.duration)
``​`

### Key Features

- `tracker.duration` — total voiceover duration in seconds
- `tracker.time_until_bookmark("mark1")` — sync specific animations to specific words
- Auto-generates subtitle `.srt` files
- Caches audio locally — re-renders don't re-generate TTS
- Works with: ElevenLabs, Azure, Google TTS, pyttsx3 (offline), and custom services

### Bookmarks for Precise Sync

``​`python
with self.voiceover(text='This is a <bookmark mark="circle"/>circle.') as tracker:
    self.wait_until_bookmark("circle")
    self.play(Create(Circle()), run_time=tracker.time_until_bookmark("circle", limit=1))
``​`

This is the recommended approach for any video with narration. The manual ffmpeg muxing workflow above is still useful for adding background music or post-production audio mixing.
```



### `Skills/manim-video/references/scene-planning.md`

```markdown
# Scene Planning Reference

## Narrative Arc Structures

### Discovery Arc (most common)
1. Hook -- pose a question or surprising result
2. Intuition -- build visual understanding
3. Formalize -- introduce the equation/algorithm
4. Reveal -- the "aha moment"
5. Extend -- implications or generalizations

### Problem-Solution Arc
1. Problem -- what's broken
2. Failed attempt -- obvious approach fails
3. Key insight -- the idea that works
4. Solution -- implement it
5. Result -- show improvement

### Comparison Arc
1. Setup -- introduce two approaches
2. Approach A -- how it works
3. Approach B -- how it works
4. Contrast -- differences
5. Verdict -- which is better

### Build-Up Arc (architecture/systems)
1. Component A -- first piece
2. Component B -- second piece
3. Connection -- how they interact
4. Scale -- add more pieces
5. Full picture -- zoom out

## Scene Transitions

### Clean Break (default)
``​`python
self.play(FadeOut(Group(*self.mobjects)), run_time=0.5)
self.wait(0.3)
``​`

### Carry-Forward
Keep one element, fade the rest. Next scene starts with it still on screen.

### Transform Bridge
End scene with a shape, start next scene by transforming it.

## Cross-Scene Consistency

``​`python
# Shared constants at file top
BG = "#1C1C1C"
PRIMARY = "#58C4DD"
SECONDARY = "#83C167"
ACCENT = "#FFFF00"
TITLE_SIZE = 48
BODY_SIZE = 30
LABEL_SIZE = 24
FAST = 0.8; NORMAL = 1.5; SLOW = 2.5
``​`

## Scene Checklist

- [ ] Background color set
- [ ] Subcaptions on every animation
- [ ] `self.wait()` after every reveal
- [ ] Text buff >= 0.5 for edge positioning
- [ ] No text overlap
- [ ] Color constants used (not hardcoded)
- [ ] Opacity layering applied
- [ ] Clean exit at scene end
- [ ] No more than 5-6 elements visible at once

## Duration Estimation

| Content | Duration |
|---------|----------|
| Title card | 3-5s |
| Concept introduction | 10-20s |
| Equation reveal | 15-25s |
| Algorithm step | 5-10s |
| Data comparison | 10-15s |
| "Aha moment" | 15-30s |
| Conclusion | 5-10s |

## Planning Template

``​`markdown
# [Video Title]

## Overview
- **Topic**: [Core concept]
- **Hook**: [Opening question]
- **Aha moment**: [Key insight]
- **Target audience**: [Prerequisites]
- **Length**: [seconds/minutes]
- **Resolution**: 480p (draft) / 1080p (final)

## Color Palette
- Background: #1C1C1C
- Primary: #58C4DD -- [purpose]
- Secondary: #83C167 -- [purpose]
- Accent: #FFFF00 -- [purpose]

## Arc: [Discovery / Problem-Solution / Comparison / Build-Up]

## Scene 1: [Name] (~Ns)
**Purpose**: [one sentence]
**Layout**: [FULL_CENTER / LEFT_RIGHT / GRID / PROGRESSIVE]

### Visual elements
- [Mobject: type, position, color]

### Animation sequence
1. [Animation] -- [what it reveals] (~Ns)

### Subtitle
"[text]"
``​`
```



### `Skills/manim-video/references/troubleshooting.md`

```markdown
# Troubleshooting

## LaTeX Errors

**Missing raw string** (the #1 error):
``​`python
# WRONG: MathTex("\\frac{1}{2}")  -- \\f is form-feed
# RIGHT: MathTex(r"\frac{1}{2}")
``​`

**Unbalanced braces**: `MathTex(r"\frac{1}{2")` -- missing closing brace.

**LaTeX not installed**: `which pdflatex` -- install texlive-full or mactex.

**Missing package**: Add to preamble:
``​`python
tex_template = TexTemplate()
tex_template.add_to_preamble(r"\usepackage{mathrsfs}")
MathTex(r"\mathscr{L}", tex_template=tex_template)
``​`

## VGroup TypeError

**Error:** `TypeError: Only values of type VMobject can be added as submobjects of VGroup`

**Cause:** `Text()` objects are `Mobject`, not `VMobject`. Mixing `Text` with shapes in a `VGroup` fails on Manim CE v0.20+.

``​`python
# WRONG: Text is not a VMobject
group = VGroup(circle, Text("Label"))

# RIGHT: use Group for mixed types
group = Group(circle, Text("Label"))

# RIGHT: VGroup is fine for shapes-only
shapes = VGroup(circle, square, arrow)

# RIGHT: MathTex IS a VMobject — VGroup works
equations = VGroup(MathTex(r"a"), MathTex(r"b"))
``​`

**Rule:** If the group contains any `Text()`, use `Group`. If it's all shapes or all `MathTex`, `VGroup` is fine.

**FadeOut everything:** Always use `Group(*self.mobjects)`, not `VGroup(*self.mobjects)`:
``​`python
self.play(FadeOut(Group(*self.mobjects)))  # safe for mixed types
``​`

## Group save_state() / restore() Not Supported

**Error:** `NotImplementedError: Please override in a child class.`

**Cause:** `Group.save_state()` and `Group.restore()` are not implemented in Manim CE v0.20+. Only `VGroup` and individual `Mobject` subclasses support save/restore.

``​`python
# WRONG: Group doesn't support save_state
group = Group(circle, Text("label"))
group.save_state()  # NotImplementedError!

# RIGHT: use FadeIn with shift/scale instead of save_state/restore
self.play(FadeIn(group, shift=UP * 0.3, scale=0.8))

# RIGHT: or save/restore on individual VMobjects
circle.save_state()
self.play(circle.animate.shift(RIGHT))
self.play(Restore(circle))
``​`

## letter_spacing Is Not a Valid Parameter

**Error:** `TypeError: Mobject.__init__() got an unexpected keyword argument 'letter_spacing'`

**Cause:** `Text()` does not accept `letter_spacing`. Manim uses Pango for text rendering and does not expose kerning controls on `Text()`.

``​`python
# WRONG
Text("HERMES", letter_spacing=6)

# RIGHT: use MarkupText with Pango attributes for spacing control
MarkupText('<span letter_spacing="6000">HERMES</span>', font_size=18)
# Note: Pango letter_spacing is in 1/1024 of a point
``​`

## Animation Errors

**Invisible animation** -- mobject never added:
``​`python
# WRONG: circle = Circle(); self.play(circle.animate.set_color(RED))
# RIGHT: self.play(Create(circle)); self.play(circle.animate.set_color(RED))
``​`

**Transform confusion** -- after Transform(A, B), A is on screen, B is not. Use ReplacementTransform if you want B.

**Duplicate animation** -- same mobject twice in one play():
``​`python
# WRONG: self.play(c.animate.shift(RIGHT), c.animate.set_color(RED))
# RIGHT: self.play(c.animate.shift(RIGHT).set_color(RED))
``​`

**Updater fights animation**:
``​`python
mob.suspend_updating()
self.play(mob.animate.shift(RIGHT))
mob.resume_updating()
``​`

## Rendering Issues

**Blurry output**: Using -ql (480p). Switch to -qm/-qh for final.

**Slow render**: Use -ql during development. Reduce Surface resolution. Shorter self.wait().

**Stale output**: `manim -ql --disable_caching script.py Scene`

**ffmpeg concat fails**: All clips must match resolution/FPS/codec.

## Common Mistakes

**Text clips at edge**: `buff >= 0.5` for `.to_edge()`

**Overlapping text**: Use `ReplacementTransform(old, new)`, not `Write(new)` on top.

**Too crowded**: Max 5-6 elements visible. Split into scenes or use opacity layering.

**No breathing room**: `self.wait(1.5)` minimum after reveals, `self.wait(2.0)` for key moments.

**Missing background color**: Set `self.camera.background_color = BG` in every scene.

## Debugging Strategy

1. Render a still: `manim -ql -s script.py Scene` -- instant layout check
2. Isolate the broken scene -- render only that one
3. Replace `self.play()` with `self.add()` to see final state instantly
4. Print positions: `print(mob.get_center())`
5. Clear cache: delete `media/` directory

## Edu-Video Patch Loop

When `render_manim_clip` fails in the edu-video pipeline, **patch the existing script** — do not call `generate_manim_script` again unless a full rewrite is truly needed.

1. Read this file and identify the error category from stderr
2. `read_file` the script at `script_path` returned by `generate_manim_script`
3. `write_file` a minimal fix — only the broken lines/blocks
4. Re-render with `render_manim_clip` using `script_path` (not inline script)

**Patch by default:** LaTeX/raw-string, VGroup/Group, Text kwargs, missing waits, localized tracebacks.

**Full regen only after 3 patch cycles:** structurally wrong script, empty construct, or errors spanning most of the file.
```



### `Skills/manim-video/references/updaters-and-trackers.md`

```markdown
# Updaters and Value Trackers

## The problem updaters solve

Normal animations are discrete: `self.play()` goes from state A to state B. But what if you need continuous relationships — a label that always hovers above a moving dot, or a line that always connects two points?

Without updaters, you'd manually reposition every dependent object before every `self.play()`. Five animations that move a dot means five manual repositioning calls for the label. Miss one and it freezes in the wrong spot.

Updaters let you declare a relationship ONCE. Manim calls the updater function EVERY FRAME (15-60 fps depending on quality) to enforce that relationship, no matter what else is happening.

## ValueTracker: an invisible steering wheel

A ValueTracker is an invisible Mobject that holds a single float. It never appears on screen. It exists so you can ANIMATE it while other objects REACT to its value.

Think of it as a slider: drag the slider from 0 to 5, and every object wired to it responds in real time.

``​`python
tracker = ValueTracker(0)        # invisible, stores 0.0
tracker.get_value()              # read: 0.0
tracker.set_value(5)             # write: jump to 5.0 instantly
tracker.animate.set_value(5)     # animate: smoothly interpolate to 5.0
``​`

### The three-step pattern

Every ValueTracker usage follows this:

1. **Create the tracker** (the invisible slider)
2. **Create visible objects that READ the tracker** via updaters
3. **Animate the tracker** — all dependents update automatically

``​`python
# Step 1: Create tracker
x_tracker = ValueTracker(1)

# Step 2: Create dependent objects
dot = always_redraw(lambda: Dot(axes.c2p(x_tracker.get_value(), 0), color=YELLOW))
v_line = always_redraw(lambda: axes.get_vertical_line(
    axes.c2p(x_tracker.get_value(), func(x_tracker.get_value())), color=BLUE
))
label = always_redraw(lambda: DecimalNumber(x_tracker.get_value(), font_size=24)
    .next_to(dot, UP))

self.add(dot, v_line, label)

# Step 3: Animate the tracker — everything follows
self.play(x_tracker.animate.set_value(5), run_time=3)
``​`

## Types of updaters

### Lambda updater (most common)

Runs a function every frame, passing the mobject itself:

``​`python
# Label always stays above the dot
label.add_updater(lambda m: m.next_to(dot, UP, buff=0.2))

# Line always connects two points
line.add_updater(lambda m: m.put_start_and_end_on(
    point_a.get_center(), point_b.get_center()
))
``​`

### Time-based updater (with dt)

The second argument `dt` is the time since the last frame (~0.017s at 60fps):

``​`python
# Continuous rotation
square.add_updater(lambda m, dt: m.rotate(0.5 * dt))

# Continuous rightward drift
dot.add_updater(lambda m, dt: m.shift(RIGHT * 0.3 * dt))

# Oscillation
dot.add_updater(lambda m, dt: m.move_to(
    axes.c2p(m.get_center()[0], np.sin(self.time))
))
``​`

Use `dt` updaters for physics simulations, continuous motion, and time-dependent effects.

### always_redraw: full rebuild every frame

Creates a new mobject from scratch each frame. More expensive than `add_updater` but handles cases where the mobject's structure changes (not just position/color):

``​`python
# Brace that follows a resizing square
brace = always_redraw(Brace, square, UP)

# Area under curve that updates as function changes
area = always_redraw(lambda: axes.get_area(
    graph, x_range=[0, x_tracker.get_value()], color=BLUE, opacity=0.3
))

# Label that reconstructs its text
counter = always_redraw(lambda: Text(
    f"n = {int(x_tracker.get_value())}", font_size=24, font="Menlo"
).to_corner(UR))
``​`

**When to use which:**
- `add_updater` — position, color, opacity changes (cheap, preferred)
- `always_redraw` — when the shape/structure itself changes (expensive, use sparingly)

## DecimalNumber: showing live values

``​`python
# Counter that tracks a ValueTracker
tracker = ValueTracker(0)
number = DecimalNumber(0, font_size=48, num_decimal_places=1, color=PRIMARY)
number.add_updater(lambda m: m.set_value(tracker.get_value()))
number.add_updater(lambda m: m.next_to(dot, RIGHT, buff=0.3))

self.add(number)
self.play(tracker.animate.set_value(100), run_time=3)
``​`

### Variable: the labeled version

``​`python
var = Variable(0, Text("x", font_size=24, font="Menlo"), num_decimal_places=2)
self.add(var)
self.play(var.tracker.animate.set_value(PI), run_time=2)
# Displays: x = 3.14
``​`

## Removing updaters

``​`python
# Remove all updaters
mobject.clear_updaters()

# Suspend temporarily (during an animation that would fight the updater)
mobject.suspend_updating()
self.play(mobject.animate.shift(RIGHT))
mobject.resume_updating()

# Remove specific updater (if you stored a reference)
def my_updater(m):
    m.next_to(dot, UP)
label.add_updater(my_updater)
# ... later ...
label.remove_updater(my_updater)
``​`

## Animation-based updaters

### UpdateFromFunc / UpdateFromAlphaFunc

These are ANIMATIONS (passed to `self.play`), not persistent updaters:

``​`python
# Call a function on each frame of the animation
self.play(UpdateFromFunc(mobject, lambda m: m.next_to(moving_target, UP)), run_time=3)

# With alpha (0 to 1) — useful for custom interpolation
self.play(UpdateFromAlphaFunc(circle, lambda m, a: m.set_fill(opacity=a)), run_time=2)
``​`

### turn_animation_into_updater

Convert a one-shot animation into a continuous updater:

``​`python
from manim import turn_animation_into_updater

# This would normally play once — now it loops forever
turn_animation_into_updater(Rotating(gear, rate=PI/4))
self.add(gear)
self.wait(5)  # gear rotates for 5 seconds
``​`

## Practical patterns

### Pattern 1: Dot tracing a function

``​`python
tracker = ValueTracker(0)
graph = axes.plot(np.sin, x_range=[0, 2*PI], color=PRIMARY)
dot = always_redraw(lambda: Dot(
    axes.c2p(tracker.get_value(), np.sin(tracker.get_value())),
    color=YELLOW
))
tangent = always_redraw(lambda: axes.get_secant_slope_group(
    x=tracker.get_value(), graph=graph, dx=0.01,
    secant_line_color=HIGHLIGHT, secant_line_length=3
))

self.add(graph, dot, tangent)
self.play(tracker.animate.set_value(2*PI), run_time=6, rate_func=linear)
``​`

### Pattern 2: Live area under curve

``​`python
tracker = ValueTracker(0.5)
area = always_redraw(lambda: axes.get_area(
    graph, x_range=[0, tracker.get_value()],
    color=PRIMARY, opacity=0.3
))
area_label = always_redraw(lambda: DecimalNumber(
    # Numerical integration
    sum(func(x) * 0.01 for x in np.arange(0, tracker.get_value(), 0.01)),
    font_size=24
).next_to(axes, RIGHT))

self.add(area, area_label)
self.play(tracker.animate.set_value(4), run_time=5)
``​`

### Pattern 3: Connected diagram

``​`python
# Nodes that can be moved, with edges that auto-follow
node_a = Dot(LEFT * 2, color=PRIMARY)
node_b = Dot(RIGHT * 2, color=SECONDARY)
edge = Line().add_updater(lambda m: m.put_start_and_end_on(
    node_a.get_center(), node_b.get_center()
))
label = Text("edge", font_size=18, font="Menlo").add_updater(
    lambda m: m.move_to(edge.get_center() + UP * 0.3)
)

self.add(node_a, node_b, edge, label)
self.play(node_a.animate.shift(UP * 2), run_time=2)
self.play(node_b.animate.shift(DOWN + RIGHT), run_time=2)
# Edge and label follow automatically
``​`

### Pattern 4: Parameter exploration

``​`python
# Explore how a parameter changes a curve
a_tracker = ValueTracker(1)
curve = always_redraw(lambda: axes.plot(
    lambda x: a_tracker.get_value() * np.sin(x),
    x_range=[0, 2*PI], color=PRIMARY
))
param_label = always_redraw(lambda: Text(
    f"a = {a_tracker.get_value():.1f}", font_size=24, font="Menlo"
).to_corner(UR))

self.add(curve, param_label)
self.play(a_tracker.animate.set_value(3), run_time=3)
self.play(a_tracker.animate.set_value(0.5), run_time=2)
self.play(a_tracker.animate.set_value(1), run_time=1)
``​`

## Common mistakes

1. **Updater fights animation:** If a mobject has an updater that sets its position, and you try to animate it elsewhere, the updater wins every frame. Suspend updating first.

2. **always_redraw for simple moves:** If you only need to reposition, use `add_updater`. `always_redraw` reconstructs the entire mobject every frame — expensive and unnecessary for position tracking.

3. **Forgetting to add to scene:** Updaters only run on mobjects that are in the scene. `always_redraw` creates the mobject but you still need `self.add()`.

4. **Updater creates new mobjects without cleanup:** If your updater creates Text objects every frame, they accumulate. Use `always_redraw` (which handles cleanup) or update properties in-place.
```



### `Skills/manim-video/references/visual-design.md`

```markdown
# Visual Design Principles

## 12 Core Principles

1. **Geometry Before Algebra** — Show the shape first, the equation second.
2. **Opacity Layering** — PRIMARY=1.0, CONTEXT=0.4, GRID=0.15. Direct attention through brightness.
3. **One New Idea Per Scene** — Each scene introduces exactly one concept.
4. **Spatial Consistency** — Same concept occupies the same screen region throughout.
5. **Color = Meaning** — Assign colors to concepts, not mobjects. If velocity is blue, it stays blue.
6. **Progressive Disclosure** — Show simplest version first, add complexity incrementally.
7. **Transform, Don't Replace** — Use Transform/ReplacementTransform to show connections.
8. **Breathing Room** — `self.wait(1.5)` minimum after showing something new.
9. **Visual Weight Balance** — Don't cluster everything on one side.
10. **Consistent Motion Vocabulary** — Pick a small set of animation types and reuse them.
11. **Dark Background, Light Content** — #1C1C1C to #2D2B55 backgrounds maximize contrast.
12. **Intentional Empty Space** — Leave at least 15% of the frame empty.

## Layout Templates

### FULL_CENTER
One main element centered, title above, note below.
Best for: single equations, single diagrams, title cards.

### LEFT_RIGHT
Two elements side by side at x=-3.5 and x=3.5.
Best for: equation + visual, before/after, comparison.

### TOP_BOTTOM
Main element at y=1.5, supporting content at y=-1.5.
Best for: concept + examples, theorem + cases.

### GRID
Multiple elements via `arrange_in_grid()`.
Best for: comparison matrices, multi-step processes.

### PROGRESSIVE
Elements appear one at a time, arranged DOWN with aligned_edge=LEFT.
Best for: algorithms, proofs, step-by-step processes.

### ANNOTATED_DIAGRAM
Central diagram with floating labels connected by arrows.
Best for: architecture diagrams, annotated figures.

## Color Palettes

### Classic 3B1B
``​`python
BG="#1C1C1C"; PRIMARY=BLUE; SECONDARY=GREEN; ACCENT=YELLOW; HIGHLIGHT=RED
``​`

### Warm Academic
``​`python
BG="#2D2B55"; PRIMARY="#FF6B6B"; SECONDARY="#FFD93D"; ACCENT="#6BCB77"
``​`

### Neon Tech
``​`python
BG="#0A0A0A"; PRIMARY="#00F5FF"; SECONDARY="#FF00FF"; ACCENT="#39FF14"
``​`

## Font Selection

**Use monospace fonts for all text.** Manim's Pango text renderer produces broken kerning with proportional fonts (Helvetica, Inter, SF Pro, Arial) at all sizes and resolutions. Characters overlap and spacing is inconsistent. This is a fundamental Pango limitation, not a Manim bug.

Monospace fonts have fixed character widths — zero kerning issues by design.

### Recommended Fonts

| Use case | Font | Fallback |
|----------|------|----------|
| **All text (default)** | `"Menlo"` | `"Courier New"`, `"DejaVu Sans Mono"` |
| Code, labels | `"JetBrains Mono"`, `"SF Mono"` | `"Menlo"` |
| Math | Use `MathTex` (renders via LaTeX, not Pango) | — |

``​`python
MONO = "Menlo"  # define once at top of file

title = Text("Fourier Series", font_size=48, color=PRIMARY, weight=BOLD, font=MONO)
label = Text("n=1: (4/pi) sin(x)", font_size=20, color=BLUE, font=MONO)
note = Text("Convergence at discontinuities", font_size=18, color=DIM, font=MONO)

# Math — always use MathTex, not Text
equation = MathTex(r"\nabla L = \frac{\partial L}{\partial w}")
``​`

### When Proportional Fonts Are Acceptable

Large title text (font_size >= 48) with short strings (1-3 words) can use proportional fonts without visible kerning issues. For anything else — labels, descriptions, multi-word text, small sizes — use monospace.

### Font Availability

- **macOS**: Menlo (pre-installed), SF Mono
- **Linux**: DejaVu Sans Mono (pre-installed), Liberation Mono
- **Cross-platform**: JetBrains Mono (install from jetbrains.com)

`"Menlo"` is the safest default — pre-installed on macOS, and Linux systems fall back to DejaVu Sans Mono.

### Fine-Grained Text Control

`Text()` does not support `letter_spacing` or kerning parameters. For fine control, use `MarkupText` with Pango attributes:

``​`python
# Letter spacing (Pango units: 1/1024 of a point)
MarkupText('<span letter_spacing="6000">HERMES</span>', font_size=18, font="Menlo")

# Bold specific words
MarkupText('This is <b>important</b>', font_size=24, font="Menlo")

# Color specific words
MarkupText('Red <span foreground="#FF6B6B">warning</span>', font_size=24, font="Menlo")
``​`

### Minimum Font Size

`font_size=18` is the minimum for readable text at any resolution. Below 18, characters become blurry at `-ql` and barely readable even at `-qh`.

## Visual Hierarchy Checklist

For every frame:
1. What is the ONE thing to look at? (brightest/largest)
2. What is context? (dimmed to 0.3-0.4)
3. What is structural? (dimmed to 0.15)
4. Enough empty space? (>15%)
5. All text readable at phone size?
```



### `Skills/manim-video/scripts/setup.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
G="\033[0;32m"; R="\033[0;31m"; N="\033[0m"
ok() { echo -e "  ${G}+${N} $1"; }
fail() { echo -e "  ${R}x${N} $1"; }
echo ""; echo "Manim Video Skill — Setup Check"; echo ""
errors=0
command -v python3 &>/dev/null && ok "Python $(python3 --version 2>&1 | awk '{print $2}')" || { fail "Python 3 not found"; errors=$((errors+1)); }
python3 -c "import manim" 2>/dev/null && ok "Manim $(manim --version 2>&1 | head -1)" || { fail "Manim not installed: pip install manim"; errors=$((errors+1)); }
command -v pdflatex &>/dev/null && ok "LaTeX (pdflatex)" || { fail "LaTeX not found (macOS: brew install --cask mactex-no-gui)"; errors=$((errors+1)); }
command -v ffmpeg &>/dev/null && ok "ffmpeg" || { fail "ffmpeg not found"; errors=$((errors+1)); }
echo ""
[ $errors -eq 0 ] && echo -e "${G}All prerequisites satisfied.${N}" || echo -e "${R}$errors prerequisite(s) missing.${N}"
echo ""
```

