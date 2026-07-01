# ZIP project workflow

This folder documents how to produce a **single ZIP** that `POST /render-project` accepts.

## Layout inside the archive

At the root of the ZIP (or under one top-level folder), the renderer requires:

- `index.html` — entry composition
- `meta.json` — project metadata (for legacy `/render` this must include `id` and `name`; include them for consistency)
- `hyperframes.json` — HyperFrames project config

Recommended directories (preserved by extraction):

- `compositions/` — nested compositions / blocks
- `assets/` — media, fonts, JSON, etc.

## Build the example ZIP

From the service root:

```bash
chmod +x examples/project-zip-workflow/build-example-zip.sh
./examples/project-zip-workflow/build-example-zip.sh
```

This writes `examples/project-zip-workflow/example-project.zip` from `examples/simple-solid/`.

## HTTP upload (`POST /render-project`)

Send the ZIP as multipart field **`project`** (required). Optional **`options`** field: JSON string of render flags.

```bash
curl -sS -X POST http://127.0.0.1:3030/render-project \
  -F "project=@examples/project-zip-workflow/example-project.zip" \
  -o /tmp/render-bundle.zip
```

Works the same with browser `FormData.append("project", fileBlob, "project.zip")`, n8n HTTP Request (multipart body), or an S3 presigned URL download piped to `-F "project=@-"` when stdin is the ZIP.

## Optional render flags

Send a multipart text field `options` containing JSON, for example:

```json
{ "quality": "draft", "fps": "30", "composition": "compositions/intro.html" }
```

Only fields supported by the HyperFrames CLI are forwarded (`--fps`, `--quality`, `--format`, `--resolution`, `-c` for composition path).
