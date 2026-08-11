# Edu-Video Edit Requests

Local session files (transcript, manim scripts, hf-project) are restored from Firebase Storage automatically when missing on disk. **Never ask the user to re-upload** if this session already has Storage assets. Only ask for a new upload when a tool reports nothing stored for that session (cold session / empty Storage).

Identify which phase is affected. Re-run only from that phase forward. Never restart the full pipeline.

## General edit methodology

Universal loop for every edit (listed playbook or not):

1. `read_file("{project_dir}/COMPOSITION_MANIFEST.json")` — file map and current values (restores hf-project from Storage if needed). If missing, `search_files(directory: project_dir, pattern: "*.html")`.
2. `read_file` the real target file before patching — the manifest is write-once and can be stale; never trust cached values over the file.
3. Apply the smallest correct patch (`write_file`, or the minimal tool sequence for that change).
4. `render_hyperframes` to re-render.
5. Verify an output frame from the new draft before claiming success — do not rely on render-success alone.

**Hard rules:**

- Never `run_command` / ffmpeg / curl for composition-affecting ops (format, resolution, re-encode, orientation, draft-video edits). Use pipeline tools (`scaffold_hf_project`, `render_hyperframes`, …) or `ask_clarification` with choices grounded in real tools — never invent a shell workaround. Unlisted request types still follow this methodology on the logically involved files.
- After Manim re-renders: `render_manim_clip` → `scaffold_hf_project` → `render_hyperframes`. Do not bypass scaffold by hand-patching HF HTML and reusing the old `composition_url`.
- `ask_clarification` only for unclear intent — not because a playbook is missing.
- Always verify a frame before claiming the edit is visible.



## Speaker position edits

"move speaker to top right" / "make speaker smaller" / "circular frame" / "center the video" / "corner":

- Read manifest `speaker.presets` for named presets: FS, PIP_MANIM, TOP_RIGHT, CENTER, CIRCLE
- `read_file("{project_dir}/index.html")` to see current GSAP tween calls
- `write_file` to patch `tl.set('#speaker-wrap', ...)` and `tl.to('#speaker-wrap', ...)` in index.html
- `render_hyperframes`
- Verify a frame before claiming success



## Caption style edits

"bigger captions" / "different color" / "move captions up" / "smaller text":

- Read manifest `captions.current` for current font_size, color, position_bottom values
- `write_file` to patch those values in `compositions/captions-overlay.html`
- `render_hyperframes`
- Verify a frame before claiming success



## Segment edits

"add an animation at 30s" / "remove the last animation" / "regenerate that concept" / "shift the clip boundaries":

- **Add concept:** `generate_manim_script` + `render_manim_clip` for the new concept → `plan_segments` with updated clip list → `scaffold_hf_project` → `render_hyperframes`
- **Remove concept:** drop it from `manim_clips[]` → re-`plan_segments` → re-`scaffold_hf_project` → `render_hyperframes`
- **Regen one concept:** `generate_manim_script` + `render_manim_clip` for that concept only → update clip list → re-`plan_segments` → re-`scaffold_hf_project` → `render_hyperframes`
- **Retime boundaries:** adjust start/end on the clip → re-`plan_segments` → re-`scaffold_hf_project` if wiring changes → `render_hyperframes`
- After any `render_manim_clip`, always re-`scaffold_hf_project` then `render_hyperframes` with the **new** `composition_url` from that scaffold. Never hand-patch generated project files as a substitute for re-scaffold after Manim changes (speaker-position / caption-style playbooks remain valid for those edits). If scaffold errors, fix and retry scaffold — do not `render_hyperframes` on the previous `composition_url`.
- Verify a frame before claiming success



## Brand/color edits

"change the accent color" / "use red instead of blue":

- **Data-loss warning:** re-`scaffold_hf_project` regenerates the whole project from templates and **silently discards** prior hand edits (overlays, caption style, custom speaker position). Before re-scaffolding for a brand change, inspect for prior hand edits and reconcile/reapply them — or warn the user — then proceed.
- `scaffold_hf_project` with updated brand_colors
- `render_hyperframes`
- Verify a frame before claiming success



## Orientation edits

"make it vertical" / "make this into horizontal video" / "make this into vertical video" / "switch to 9:16" / "change to horizontal" / "portrait instead":

- **Reuse by default:** wipe + re-`scaffold_hf_project` with the matching orientation template; pass existing session Manim `clip_url`s (object-fit: contain). Do **not** auto-regen every Manim clip.
- **Data-loss warning:** re-scaffold discards hand edits (overlays, caption style, custom speaker GSAP). Warn the user. When Gate B (`confirm_overwrite_hand_edits`) exists, require it before overwrite.
- Persist the new orientation on the session via `scaffold_hf_project({ orientation })`. `render_hyperframes` hard-throws if HTML stage size ≠ session orientation — do not patch meta/CSS alone.
- Relay `manim_fit_note` from the render tool return if present (soft letterbox/pillarbox warning).
- **Cramped after contain:** regenerate only that single concept with the new `orientation` arg, then re-scaffold that clip — never batch-regen by default.
- `scaffold_hf_project` / `restore_generation` refuse while `renderStatus === RUNNING` (do not wipe mid-flight).
- Verify a frame before claiming success.



## Restore a tagged past final

`@final_2` / tagged `draft_video` then edit:

- Call `restore_generation({ asset_id })` first — reconstructs the live project from the **full scaffold recipe** snapshotted onto that draft (orientation, speaker URLs, manim clips, transcript words, segments plan).
- Then apply the content edit (captions, speaker, etc.) and/or the orientation rebuild playbook if the user also asked to switch aspect.
- Combined (`@final_2` + "make vertical"): `restore_generation` → orientation rebuild playbook → remaining content edits → `render_hyperframes`.
- Incomplete / pre-snapshot metadata → tool throws honestly — do not fall back to the live session speaker, latest Manim pointers, or live `hf_segments/plan`.
- Does not auto-render; call `render_hyperframes` after edits.



## Timed image overlay edits

"put this image at 15–25s" / "overlay the graphic in the top right" / "show the background image from 10s to 20s" / "add the generated image on screen" / "remove the overlay" / "move the overlay" / "make the overlay bigger":

- `read_file` `index.html`; revising same overlay → update in place; new additional overlay → unique id (e.g. `#bg-overlay-2`) — no duplicates
- Place image under project `assets/` (e.g. `assets/background-<id>.png`); never invent `capture/assets/` or other folders
- If no overlay yet: add CSS (absolute from position below, ~280×280 default, optional `border-radius`/`box-shadow`, `z-index` above speaker, `opacity: 0`, `pointer-events: none`) plus `<div id="bg-overlay"><img src="assets/..."></div>` above the speaker video
- Add/update GSAP root-timeline tween: fade in at start, fade out at end; ~0.3–0.4s ease buffer OK unless hard cuts requested
- **Remove:** delete the overlay div and its GSAP tween(s) from `index.html`
- **Move / resize:** adjust existing CSS position/size and/or tween values in place — no new overlay id
- `render_hyperframes` with composition URL
- Before claiming visible: inspect a frame from the new draft inside the overlay window (or confirm absence after remove) — do not rely on render-success or source-image checks alone
- Position defaults: top/bottom × left/right at `24px` margins; size ~280×280
- `index.html` is source of truth; no `COMPOSITION_MANIFEST.json` update required

