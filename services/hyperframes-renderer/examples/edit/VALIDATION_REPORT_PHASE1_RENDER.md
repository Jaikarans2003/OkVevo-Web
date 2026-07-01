# Phase 1 local validation — timeline + deterministic render

**Date:** 2026-05-14  
**Upstream:** `references/video-use` helpers (source of truth; no architecture changes).  
**Asset:** `OKVEVO/services/hyperframes/examples/Demo.mp4`  
**Transcript:** pre-validated `edit/transcripts/Demo.json` + `edit/takes_packed.md`

---

## 1. Upstream script behavior (summary)

### `timeline_view.py`

- **Inputs:** video path, `start`, `end`, optional `--transcript`, `--n-frames`, `-o`.
- **Pipeline:** FFmpeg extracts N JPEG stills (`-ss` before `-i`, `scale=320:-2`) → PIL canvas: filmstrip, RMS **waveform** from mono 16 kHz PCM (no librosa hard dependency), optional **silence shading** (`find_silences`, default **≥0.4 s** between non-spacing tokens), word tick labels, time ruler.
- **Output:** PNG (default `edit/verify/` or explicit `-o`).
- **Constraint:** `--edl` full-project mode is **not implemented** (exits with error).

### `render.py`

- **EDL:** JSON `version`, `sources` (map logical name → path; relative paths resolved from **directory containing `edl.json`**), `ranges` (`source`, `start`, `end`, optional metadata), `grade`, `overlays`, optional `subtitles`.
- **Order:** (1) **Per-segment extract** with `-ss` before `-i`, optional HDR tonemap, scale to 1080p (portrait-aware), **grade**, **30 ms `afade` in/out**, libx264, **`-r 24`**, AAC 48 kHz. (2) **Concat demuxer** `-f concat -c copy` → `base.mp4`. (3) Optional **`build_master_srt`** → `master.srt`. (4) **`build_final_composite`**: overlays with `setpts` + `overlay`; **`subtitles` filter last** (Rule 1). (5) Unless `--no-loudnorm`, **two-pass loudnorm** to ~−14 LUFS (preview/draft uses faster path).

### `grade.py`

- **Presets:** `subtle`, `neutral_punch`, `warm_cinematic`, `none`.
- **Auto:** `_sample_frame_stats` via FFmpeg `signalstats` + `metadata=print`; bounded `eq` contrast/gamma/saturation (imported by `render.py` for `grade: "auto"` per segment).

### `pack_transcripts.py` (context)

- Already validated: phrase breaks on **≥0.5 s** silence or speaker change; drives **word-safe** EDL anchors used below.

---

## 2. EDL used for this run (`edit/edl.json`)

- **6 ranges** on source `Demo`, absolute path to `Demo.mp4`.
- **Silence trimming / jump cuts:** ranges follow packed phrase boundaries; inter-phrase gaps (e.g. 2.62→3.48, 5.48→6.78, 12.32→13.30, 13.80→14.44) are **omitted** from the timeline → shorter, creator-style pacing.
- **`grade`:** `"auto"` (per-segment analysis).
- **`overlays`:** `[]` (overlay pipeline not exercised; concat + subs + loudnorm only).
- **`total_duration_s`:** 10.76 (sum of range lengths).

---

## 3. Artifacts produced

| Artifact | Path |
|----------|------|
| Timeline (full) | `edit/visuals/timeline_full_0-17.png` |
| Timeline (hook window) | `edit/visuals/timeline_hook_0.5-4.5.png` |
| Timeline (outro window) | `edit/visuals/timeline_outro_10-17.png` |
| Timeline (**rendered** output, cut-adjacent window) | `edit/visuals/timeline_edited_cut1_1.5-3.2.png` |
| EDL | `edit/edl.json` |
| Graded segments | `edit/clips_graded/seg_00_Demo.mp4` … `seg_05_Demo.mp4` |
| Concat (lossless) | `edit/base.mp4` |
| Subtitles | `edit/master.srt` |
| Final output | **`edit/edited.mp4`** |
| ffprobe JSON | `edit/diagnostics/ffprobe_source.json`, `ffprobe_edited.json` |
| Grade analysis | `edit/diagnostics/grade_analyze_demo.txt` |
| Render log | `edit/diagnostics/render_timing.log` (includes `time` summary) |
| Statistics | `edit/diagnostics/edit_statistics.json` |

---

## 4. Validation results

| Check | Result |
|-------|--------|
| FFmpeg segment extract | **Pass** — 6 segments extracted with logged per-segment auto grade |
| Lossless concat | **Pass** — `concat → base.mp4`; `base` duration **10.854329 s** (ffprobe) |
| Subtitle generation | **Pass** — `master.srt` with **14** cues; 2-word / punctuation chunking; output-timeline times start at 0 |
| Subtitle burn order | **Pass** — compositing path used `subtitles` after video chain (no overlays); matches Rule 1 |
| Grading pipeline | **Pass** — all segments used same auto filter: `eq=contrast=1.030:saturation=1.040` |
| Loudness | **Pass** — two-pass loudnorm; measured prenorm **I ≈ −22.97 LUFS** → normalized to target |
| Render wall clock | **~29.5 s** (local; `time` in `render_timing.log`) |
| Timing vs EDL | **Nominal 10.76 s** vs **container 10.941 s** — see §5 |

---

## 5. Diagnostics — duration and A/V

- **Source:** ~**17.067 s** container; video ~60 fps variable (`avg_frame_rate` ≠ constant); audio ~48 kHz AAC (`ffprobe_source.json`).
- **Output:** container **10.941 s**; video stream **10.833333 s** @ **24/1** CFR; audio stream **10.941 s** (`ffprobe_edited.json`).
- **Interpretation:** Per-segment encode uses **`-r 24`**; summed segment *media* lengths land near **~10.85 s** (concat base). **~0.11 s** audio vs video stream mismatch after composite + loudnorm is worth monitoring on longer edits; acceptable for this Phase 1 proof.

---

## 6. Subtitle timing spot-check

First cue `I'M THE`: output **0.000–0.240 s** aligns with first words in segment 0 remapped from source **~0.979 s** (minus `seg_start` 0.98 + offset 0). Subsequent cues track EDL segment offsets through phrase 6.

---

## 7. Risks / follow-ups (no code changes in this task)

1. **CFR 24 fps** on extract may introduce small drift vs variable-fps source — document for long-form iPhone footage.
2. **`render.py` stderr** is discarded (`DEVNULL` / `PIPE` without save) — for deeper FFmpeg forensics, run isolated `ffmpeg` commands or a thin wrapper later (not changing upstream now).
3. **Self-eval** remains an **agent procedure** (SKILL.md): optionally run `timeline_view.py` on `edited.mp4` at each cut boundary for visual QC.

---

## 8. Conclusion

**Transcript → packed phrases → manual EDL → `render.py` → `edited.mp4` + `master.srt`** is validated locally for `Demo.mp4` with **multi-range silence trimming**, **auto grade**, **concat stability**, and **subtitle pipeline**. Ready for the next phase (service wrapper / Docker) when you choose to start it.
