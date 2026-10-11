# Drama capability matrix (Fal OpenAPI, 2026-10-10)

Schemas from Fal OpenAPI (`/tmp/falschemas/`). Unsupported on Fal = fail **before** any hold. No workaround.

| Skill mode | seedance-2.0 | seedance-2.5 | h3-max | wan-3.0-prime | gpt-image-2 | music-3 | speech-02-hd |
|---|---|---|---|---|---|---|---|
| text | t2v | t2v | t2v | t2v | generate | prompt+lyrics | text + `voice_id` |
| first frame | i2v `image_url` | i2v `image_url` | i2v `image_url` | i2v `start_image_url` **required** | — | — | — |
| first+last frame | i2v + `end_image_url` | i2v + `end_image_url` | i2v + `end_image_url` | i2v + `end_image_url` | — | — | — |
| multi-slot image ref | ref `image_urls` ≤9 | ref `image_urls` ≤30 | ref `image_url`/`middle`/`end` + `reference_image_urls` ≤9 (≤12 images) | ref `reference_image_urls` ≤10 | edit `image_urls` ≤**16** | — | — |
| reference video | ref `video_urls` ≤3,  sums ≤15s | ref `video_urls` ≤10, each 1.8–30.2s, video+audio sums ≤30.2s | ref `reference_video_urls` ≤3 | ref `reference_video_urls` ≤5 | — | — | — |
| reference audio | ref `audio_urls` ≤3; needs image\|video | ref `audio_urls` ≤10 | ref `reference_audio_urls` ≤3; i2v also `target_audio_url` | ref `reference_audio_urls` ≤5 | — | — | **unsupported** (no audio input) |
| extend | 2.5 ref `task=extension` (2.0 has no `task` — fail, name 2.5) | ref `task=extension` + ≥1 video | unsupported as a named task — fail, name seedance-2.5 | unsupported as a named task — fail, name seedance-2.5 | — | — | — |
| edit video | same as extend (name 2.5) | ref `task=editing` (duration forced auto; we price input seconds) | unsupported as a named task — fail, name seedance-2.5 | unsupported as a named task — fail, name seedance-2.5 | — | — | — |
| multi-shot container | family reference / i2v per shot | family reference / i2v per shot; 2.5 `task` | family reference / i2v | family reference / i2v | — | — | — |
| continuity chain | last-frame i2v only (no extend task) | **native extend**: shot N waits for shot N−1 video, then `task=extension` | last-frame + refs | last-frame + refs | — | — | — |
| image generate | — | — | — | — | base | — | — |
| image edit | — | — | — | — | edit, ≤16 refs + optional `mask_url` | — | — |
| music | — | — | — | — | — | 1–300s | — |
| speech (preset) | — | — | — | — | — | — | 1–5000 chars, `voice_id`, `language_boost` |
| speech (clone) | — | — | — | — | — | — | `fal-ai/minimax/voice-clone` → `custom_voice_id` reused as `voice_id` |

**Conflicts resolved**

- h3-max **does** accept reference video (`reference_video_urls`). Skill docs that said otherwise were wrong.
- wan-3.0-prime **does** accept `reference_video_urls` on the reference endpoint; it has **no** named edit/extend `task`. Edit/extend jobs must use seedance-2.5 or fail before hold.
- seedance-2.0 reference has no `task` enum; extend/edit on 2.0 fail before hold naming 2.5.
- speech-02-hd `voice_id` is a string (custom ids work). Clone is `fal-ai/minimax/voice-clone` (`audio_url` ≥10s, $1.50 + $0.30/1k preview). Not chatterbox. Hindi via `language_boost`. Fal deletes unused clones after 7 days; clone preview is not TTS use.

**Media that may reach Fal:** `drama-upload://{id}` (resolved to a V4 signed GET, 8h) or a `fal.media` URL present in `falMediaIndex`. Foreign / `data:` / user URLs rejected before hold.
