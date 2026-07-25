---

## name: background-generation
description: >
  Generate photo or video backgrounds/backdrops for educational and creative
  scenes. Routes to the closed Fal media model registry via image_generate /
  video_generate. Use when the user asks for a background, backdrop, scene
  plate, or studio environment — photo by default, video only on clear motion cues.

# Background Generation

Generate a single background image or short backdrop video. Classify → pick model → call one tool. Never invent URLs; never DIY with `run_command`.

## Decision table


| #   | Decision           | Rule                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Photo vs video** | Prefer **photo**. Choose **video** only on clear motion cues (`video`, `clip`, `animated`, `moving backdrop`, `looping background`, etc.). **Auto-Run:** always photo unless the user explicitly asks for video.                                                                                                                                                                                             |
| 2   | **Photo model**    | Default → `studio_background`. Character / cartoon / stylized / reference-look cues → `nano_banana_2_lite`. Upgrade to `nano_banana_pro` **only** when the user explicitly asks for higher quality/detail (`pro`, `highest quality`, `more detail`). Never upgrade from brief length or complexity. `nano_banana_2` only if the user names it. Text / banner / UI / packaging / layout cues → `gpt_image_2`. |
| 3   | **Video model**    | Always `seedance_2_fast` unless the user explicitly asks for max quality / complex multi-shot → `seedance_2`.                                                                                                                                                                                                                                                                                                |
| 4   | **Ask-Me**         | Before any generate call, `ask_clarification` for: photo|video, style/model preference (if photo), aspect ratio, and duration (if video). Do not guess.                                                                                                                                                                                                                                                      |
| 5   | **Auto-Run**       | Never ask. Silent defaults: **photo** + `studio_background` + **16:9** + that model’s registry defaults.                                                                                                                                                                                                                                                                                                     |
| 6   | **Delivery**       | Call `image_generate` or `video_generate` once. Brief status only. Never invent or paste URLs — the UI delivers via webhook.                                                                                                                                                                                                                                                                                 |




## Tool params (closed enums)



### `image_generate`

- `prompt` — scene description
- `model` — `studio_background`  `nano_banana_2`  `nano_banana_2_lite`  `nano_banana_pro`  `gpt_image_2`
- `aspect_ratio` — unified ratio string (e.g. `16:9`, `9:16`, `1:1`)
- `resolution` — only when the chosen model supports it (omit for `nano_banana_2_lite`)



### `video_generate`

- `prompt` — scene description
- `model` — `seedance_2`  `seedance_2_fast` (default `seedance_2_fast`)
- `aspect_ratio` — `auto`  `21:9`  `16:9`  `4:3`  `1:1`  `3:4`  `9:16`
- `duration` — string enum `auto`  `4`…`15` (not a number)
- `resolution` — `480p`  `720p` only
- `reference_image_url` — optional still URL → switches to image-to-video



## Ask-Me clarification

When `pipelineMode: ask`, call `ask_clarification` once before generating. Suggested choices:

- Medium: Photo / Video
- Style (photo): Studio / Stylized character / Text or banner / Other
- Aspect: 16:9 / 9:16 / 1:1 / Other
- Duration (video only): 5s / 10s / 15s

After the user answers, map choices to the decision table and call the generate tool.

## Auto-Run defaults


| Field         | Value               |
| ------------- | ------------------- |
| Medium        | photo               |
| Model         | `studio_background` |
| Aspect        | `16:9`              |
| Clarification | none                |


If Auto-Run and the user **explicitly** requested video, use `seedance_2_fast`, `aspect_ratio: 16:9`, `duration: "5"`, `resolution: 720p`.

## UX

- Never mention Fal slugs, registry keys jargon, or tool names to the user.
- After queue success: one short sentence that generation started; the result will appear when ready.
- On failure: one plain sentence naming what failed.

