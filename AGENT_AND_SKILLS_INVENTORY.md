# Agent & Skills Complete Inventory

Generated inventory of **`services/agent`** and **`Skills`**. No code was modified.

## Summary

| Tree | Directories | Files (listed) | Notes |
|---|---:|---:|---|
| `services/agent` | 26 | 489 | `node_modules` listed as top-level package names only (full transitive tree is ~20k files) |
| `Skills` | 224 | 1834 | Full listing — every file path |

---

# Part 1 — `services/agent`

## 1.1 Purpose

The OkVevo AI **agent service**: Express server, Vercel AI SDK tool loop, Fal STT/media jobs, Firestore checkpoints, skill manifests, HyperFrames/Manim/talking-head pipeline tools.

## 1.2 Directory map

| Directory | Role |
|---|---|
| `.` (root) | Package config, Docker, deploy docs, env |
| `src/` | All TypeScript source |
| `src/catalog/` | skill.json loader + SAFE_TOOL_UNIVERSE |
| `src/hooks/` | Manifest-driven hook dispatcher |
| `src/tools/` | Tool factories (`general/`, `pipeline/`, `lib/`) |
| `src/skills/` | Skill-owned TS (eduVideo / talkingHead front-load) |
| `src/diagnostics/` | Connectivity diagnostics |
| `src/lib/` | Shared non-tool libs |
| `checks/` | Harness selfchecks (catalog/hooks/session-skills/talkingHead) |
| `scripts/` | npm check/deploy/build scripts |
| `dist/` | Build output |
| `graphify-out/` / nested `**/graphify-out/` | Code knowledge graph artifacts |
| `node_modules/` | npm dependencies |

## 1.3 Similar-file families (agent)

### `*.selfcheck.ts` (32)

Same role, repeated pattern:

- `checks/catalog.selfcheck.ts`
- `checks/hooks.selfcheck.ts`
- `checks/talkingHead.selfcheck.ts`
- `src/checkpointKind.selfcheck.ts`
- `src/editTargets.selfcheck.ts`
- `src/falQueue.selfcheck.ts`
- `src/finalVideoBasename.selfcheck.ts`
- `src/manimClipBasename.selfcheck.ts`
- `src/storageContentDisposition.selfcheck.ts`
- `src/taggedAssets.selfcheck.ts`
- `src/tools/lib/cloudRenderFlags.selfcheck.ts`
- `src/tools/lib/ensureFullAudio.selfcheck.ts`
- `src/tools/lib/hfProjectSync.selfcheck.ts`
- `src/tools/lib/manimGuard.selfcheck.ts`
- `src/tools/lib/manimOrientation.selfcheck.ts`
- `src/tools/lib/manimScriptPath.selfcheck.ts`
- `src/tools/lib/normalizeElevenLabsTranscript.selfcheck.ts`
- `src/tools/lib/normalizeTokens.selfcheck.ts`
- `src/tools/lib/orientationGuard.selfcheck.ts`
- `src/tools/lib/ownedEditFiles.selfcheck.ts`
- `src/tools/lib/parseBrandColorsFromText.selfcheck.ts`
- `src/tools/lib/remuxMp4Faststart.selfcheck.ts`
- `src/tools/lib/renderSnapshot.selfcheck.ts`
- `src/tools/lib/resolveCompositionDuration.selfcheck.ts`
- `src/tools/lib/scaffoldInputDiff.selfcheck.ts`
- `src/tools/lib/sessionManimClips.selfcheck.ts`
- `src/tools/lib/strReplaceDecode.selfcheck.ts`
- `src/tools/lib/strReplaceNotFound.selfcheck.ts`
- `src/tools/lib/transcriptSanitize.selfcheck.ts`
- `src/tools/lib/transcriptStitch.selfcheck.ts`
- `src/tools/lib/transcriptionRouting.selfcheck.ts`
- `src/tools/pipeline/transcriptionLanguage.selfcheck.ts`

### `check-* scripts` (15)

Same role, repeated pattern:

- `checks/check-session-skills.ts`
- `scripts/check-extraction-gaps.ts`
- `scripts/check-groq-connectivity.sh`
- `scripts/check-heygen-webhook.ts`
- `scripts/check-planning.ts`
- `scripts/check-render-idempotency.ts`
- `scripts/check-session-artifacts.ts`
- `scripts/check-session-token-gate.ts`
- `scripts/check-shell-env.ts`
- `scripts/check-soft-ask.ts`
- `scripts/check-speaker-normalize.ts`
- `scripts/check-templates.mjs`
- `scripts/check-tool-registry.ts`
- `scripts/check-transcript-timeout.ts`
- `scripts/check-webhook-delivery.ts`

### `graphify-out artifacts` (28)

Same role, repeated pattern:

- `graphify-out/.graphify_labels.json`
- `graphify-out/.graphify_root`
- `graphify-out/GRAPH_REPORT.md`
- `graphify-out/cache/ast/v0.8.40/1b8e80c5678e2d9d725b2975cf57b76d2172ab2e3ba8b5352d25fad7ff2df70b.json`
- `graphify-out/cache/ast/v0.8.40/3cc58f24991c8dbe19fdd689ff1a868aafe23d40627335eb0810216e680384a9.json`
- `graphify-out/cache/ast/v0.8.40/3fd6b3b7fb87e67a52ce6fbdd43d85741360d6f29b3c355ef29ce53fac92d405.json`
- `graphify-out/cache/ast/v0.8.40/978911e744ef80e2c3498284d6563395b3a7f135be0663e7db3952a5a09a53d3.json`
- `graphify-out/cache/ast/v0.8.40/b6e5b20ec1a8ed780ad63ded6fa07925b3954e2305b13f017ccdb5d266d63b7a.json`
- `graphify-out/cache/ast/v0.8.40/cab59e898180b722cbfa8e1fd9fe664207411658d2bb81d33c8501211efd77a5.json`
- `graphify-out/cache/ast/v0.8.40/dc1256b4cdc81c6300cfe2fb1615410f755bb38a5e460e800f53fe71c8f2bc9c.json`
- `graphify-out/cache/ast/v0.8.40/e75e0fc0c94300a7d8a2c70a7e486e912494f55b66d8a65c8e7f21dfb85969c3.json`
- `graphify-out/cache/ast/v0.8.40/e85de4568f16b5897d807c93cc7f9b75152cca3e54a15816c91a7f1afbf2d413.json`
- `graphify-out/cache/stat-index.json`
- `graphify-out/graph.html`
- `graphify-out/graph.json`
- `graphify-out/manifest.json`
- `src/graphify-out/.graphify_labels.json`
- `src/graphify-out/.graphify_root`
- `src/graphify-out/GRAPH_REPORT.md`
- `src/graphify-out/graph.html`
- `src/graphify-out/graph.json`
- `src/graphify-out/manifest.json`
- `src/tools/graphify-out/.graphify_labels.json`
- `src/tools/graphify-out/.graphify_root`
- `src/tools/graphify-out/GRAPH_REPORT.md`
- `src/tools/graphify-out/graph.html`
- `src/tools/graphify-out/graph.json`
- `src/tools/graphify-out/manifest.json`

### By extension

| Extension | Count | Typical role |
|---|---:|---|
| `(no-ext)` | 317 | Config/docs without extension or special names |
| `.ts` | 115 | TypeScript source / checks / scripts |
| `.json` | 23 | Config / lock / graphify |
| `.js` | 10 | Compiled or JS scripts |
| `.map` | 9 | Source maps in dist |
| `.md` | 6 | Docs |
| `.html` | 3 | See file list |
| `.sh` | 3 | See file list |
| `.mjs` | 2 | See file list |
| `.example` | 1 | See file list |

## 1.4 Complete directory list (agent)

- `.` (root)
- `checks/`
- `dist/`
- `dist/pipelines/`
- `dist/pipelines/edu-video/`
- `dist/skills/`
- `graphify-out/`
- `graphify-out/cache/`
- `graphify-out/cache/ast/`
- `graphify-out/cache/ast/v0.8.40/`
- `node_modules/`
- `scripts/`
- `src/`
- `src/catalog/`
- `src/diagnostics/`
- `src/graphify-out/`
- `src/hooks/`
- `src/lib/`
- `src/skills/`
- `src/skills/eduVideo/`
- `src/skills/talkingHead/`
- `src/tools/`
- `src/tools/general/`
- `src/tools/graphify-out/`
- `src/tools/lib/`
- `src/tools/pipeline/`

## 1.5 Complete file list with roles (agent)

| Path | What it does |
|---|---|
| `.dockerignore` | Files excluded from Docker build context. |
| `.env` | Local secrets/config (not for commit). |
| `.env.example` | Example env vars documenting required configuration. |
| `AGENT.md` | Human notes about the agent service. |
| `DEPLOY.md` | Deploy instructions for the agent. |
| `Dockerfile` | Container image build for running the agent. |
| `HARNESS_INVENTORY.md` | Large generated harness inventory dump. |
| `agentcore.config.json` | AWS AgentCore / runtime deployment config. |
| `checks/catalog.selfcheck.ts` | Assert-style selfcheck for `catalog` invariants (run via ts-node/tsx). |
| `checks/check-session-skills.ts` | Harness selfcheck moved under checks/ (manifest/hooks/session-skills/talking-head). |
| `checks/hooks.selfcheck.ts` | Assert-style selfcheck for `hooks` invariants (run via ts-node/tsx). |
| `checks/talkingHead.selfcheck.ts` | Assert-style selfcheck for `talkingHead` invariants (run via ts-node/tsx). |
| `dist/.tsbuildinfo` | Compiled JS build output (esbuild/tsc artifact). |
| `dist/chat.js` | Compiled JS build output (esbuild/tsc artifact). |
| `dist/chat.js.map` | Compiled JS build output (esbuild/tsc artifact). |
| `dist/index.js` | Compiled JS build output (esbuild/tsc artifact). |
| `dist/index.js.map` | Compiled JS build output (esbuild/tsc artifact). |
| `dist/pipelines/edu-video/index.js` | Compiled JS build output (esbuild/tsc artifact). |
| `dist/pipelines/edu-video/index.js.map` | Compiled JS build output (esbuild/tsc artifact). |
| `dist/pipelines/edu-video/retry.js` | Compiled JS build output (esbuild/tsc artifact). |
| `dist/pipelines/edu-video/retry.js.map` | Compiled JS build output (esbuild/tsc artifact). |
| `dist/pipelines/edu-video/storage.js` | Compiled JS build output (esbuild/tsc artifact). |
| `dist/pipelines/edu-video/storage.js.map` | Compiled JS build output (esbuild/tsc artifact). |
| `dist/pipelines/edu-video/tools.js` | Compiled JS build output (esbuild/tsc artifact). |
| `dist/pipelines/edu-video/tools.js.map` | Compiled JS build output (esbuild/tsc artifact). |
| `dist/pipelines/edu-video/types.js` | Compiled JS build output (esbuild/tsc artifact). |
| `dist/pipelines/edu-video/types.js.map` | Compiled JS build output (esbuild/tsc artifact). |
| `dist/server.js` | Compiled JS build output (esbuild/tsc artifact). |
| `dist/session.js` | Compiled JS build output (esbuild/tsc artifact). |
| `dist/session.js.map` | Compiled JS build output (esbuild/tsc artifact). |
| `dist/skills/loader.js` | Compiled JS build output (esbuild/tsc artifact). |
| `dist/skills/loader.js.map` | Compiled JS build output (esbuild/tsc artifact). |
| `graphify-out/.graphify_labels.json` | Graphify knowledge-graph artifact (cache/report/graph). |
| `graphify-out/.graphify_root` | Graphify knowledge-graph artifact (cache/report/graph). |
| `graphify-out/GRAPH_REPORT.md` | Graphify knowledge-graph artifact (cache/report/graph). |
| `graphify-out/cache/ast/v0.8.40/1b8e80c5678e2d9d725b2975cf57b76d2172ab2e3ba8b5352d25fad7ff2df70b.json` | Graphify knowledge-graph artifact (cache/report/graph). |
| `graphify-out/cache/ast/v0.8.40/3cc58f24991c8dbe19fdd689ff1a868aafe23d40627335eb0810216e680384a9.json` | Graphify knowledge-graph artifact (cache/report/graph). |
| `graphify-out/cache/ast/v0.8.40/3fd6b3b7fb87e67a52ce6fbdd43d85741360d6f29b3c355ef29ce53fac92d405.json` | Graphify knowledge-graph artifact (cache/report/graph). |
| `graphify-out/cache/ast/v0.8.40/978911e744ef80e2c3498284d6563395b3a7f135be0663e7db3952a5a09a53d3.json` | Graphify knowledge-graph artifact (cache/report/graph). |
| `graphify-out/cache/ast/v0.8.40/b6e5b20ec1a8ed780ad63ded6fa07925b3954e2305b13f017ccdb5d266d63b7a.json` | Graphify knowledge-graph artifact (cache/report/graph). |
| `graphify-out/cache/ast/v0.8.40/cab59e898180b722cbfa8e1fd9fe664207411658d2bb81d33c8501211efd77a5.json` | Graphify knowledge-graph artifact (cache/report/graph). |
| `graphify-out/cache/ast/v0.8.40/dc1256b4cdc81c6300cfe2fb1615410f755bb38a5e460e800f53fe71c8f2bc9c.json` | Graphify knowledge-graph artifact (cache/report/graph). |
| `graphify-out/cache/ast/v0.8.40/e75e0fc0c94300a7d8a2c70a7e486e912494f55b66d8a65c8e7f21dfb85969c3.json` | Graphify knowledge-graph artifact (cache/report/graph). |
| `graphify-out/cache/ast/v0.8.40/e85de4568f16b5897d807c93cc7f9b75152cca3e54a15816c91a7f1afbf2d413.json` | Graphify knowledge-graph artifact (cache/report/graph). |
| `graphify-out/cache/stat-index.json` | Graphify knowledge-graph artifact (cache/report/graph). |
| `graphify-out/graph.html` | Graphify knowledge-graph artifact (cache/report/graph). |
| `graphify-out/graph.json` | Graphify knowledge-graph artifact (cache/report/graph). |
| `graphify-out/manifest.json` | Graphify knowledge-graph artifact (cache/report/graph). |
| `node_modules/.bin/` | Top-level npm package (transitive files not expanded) |
| `node_modules/.package-lock.json/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@ai-sdk/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@aws-sdk/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@aws/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@babel/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@chenglou/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@cspotcode/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@derhuerst/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@esbuild/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@fastify/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@firebase/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@fontsource/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@google-cloud/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@grpc/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@hono/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@hyperframes/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@isaacs/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@jridgewell/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@js-sdsl/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@nodable/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@openrouter/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@opentelemetry/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@pkgjs/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@protobufjs/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@puppeteer/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@smithy/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@sparticuz/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@standard-schema/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@tootallnate/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@tsconfig/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@types/` | Top-level npm package (transitive files not expanded) |
| `node_modules/@vercel/` | Top-level npm package (transitive files not expanded) |
| `node_modules/abort-controller/` | Top-level npm package (transitive files not expanded) |
| `node_modules/accepts/` | Top-level npm package (transitive files not expanded) |
| `node_modules/acorn-walk/` | Top-level npm package (transitive files not expanded) |
| `node_modules/acorn/` | Top-level npm package (transitive files not expanded) |
| `node_modules/agent-base/` | Top-level npm package (transitive files not expanded) |
| `node_modules/agentkeepalive/` | Top-level npm package (transitive files not expanded) |
| `node_modules/ai/` | Top-level npm package (transitive files not expanded) |
| `node_modules/ansi-regex/` | Top-level npm package (transitive files not expanded) |
| `node_modules/ansi-styles/` | Top-level npm package (transitive files not expanded) |
| `node_modules/anynum/` | Top-level npm package (transitive files not expanded) |
| `node_modules/arg/` | Top-level npm package (transitive files not expanded) |
| `node_modules/argparse/` | Top-level npm package (transitive files not expanded) |
| `node_modules/array-flatten/` | Top-level npm package (transitive files not expanded) |
| `node_modules/arrify/` | Top-level npm package (transitive files not expanded) |
| `node_modules/ast-types/` | Top-level npm package (transitive files not expanded) |
| `node_modules/async-retry/` | Top-level npm package (transitive files not expanded) |
| `node_modules/asynckit/` | Top-level npm package (transitive files not expanded) |
| `node_modules/b4a/` | Top-level npm package (transitive files not expanded) |
| `node_modules/bare-events/` | Top-level npm package (transitive files not expanded) |
| `node_modules/bare-fs/` | Top-level npm package (transitive files not expanded) |
| `node_modules/bare-path/` | Top-level npm package (transitive files not expanded) |
| `node_modules/bare-stream/` | Top-level npm package (transitive files not expanded) |
| `node_modules/bare-url/` | Top-level npm package (transitive files not expanded) |
| `node_modules/base64-js/` | Top-level npm package (transitive files not expanded) |
| `node_modules/bignumber.js/` | Top-level npm package (transitive files not expanded) |
| `node_modules/body-parser/` | Top-level npm package (transitive files not expanded) |
| `node_modules/boolbase/` | Top-level npm package (transitive files not expanded) |
| `node_modules/bowser/` | Top-level npm package (transitive files not expanded) |
| `node_modules/bpm-detective/` | Top-level npm package (transitive files not expanded) |
| `node_modules/buffer-equal-constant-time/` | Top-level npm package (transitive files not expanded) |
| `node_modules/buffer-from/` | Top-level npm package (transitive files not expanded) |
| `node_modules/bytes/` | Top-level npm package (transitive files not expanded) |
| `node_modules/call-bind-apply-helpers/` | Top-level npm package (transitive files not expanded) |
| `node_modules/call-bound/` | Top-level npm package (transitive files not expanded) |
| `node_modules/caseless/` | Top-level npm package (transitive files not expanded) |
| `node_modules/chownr/` | Top-level npm package (transitive files not expanded) |
| `node_modules/chromium-bidi/` | Top-level npm package (transitive files not expanded) |
| `node_modules/cliui/` | Top-level npm package (transitive files not expanded) |
| `node_modules/color-convert/` | Top-level npm package (transitive files not expanded) |
| `node_modules/color-name/` | Top-level npm package (transitive files not expanded) |
| `node_modules/combined-stream/` | Top-level npm package (transitive files not expanded) |
| `node_modules/concat-stream/` | Top-level npm package (transitive files not expanded) |
| `node_modules/content-disposition/` | Top-level npm package (transitive files not expanded) |
| `node_modules/content-type/` | Top-level npm package (transitive files not expanded) |
| `node_modules/cookie-signature/` | Top-level npm package (transitive files not expanded) |
| `node_modules/cookie/` | Top-level npm package (transitive files not expanded) |
| `node_modules/cors/` | Top-level npm package (transitive files not expanded) |
| `node_modules/create-require/` | Top-level npm package (transitive files not expanded) |
| `node_modules/css-select/` | Top-level npm package (transitive files not expanded) |
| `node_modules/css-what/` | Top-level npm package (transitive files not expanded) |
| `node_modules/cssesc/` | Top-level npm package (transitive files not expanded) |
| `node_modules/cssom/` | Top-level npm package (transitive files not expanded) |
| `node_modules/data-uri-to-buffer/` | Top-level npm package (transitive files not expanded) |
| `node_modules/debug/` | Top-level npm package (transitive files not expanded) |
| `node_modules/delayed-stream/` | Top-level npm package (transitive files not expanded) |
| `node_modules/depd/` | Top-level npm package (transitive files not expanded) |
| `node_modules/destroy/` | Top-level npm package (transitive files not expanded) |
| `node_modules/devtools-protocol/` | Top-level npm package (transitive files not expanded) |
| `node_modules/diff/` | Top-level npm package (transitive files not expanded) |
| `node_modules/dom-serializer/` | Top-level npm package (transitive files not expanded) |
| `node_modules/domelementtype/` | Top-level npm package (transitive files not expanded) |
| `node_modules/domhandler/` | Top-level npm package (transitive files not expanded) |
| `node_modules/domutils/` | Top-level npm package (transitive files not expanded) |
| `node_modules/dotenv/` | Top-level npm package (transitive files not expanded) |
| `node_modules/dunder-proto/` | Top-level npm package (transitive files not expanded) |
| `node_modules/duplexify/` | Top-level npm package (transitive files not expanded) |
| `node_modules/ecdsa-sig-formatter/` | Top-level npm package (transitive files not expanded) |
| `node_modules/ee-first/` | Top-level npm package (transitive files not expanded) |
| `node_modules/emoji-regex/` | Top-level npm package (transitive files not expanded) |
| `node_modules/encodeurl/` | Top-level npm package (transitive files not expanded) |
| `node_modules/end-of-stream/` | Top-level npm package (transitive files not expanded) |
| `node_modules/entities/` | Top-level npm package (transitive files not expanded) |
| `node_modules/env-paths/` | Top-level npm package (transitive files not expanded) |
| `node_modules/es-define-property/` | Top-level npm package (transitive files not expanded) |
| `node_modules/es-errors/` | Top-level npm package (transitive files not expanded) |
| `node_modules/es-object-atoms/` | Top-level npm package (transitive files not expanded) |
| `node_modules/es-set-tostringtag/` | Top-level npm package (transitive files not expanded) |
| `node_modules/esbuild/` | Top-level npm package (transitive files not expanded) |
| `node_modules/escalade/` | Top-level npm package (transitive files not expanded) |
| `node_modules/escape-html/` | Top-level npm package (transitive files not expanded) |
| `node_modules/esprima/` | Top-level npm package (transitive files not expanded) |
| `node_modules/etag/` | Top-level npm package (transitive files not expanded) |
| `node_modules/event-target-shim/` | Top-level npm package (transitive files not expanded) |
| `node_modules/events-universal/` | Top-level npm package (transitive files not expanded) |
| `node_modules/eventsource-parser/` | Top-level npm package (transitive files not expanded) |
| `node_modules/express/` | Top-level npm package (transitive files not expanded) |
| `node_modules/extend-shallow/` | Top-level npm package (transitive files not expanded) |
| `node_modules/extend/` | Top-level npm package (transitive files not expanded) |
| `node_modules/farmhash-modern/` | Top-level npm package (transitive files not expanded) |
| `node_modules/fast-deep-equal/` | Top-level npm package (transitive files not expanded) |
| `node_modules/fast-fifo/` | Top-level npm package (transitive files not expanded) |
| `node_modules/fast-xml-builder/` | Top-level npm package (transitive files not expanded) |
| `node_modules/fast-xml-parser/` | Top-level npm package (transitive files not expanded) |
| `node_modules/faye-websocket/` | Top-level npm package (transitive files not expanded) |
| `node_modules/fetch-blob/` | Top-level npm package (transitive files not expanded) |
| `node_modules/ffmpeg-static/` | Top-level npm package (transitive files not expanded) |
| `node_modules/ffprobe-static/` | Top-level npm package (transitive files not expanded) |
| `node_modules/finalhandler/` | Top-level npm package (transitive files not expanded) |
| `node_modules/firebase-admin/` | Top-level npm package (transitive files not expanded) |
| `node_modules/form-data-encoder/` | Top-level npm package (transitive files not expanded) |
| `node_modules/form-data/` | Top-level npm package (transitive files not expanded) |
| `node_modules/formdata-node/` | Top-level npm package (transitive files not expanded) |
| `node_modules/formdata-polyfill/` | Top-level npm package (transitive files not expanded) |
| `node_modules/forwarded/` | Top-level npm package (transitive files not expanded) |
| `node_modules/fresh/` | Top-level npm package (transitive files not expanded) |
| `node_modules/function-bind/` | Top-level npm package (transitive files not expanded) |
| `node_modules/functional-red-black-tree/` | Top-level npm package (transitive files not expanded) |
| `node_modules/gaxios/` | Top-level npm package (transitive files not expanded) |
| `node_modules/gcp-metadata/` | Top-level npm package (transitive files not expanded) |
| `node_modules/get-caller-file/` | Top-level npm package (transitive files not expanded) |
| `node_modules/get-east-asian-width/` | Top-level npm package (transitive files not expanded) |
| `node_modules/get-intrinsic/` | Top-level npm package (transitive files not expanded) |
| `node_modules/get-proto/` | Top-level npm package (transitive files not expanded) |
| `node_modules/google-auth-library/` | Top-level npm package (transitive files not expanded) |
| `node_modules/google-gax/` | Top-level npm package (transitive files not expanded) |
| `node_modules/google-logging-utils/` | Top-level npm package (transitive files not expanded) |
| `node_modules/gopd/` | Top-level npm package (transitive files not expanded) |
| `node_modules/gray-matter/` | Top-level npm package (transitive files not expanded) |
| `node_modules/groq-sdk/` | Top-level npm package (transitive files not expanded) |
| `node_modules/gtoken/` | Top-level npm package (transitive files not expanded) |
| `node_modules/has-symbols/` | Top-level npm package (transitive files not expanded) |
| `node_modules/has-tostringtag/` | Top-level npm package (transitive files not expanded) |
| `node_modules/hasown/` | Top-level npm package (transitive files not expanded) |
| `node_modules/hono/` | Top-level npm package (transitive files not expanded) |
| `node_modules/html-entities/` | Top-level npm package (transitive files not expanded) |
| `node_modules/html-escaper/` | Top-level npm package (transitive files not expanded) |
| `node_modules/htmlparser2/` | Top-level npm package (transitive files not expanded) |
| `node_modules/http-errors/` | Top-level npm package (transitive files not expanded) |
| `node_modules/http-parser-js/` | Top-level npm package (transitive files not expanded) |
| `node_modules/http-proxy-agent/` | Top-level npm package (transitive files not expanded) |
| `node_modules/http-response-object/` | Top-level npm package (transitive files not expanded) |
| `node_modules/https-proxy-agent/` | Top-level npm package (transitive files not expanded) |
| `node_modules/humanize-ms/` | Top-level npm package (transitive files not expanded) |
| `node_modules/iconv-lite/` | Top-level npm package (transitive files not expanded) |
| `node_modules/inherits/` | Top-level npm package (transitive files not expanded) |
| `node_modules/ipaddr.js/` | Top-level npm package (transitive files not expanded) |
| `node_modules/is-extendable/` | Top-level npm package (transitive files not expanded) |
| `node_modules/is-fullwidth-code-point/` | Top-level npm package (transitive files not expanded) |
| `node_modules/is-stream/` | Top-level npm package (transitive files not expanded) |
| `node_modules/is-unsafe/` | Top-level npm package (transitive files not expanded) |
| `node_modules/jose/` | Top-level npm package (transitive files not expanded) |
| `node_modules/js-yaml/` | Top-level npm package (transitive files not expanded) |
| `node_modules/json-bigint/` | Top-level npm package (transitive files not expanded) |
| `node_modules/json-schema/` | Top-level npm package (transitive files not expanded) |
| `node_modules/jsonwebtoken/` | Top-level npm package (transitive files not expanded) |
| `node_modules/jwa/` | Top-level npm package (transitive files not expanded) |
| `node_modules/jwks-rsa/` | Top-level npm package (transitive files not expanded) |
| `node_modules/jws/` | Top-level npm package (transitive files not expanded) |
| `node_modules/kind-of/` | Top-level npm package (transitive files not expanded) |
| `node_modules/lilconfig/` | Top-level npm package (transitive files not expanded) |
| `node_modules/limiter/` | Top-level npm package (transitive files not expanded) |
| `node_modules/linkedom/` | Top-level npm package (transitive files not expanded) |
| `node_modules/lodash.camelcase/` | Top-level npm package (transitive files not expanded) |
| `node_modules/lodash.clonedeep/` | Top-level npm package (transitive files not expanded) |
| `node_modules/lodash.includes/` | Top-level npm package (transitive files not expanded) |
| `node_modules/lodash.isboolean/` | Top-level npm package (transitive files not expanded) |
| `node_modules/lodash.isinteger/` | Top-level npm package (transitive files not expanded) |
| `node_modules/lodash.isnumber/` | Top-level npm package (transitive files not expanded) |
| `node_modules/lodash.isplainobject/` | Top-level npm package (transitive files not expanded) |
| `node_modules/lodash.isstring/` | Top-level npm package (transitive files not expanded) |
| `node_modules/lodash.once/` | Top-level npm package (transitive files not expanded) |
| `node_modules/long/` | Top-level npm package (transitive files not expanded) |
| `node_modules/lru-cache/` | Top-level npm package (transitive files not expanded) |
| `node_modules/lru-memoizer/` | Top-level npm package (transitive files not expanded) |
| `node_modules/magic-string/` | Top-level npm package (transitive files not expanded) |
| `node_modules/make-error/` | Top-level npm package (transitive files not expanded) |
| `node_modules/math-intrinsics/` | Top-level npm package (transitive files not expanded) |
| `node_modules/media-typer/` | Top-level npm package (transitive files not expanded) |
| `node_modules/merge-descriptors/` | Top-level npm package (transitive files not expanded) |
| `node_modules/methods/` | Top-level npm package (transitive files not expanded) |
| `node_modules/mime-db/` | Top-level npm package (transitive files not expanded) |
| `node_modules/mime-types/` | Top-level npm package (transitive files not expanded) |
| `node_modules/mime/` | Top-level npm package (transitive files not expanded) |
| `node_modules/minipass/` | Top-level npm package (transitive files not expanded) |
| `node_modules/minizlib/` | Top-level npm package (transitive files not expanded) |
| `node_modules/mitt/` | Top-level npm package (transitive files not expanded) |
| `node_modules/modern-tar/` | Top-level npm package (transitive files not expanded) |
| `node_modules/ms/` | Top-level npm package (transitive files not expanded) |
| `node_modules/nanoid/` | Top-level npm package (transitive files not expanded) |
| `node_modules/negotiator/` | Top-level npm package (transitive files not expanded) |
| `node_modules/node-domexception/` | Top-level npm package (transitive files not expanded) |
| `node_modules/node-fetch/` | Top-level npm package (transitive files not expanded) |
| `node_modules/node-forge/` | Top-level npm package (transitive files not expanded) |
| `node_modules/nth-check/` | Top-level npm package (transitive files not expanded) |
| `node_modules/object-assign/` | Top-level npm package (transitive files not expanded) |
| `node_modules/object-hash/` | Top-level npm package (transitive files not expanded) |
| `node_modules/object-inspect/` | Top-level npm package (transitive files not expanded) |
| `node_modules/on-finished/` | Top-level npm package (transitive files not expanded) |
| `node_modules/once/` | Top-level npm package (transitive files not expanded) |
| `node_modules/p-limit/` | Top-level npm package (transitive files not expanded) |
| `node_modules/parse-cache-control/` | Top-level npm package (transitive files not expanded) |
| `node_modules/parseurl/` | Top-level npm package (transitive files not expanded) |
| `node_modules/path-expression-matcher/` | Top-level npm package (transitive files not expanded) |
| `node_modules/path-to-regexp/` | Top-level npm package (transitive files not expanded) |
| `node_modules/picocolors/` | Top-level npm package (transitive files not expanded) |
| `node_modules/postcss-selector-parser/` | Top-level npm package (transitive files not expanded) |
| `node_modules/postcss/` | Top-level npm package (transitive files not expanded) |
| `node_modules/progress/` | Top-level npm package (transitive files not expanded) |
| `node_modules/proto3-json-serializer/` | Top-level npm package (transitive files not expanded) |
| `node_modules/protobufjs/` | Top-level npm package (transitive files not expanded) |
| `node_modules/proxy-addr/` | Top-level npm package (transitive files not expanded) |
| `node_modules/pump/` | Top-level npm package (transitive files not expanded) |
| `node_modules/puppeteer-core/` | Top-level npm package (transitive files not expanded) |
| `node_modules/puppeteer/` | Top-level npm package (transitive files not expanded) |
| `node_modules/qs/` | Top-level npm package (transitive files not expanded) |
| `node_modules/range-parser/` | Top-level npm package (transitive files not expanded) |
| `node_modules/raw-body/` | Top-level npm package (transitive files not expanded) |
| `node_modules/readable-stream/` | Top-level npm package (transitive files not expanded) |
| `node_modules/recast/` | Top-level npm package (transitive files not expanded) |
| `node_modules/require-directory/` | Top-level npm package (transitive files not expanded) |
| `node_modules/retry-request/` | Top-level npm package (transitive files not expanded) |
| `node_modules/retry/` | Top-level npm package (transitive files not expanded) |
| `node_modules/safe-buffer/` | Top-level npm package (transitive files not expanded) |
| `node_modules/safer-buffer/` | Top-level npm package (transitive files not expanded) |
| `node_modules/section-matter/` | Top-level npm package (transitive files not expanded) |
| `node_modules/semver/` | Top-level npm package (transitive files not expanded) |
| `node_modules/send/` | Top-level npm package (transitive files not expanded) |
| `node_modules/serve-static/` | Top-level npm package (transitive files not expanded) |
| `node_modules/setprototypeof/` | Top-level npm package (transitive files not expanded) |
| `node_modules/side-channel-list/` | Top-level npm package (transitive files not expanded) |
| `node_modules/side-channel-map/` | Top-level npm package (transitive files not expanded) |
| `node_modules/side-channel-weakmap/` | Top-level npm package (transitive files not expanded) |
| `node_modules/side-channel/` | Top-level npm package (transitive files not expanded) |
| `node_modules/source-map-js/` | Top-level npm package (transitive files not expanded) |
| `node_modules/source-map/` | Top-level npm package (transitive files not expanded) |
| `node_modules/sprintf-js/` | Top-level npm package (transitive files not expanded) |
| `node_modules/statuses/` | Top-level npm package (transitive files not expanded) |
| `node_modules/stream-events/` | Top-level npm package (transitive files not expanded) |
| `node_modules/stream-shift/` | Top-level npm package (transitive files not expanded) |
| `node_modules/streamx/` | Top-level npm package (transitive files not expanded) |
| `node_modules/string-width/` | Top-level npm package (transitive files not expanded) |
| `node_modules/string_decoder/` | Top-level npm package (transitive files not expanded) |
| `node_modules/strip-ansi/` | Top-level npm package (transitive files not expanded) |
| `node_modules/strip-bom-string/` | Top-level npm package (transitive files not expanded) |
| `node_modules/strnum/` | Top-level npm package (transitive files not expanded) |
| `node_modules/stubs/` | Top-level npm package (transitive files not expanded) |
| `node_modules/tar-fs/` | Top-level npm package (transitive files not expanded) |
| `node_modules/tar-stream/` | Top-level npm package (transitive files not expanded) |
| `node_modules/tar/` | Top-level npm package (transitive files not expanded) |
| `node_modules/teeny-request/` | Top-level npm package (transitive files not expanded) |
| `node_modules/teex/` | Top-level npm package (transitive files not expanded) |
| `node_modules/text-decoder/` | Top-level npm package (transitive files not expanded) |
| `node_modules/tiny-invariant/` | Top-level npm package (transitive files not expanded) |
| `node_modules/toidentifier/` | Top-level npm package (transitive files not expanded) |
| `node_modules/tr46/` | Top-level npm package (transitive files not expanded) |
| `node_modules/ts-node/` | Top-level npm package (transitive files not expanded) |
| `node_modules/tslib/` | Top-level npm package (transitive files not expanded) |
| `node_modules/type-is/` | Top-level npm package (transitive files not expanded) |
| `node_modules/typed-query-selector/` | Top-level npm package (transitive files not expanded) |
| `node_modules/typedarray/` | Top-level npm package (transitive files not expanded) |
| `node_modules/typescript/` | Top-level npm package (transitive files not expanded) |
| `node_modules/uhyphen/` | Top-level npm package (transitive files not expanded) |
| `node_modules/undici-types/` | Top-level npm package (transitive files not expanded) |
| `node_modules/unpipe/` | Top-level npm package (transitive files not expanded) |
| `node_modules/util-deprecate/` | Top-level npm package (transitive files not expanded) |
| `node_modules/utils-merge/` | Top-level npm package (transitive files not expanded) |
| `node_modules/uuid/` | Top-level npm package (transitive files not expanded) |
| `node_modules/v8-compile-cache-lib/` | Top-level npm package (transitive files not expanded) |
| `node_modules/vary/` | Top-level npm package (transitive files not expanded) |
| `node_modules/wawoff2/` | Top-level npm package (transitive files not expanded) |
| `node_modules/web-streams-polyfill/` | Top-level npm package (transitive files not expanded) |
| `node_modules/webdriver-bidi-protocol/` | Top-level npm package (transitive files not expanded) |
| `node_modules/webidl-conversions/` | Top-level npm package (transitive files not expanded) |
| `node_modules/websocket-driver/` | Top-level npm package (transitive files not expanded) |
| `node_modules/websocket-extensions/` | Top-level npm package (transitive files not expanded) |
| `node_modules/whatwg-url/` | Top-level npm package (transitive files not expanded) |
| `node_modules/wrap-ansi/` | Top-level npm package (transitive files not expanded) |
| `node_modules/wrappy/` | Top-level npm package (transitive files not expanded) |
| `node_modules/ws/` | Top-level npm package (transitive files not expanded) |
| `node_modules/xml-naming/` | Top-level npm package (transitive files not expanded) |
| `node_modules/y18n/` | Top-level npm package (transitive files not expanded) |
| `node_modules/yallist/` | Top-level npm package (transitive files not expanded) |
| `node_modules/yargs-parser/` | Top-level npm package (transitive files not expanded) |
| `node_modules/yargs/` | Top-level npm package (transitive files not expanded) |
| `node_modules/yn/` | Top-level npm package (transitive files not expanded) |
| `node_modules/yocto-queue/` | Top-level npm package (transitive files not expanded) |
| `node_modules/zod/` | Top-level npm package (transitive files not expanded) |
| `package-lock.json` | Locked dependency tree for reproducible installs. |
| `package.json` | npm package definition: scripts, dependencies for the agent service. |
| `scripts/build.mjs` | Operational/build/deploy helper script. |
| `scripts/check-extraction-gaps.ts` | npm check script: regression assert for a harness concern. |
| `scripts/check-groq-connectivity.sh` | npm check script: regression assert for a harness concern. |
| `scripts/check-heygen-webhook.ts` | npm check script: regression assert for a harness concern. |
| `scripts/check-planning.ts` | npm check script: regression assert for a harness concern. |
| `scripts/check-render-idempotency.ts` | npm check script: regression assert for a harness concern. |
| `scripts/check-session-artifacts.ts` | npm check script: regression assert for a harness concern. |
| `scripts/check-session-token-gate.ts` | npm check script: regression assert for a harness concern. |
| `scripts/check-shell-env.ts` | npm check script: regression assert for a harness concern. |
| `scripts/check-soft-ask.ts` | npm check script: regression assert for a harness concern. |
| `scripts/check-speaker-normalize.ts` | npm check script: regression assert for a harness concern. |
| `scripts/check-templates.mjs` | npm check script: regression assert for a harness concern. |
| `scripts/check-tool-registry.ts` | npm check script: regression assert for a harness concern. |
| `scripts/check-transcript-timeout.ts` | npm check script: regression assert for a harness concern. |
| `scripts/check-webhook-delivery.ts` | npm check script: regression assert for a harness concern. |
| `scripts/deploy-agentcore.sh` | Operational/build/deploy helper script. |
| `scripts/remux-session-videos.ts` | Operational/build/deploy helper script. |
| `scripts/run-groq-diagnostics.ts` | Operational/build/deploy helper script. |
| `scripts/verify-agentcore-deploy.sh` | Operational/build/deploy helper script. |
| `src/agent.ts` | Core runAgent loop: tools, resume, front-load, streaming. |
| `src/callbackToken.ts` | Webhook/callback auth tokens. |
| `src/catalog/manifest.ts` | skill.json Zod loader, SAFE_TOOL_UNIVERSE, mtime cache, dispatch emit. |
| `src/checkpoint.ts` | Firestore checkpoints: write/load/resume context, pre-pipeline persistence. |
| `src/checkpointKind.selfcheck.ts` | Assert-style selfcheck for `checkpointKind` invariants (run via ts-node/tsx). |
| `src/deliverEvent.ts` | Generic delivery event routing (Fal/HeyGen/etc). |
| `src/deliverEventParse.ts` | Parse inbound delivery event payloads. |
| `src/diagnostics/groqConnectivity.ts` | Groq API connectivity diagnostics. |
| `src/editTargets.selfcheck.ts` | Assert-style selfcheck for `editTargets` invariants (run via ts-node/tsx). |
| `src/editTargets.ts` | Edit-target resolution for owned HTML/Manim files. |
| `src/env.ts` | Env loading/validation. |
| `src/errorMessage.ts` | User-facing error string helpers. |
| `src/falQueue.selfcheck.ts` | Assert-style selfcheck for `falQueue` invariants (run via ts-node/tsx). |
| `src/falQueue.ts` | Fal queue submit/status/result. |
| `src/falSttDeliver.ts` | Fal STT webhook delivery + transcript handoff via hooks. |
| `src/falSttIdempotency.ts` | Fal STT idempotency / short-circuit / wake claim logic. |
| `src/finalVideoBasename.selfcheck.ts` | Assert-style selfcheck for `finalVideoBasename` invariants (run via ts-node/tsx). |
| `src/finalVideoBasename.ts` | Canonical final video basename helper. |
| `src/firebase.ts` | Firebase Admin init. |
| `src/graphify-out/.graphify_labels.json` | Graphify knowledge-graph artifact (cache/report/graph). |
| `src/graphify-out/.graphify_root` | Graphify knowledge-graph artifact (cache/report/graph). |
| `src/graphify-out/GRAPH_REPORT.md` | Graphify knowledge-graph artifact (cache/report/graph). |
| `src/graphify-out/graph.html` | Graphify knowledge-graph artifact (cache/report/graph). |
| `src/graphify-out/graph.json` | Graphify knowledge-graph artifact (cache/report/graph). |
| `src/graphify-out/manifest.json` | Graphify knowledge-graph artifact (cache/report/graph). |
| `src/heygenWebhook.ts` | HeyGen webhook handler. |
| `src/hooks/dispatch.ts` | Generic hook dispatcher (on_transcript_ready etc). |
| `src/lib/timelinePlanning.ts` | Timeline/segment planning helpers. |
| `src/manimClipBasename.selfcheck.ts` | Assert-style selfcheck for `manimClipBasename` invariants (run via ts-node/tsx). |
| `src/manimClipBasename.ts` | Canonical Manim clip basename helper. |
| `src/messagePruning.ts` | Prune tool results from message history. |
| `src/pendingFalJob.ts` | Persist/read/clear pending Fal job stamps (skillId). |
| `src/server.ts` | HTTP entrypoint (Express): routes, webhooks, chat invoke. |
| `src/session.ts` | Session + message persistence. |
| `src/sessionSkills.ts` | skillsUsed / isKnownSkill / skillsEngagedByToolCalls. |
| `src/sessionTokenGate.ts` | Session token budget gate before LLM turns. |
| `src/skills.ts` | Skill detection + SKILL.md loading from Skills/. |
| `src/skills/eduVideo/planning.ts` | Deterministic segment planning validators for edu-video. |
| `src/skills/eduVideo/prePipelineCheckpoint.ts` | Edu-video front-load prefs checkpoint. |
| `src/skills/talkingHead/prePipelineCheckpoint.ts` | Talking-head front-load prefs checkpoint. |
| `src/storage.ts` | GCS/Firebase storage upload/download helpers. |
| `src/storageContentDisposition.selfcheck.ts` | Assert-style selfcheck for `storageContentDisposition` invariants (run via ts-node/tsx). |
| `src/storageContentDisposition.ts` | Content-Disposition header helpers for downloads. |
| `src/systemPromptCache.ts` | mtime-cached AGENT.md + SKILL.md system prompts. |
| `src/taggedAssets.selfcheck.ts` | Assert-style selfcheck for `taggedAssets` invariants (run via ts-node/tsx). |
| `src/taggedAssets.ts` | Resolve tagged/chat assets into session paths. |
| `src/tools/general/clarify.ts` | ask_clarification → checkpoint tool. |
| `src/tools/general/filesystem.ts` | run_command, read/write/search/str_replace tools. |
| `src/tools/general/image_generate.ts` | Fal image generation queue tool. |
| `src/tools/general/mediaModelRegistry.ts` | Closed enum of Fal image/video models + inputs. |
| `src/tools/general/video_generate.ts` | Fal video generation queue tool. |
| `src/tools/general/vision.ts` | vision_analyze tool. |
| `src/tools/general/web.ts` | web_search / web_extract tools. |
| `src/tools/graphify-out/.graphify_labels.json` | Graphify knowledge-graph artifact (cache/report/graph). |
| `src/tools/graphify-out/.graphify_root` | Graphify knowledge-graph artifact (cache/report/graph). |
| `src/tools/graphify-out/GRAPH_REPORT.md` | Graphify knowledge-graph artifact (cache/report/graph). |
| `src/tools/graphify-out/graph.html` | Graphify knowledge-graph artifact (cache/report/graph). |
| `src/tools/graphify-out/graph.json` | Graphify knowledge-graph artifact (cache/report/graph). |
| `src/tools/graphify-out/manifest.json` | Graphify knowledge-graph artifact (cache/report/graph). |
| `src/tools/index.ts` | buildTools: factory aggregate + single-skill filter. |
| `src/tools/lib/audioChunks.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/cloudRenderFlags.selfcheck.ts` | Assert-style selfcheck for `cloudRenderFlags` invariants (run via ts-node/tsx). |
| `src/tools/lib/elevenLabsStt.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/ensureFullAudio.selfcheck.ts` | Assert-style selfcheck for `ensureFullAudio` invariants (run via ts-node/tsx). |
| `src/tools/lib/ensureFullAudio.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/flacSourceUrl.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/hfProjectSync.selfcheck.ts` | Assert-style selfcheck for `hfProjectSync` invariants (run via ts-node/tsx). |
| `src/tools/lib/hfProjectSync.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/manimGuard.selfcheck.ts` | Assert-style selfcheck for `manimGuard` invariants (run via ts-node/tsx). |
| `src/tools/lib/manimGuard.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/manimOrientation.selfcheck.ts` | Assert-style selfcheck for `manimOrientation` invariants (run via ts-node/tsx). |
| `src/tools/lib/manimOrientation.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/manimScriptPath.selfcheck.ts` | Assert-style selfcheck for `manimScriptPath` invariants (run via ts-node/tsx). |
| `src/tools/lib/manimScriptPath.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/normalizeElevenLabsTranscript.selfcheck.ts` | Assert-style selfcheck for `normalizeElevenLabsTranscript` invariants (run via ts-node/tsx). |
| `src/tools/lib/normalizeElevenLabsTranscript.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/normalizeTokens.selfcheck.ts` | Assert-style selfcheck for `normalizeTokens` invariants (run via ts-node/tsx). |
| `src/tools/lib/orientationGuard.selfcheck.ts` | Assert-style selfcheck for `orientationGuard` invariants (run via ts-node/tsx). |
| `src/tools/lib/orientationGuard.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/ownedEditFiles.selfcheck.ts` | Assert-style selfcheck for `ownedEditFiles` invariants (run via ts-node/tsx). |
| `src/tools/lib/ownedEditFiles.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/parseBrandColorsFromText.selfcheck.ts` | Assert-style selfcheck for `parseBrandColorsFromText` invariants (run via ts-node/tsx). |
| `src/tools/lib/remuxMp4Faststart.selfcheck.ts` | Assert-style selfcheck for `remuxMp4Faststart` invariants (run via ts-node/tsx). |
| `src/tools/lib/remuxMp4Faststart.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/renderSnapshot.selfcheck.ts` | Assert-style selfcheck for `renderSnapshot` invariants (run via ts-node/tsx). |
| `src/tools/lib/renderSnapshot.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/resolveCompositionDuration.selfcheck.ts` | Assert-style selfcheck for `resolveCompositionDuration` invariants (run via ts-node/tsx). |
| `src/tools/lib/resolveCompositionDuration.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/scaffoldInputDiff.selfcheck.ts` | Assert-style selfcheck for `scaffoldInputDiff` invariants (run via ts-node/tsx). |
| `src/tools/lib/scaffoldInputDiff.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/sessionManimClips.selfcheck.ts` | Assert-style selfcheck for `sessionManimClips` invariants (run via ts-node/tsx). |
| `src/tools/lib/sessionManimClips.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/strReplaceDecode.selfcheck.ts` | Assert-style selfcheck for `strReplaceDecode` invariants (run via ts-node/tsx). |
| `src/tools/lib/strReplaceDecode.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/strReplaceNotFound.selfcheck.ts` | Assert-style selfcheck for `strReplaceNotFound` invariants (run via ts-node/tsx). |
| `src/tools/lib/transcriptSanitize.selfcheck.ts` | Assert-style selfcheck for `transcriptSanitize` invariants (run via ts-node/tsx). |
| `src/tools/lib/transcriptSanitize.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/transcriptStitch.selfcheck.ts` | Assert-style selfcheck for `transcriptStitch` invariants (run via ts-node/tsx). |
| `src/tools/lib/transcriptStitch.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/transcriptionLanguage.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/transcriptionProgress.ts` | Shared pipeline helper (transcription, Manim, HF sync, render, etc). |
| `src/tools/lib/transcriptionRouting.selfcheck.ts` | Assert-style selfcheck for `transcriptionRouting` invariants (run via ts-node/tsx). |
| `src/tools/lib/utils.ts` | Session workdir, execCommand, sanitized env, path helpers. |
| `src/tools/pipeline/concepts.ts` | extract_concepts tool + concepts checkpoint. |
| `src/tools/pipeline/hyperframes.ts` | scaffold_hf_project / plan_segments / render_hyperframes / restore. |
| `src/tools/pipeline/manim.ts` | generate_manim_script / render_manim_clip tools. |
| `src/tools/pipeline/talkingHead.ts` | scaffold_talking_head_project tool. |
| `src/tools/pipeline/transcribe.ts` | transcribe_video tool + Fal STT queue. |
| `src/tools/pipeline/transcriptionLanguage.selfcheck.ts` | Assert-style selfcheck for `transcriptionLanguage` invariants (run via ts-node/tsx). |
| `tsconfig.json` | TypeScript compiler options for the agent service. |

---

# Part 2 — `Skills`

## 2.1 Purpose

Agent **skill packs**: `SKILL.md` (prompt), `skill.json` (harness manifest), references, templates, HyperFrames sub-skills, Manim, talking-head styles.

## 2.2 Top-level skills

| Folder | Role |
|---|---|
| `AGENT.md` | Shared agent preamble for all skills |
| `background-generation/` | Background image/video skill (narrow tool set) |
| `edu-video/` | Lecture → concepts → Manim → HyperFrames pipeline |
| `talking-head/` | Talking-head card overlay packaging |
| `manim-video/` | Manim-only focused skill |
| `hyperframes/` | Large HyperFrames skill ecosystem (core/cli/creative/media/animation/…) |
| `graphify-out/` | Graphify index of the Skills tree |

## 2.3 Similar-file families (Skills)

### `SKILL.md` (23)

- `background-generation/SKILL.md`
- `edu-video/SKILL.md`
- `hyperframes/SKILL.md`
- `hyperframes/embedded-captions/SKILL.md`
- `hyperframes/faceless-explainer/SKILL.md`
- `hyperframes/general-video/SKILL.md`
- `hyperframes/hyperframes-animation/SKILL.md`
- `hyperframes/hyperframes-cli/SKILL.md`
- `hyperframes/hyperframes-core/SKILL.md`
- `hyperframes/hyperframes-creative/SKILL.md`
- `hyperframes/hyperframes-media/SKILL.md`
- `hyperframes/hyperframes-registry/SKILL.md`
- `hyperframes/media-use/SKILL.md`
- `hyperframes/motion-graphics/SKILL.md`
- `hyperframes/music-to-video/SKILL.md`
- `hyperframes/pr-to-video/SKILL.md`
- `hyperframes/product-launch-video/SKILL.md`
- `hyperframes/remotion-to-hyperframes/SKILL.md`
- `hyperframes/slideshow/SKILL.md`
- `hyperframes/talking-head-recut/SKILL.md`
- `hyperframes/website-to-video/SKILL.md`
- `manim-video/SKILL.md`
- `talking-head/SKILL.md`

### `check-* scripts` (4)

- `hyperframes/embedded-captions/scripts/check-occlusion.cjs`
- `hyperframes/embedded-captions/scripts/check-overflow.cjs`
- `hyperframes/embedded-captions/scripts/check-rail-climax.cjs`
- `hyperframes/embedded-captions/scripts/check-timing.cjs`

### `graphify-out artifacts` (1185)

- `graphify-out/.graphify_labels.json`
- `graphify-out/.graphify_root`
- `graphify-out/GRAPH_REPORT.md`
- `graphify-out/cache/ast/v0.8.40/005868f990d20d796fb834457dfa315cb785d9fb460922d71553a397900bd11e.json`
- `graphify-out/cache/ast/v0.8.40/010bae2eca17e8115036f667327bd70a10f35e684e59fea3dc8963e2456d7c06.json`
- `graphify-out/cache/ast/v0.8.40/0258c7dd8fadc004d46727fb231331cb6713949b0b4caa98a3c7c1cc45716afb.json`
- `graphify-out/cache/ast/v0.8.40/02f50a70b974fb39ea54392fb4fb44fab6f6b6d7e836bc5b0f8fdd5156b05b58.json`
- `graphify-out/cache/ast/v0.8.40/040f31c4ebc9654b6cccf948e3d94ce6630f8973e993ab3bf1f58b48cef24714.json`
- `graphify-out/cache/ast/v0.8.40/047675fc429e1805022cbf43fb9dd92a331134693bb20ecf30578834d50a1007.json`
- `graphify-out/cache/ast/v0.8.40/04b18dd88ecdc5ae0b3d8e41dffd1fbe139326c61ad82f0141bee220f1c38d92.json`
- `graphify-out/cache/ast/v0.8.40/0527936ca3a15cb0ef12b25cde9ff41eca4a251e382e42ee0f760ea75adc62b6.json`
- `graphify-out/cache/ast/v0.8.40/060c0f14d6a2d13c1f6f8be07ce074ff3ebd42000afe72ad3254a3765ec6cefe.json`
- `graphify-out/cache/ast/v0.8.40/06282c23f5f7a43f95c7582eefa853a95033dc068775ee88de0c9e771f2f98c5.json`
- `graphify-out/cache/ast/v0.8.40/068f8532376fecb641da7b0246d6a51d0f6c6cc7c7c2e86383c0f3a3b2b0e439.json`
- `graphify-out/cache/ast/v0.8.40/0755b6ba6dfc8700cac680c76c255d34c90f4a8647c90a709d4cff865e976604.json`
- `graphify-out/cache/ast/v0.8.40/079fbabdadc525c3dcc44bff025f3491e6c2036757bed4b9289d37c1cb3eda5d.json`
- `graphify-out/cache/ast/v0.8.40/080c3fba45e44c5f8cb31581efa05e435a92653310275c90e294ca4ba38bd10d.json`
- `graphify-out/cache/ast/v0.8.40/094f0bafb8ae362d4f89cabc845bc1324f1de262455a5da962dd250938729240.json`
- `graphify-out/cache/ast/v0.8.40/0add325653f4bc752631c30540a2ffceb453461b2f4dbc6ee0c122492a99737d.json`
- `graphify-out/cache/ast/v0.8.40/0b0e268344bbb65c8d99b88c7c8385ee3c98592b22d45643c630a800cb7e6089.json`
- `graphify-out/cache/ast/v0.8.40/0b64d203ac73acc1d03143f1a36bd86df744cbb0e93027bc11da1fec6b2d078b.json`
- `graphify-out/cache/ast/v0.8.40/0c42ac0ae82304a626f457ea2fc09902f39a77bd21c2a322672101cf1767a348.json`
- `graphify-out/cache/ast/v0.8.40/0c60bac0cb7f7fb65bfcbc224a437a03c6e41f53ef9dc22992f7a9b40010c982.json`
- `graphify-out/cache/ast/v0.8.40/0e628260d42588bb0b7a5e03a5b7d6a9a48ca6773de25ac78c649fa1d9a6110d.json`
- `graphify-out/cache/ast/v0.8.40/0e7f00d5e14000963cd62f224414d28aeda683c91d0d4ca66252594a0b272f90.json`
- `graphify-out/cache/ast/v0.8.40/1023d615fb77246e3d71fbfaa95f161c1df42e5190b4f6de75a546f5be7f79d6.json`
- `graphify-out/cache/ast/v0.8.40/109e98985e91347207b57ea2e0e6f0e90a6574d470d6966a5aa045c0f626c08d.json`
- `graphify-out/cache/ast/v0.8.40/121d0a16c304f71588306908a4a44905c31b305252f173b03373524ab9449cd7.json`
- `graphify-out/cache/ast/v0.8.40/1249f5385ba4adf5e72d61494bfa3c68a0bdbb76e935e8fc136c4acba291caf5.json`
- `graphify-out/cache/ast/v0.8.40/1278094427c257fcab07245f1b764d6c93b09f9b5938d82f2b89790c3cf5e553.json`
- `graphify-out/cache/ast/v0.8.40/12e7f66b8e5ffde6bd9bda1c3b92218c4af3d1215f921de0dcedf0e3dd478a20.json`
- `graphify-out/cache/ast/v0.8.40/13f7b6e52d251975c23d04646b999f774a7a02b5edbec96424e61ab5c46c978d.json`
- `graphify-out/cache/ast/v0.8.40/156638dbcb2adfcf56f8657b368abb952895f9789e76728ba324df2345a66e00.json`
- `graphify-out/cache/ast/v0.8.40/175b8dd82ceea599c270894be831aa205acc07e6a9f8a44b17e40684986581aa.json`
- `graphify-out/cache/ast/v0.8.40/17ea27af9bf30266982bd895013659f38ae957f0a86fc2b2d4d5f51694907131.json`
- `graphify-out/cache/ast/v0.8.40/1bf603acb628c719480a896f2f9de4b44ce6777b223b7f9bad137add88a15074.json`
- `graphify-out/cache/ast/v0.8.40/1bf67e63383a1e02560f269ae6d124be09600497470909c3e8aafd2e74668897.json`
- `graphify-out/cache/ast/v0.8.40/1c6ad14d2dbff8a2b8d451a43c7174fd677bb9d4f0444eb3dd45990456507aa3.json`
- `graphify-out/cache/ast/v0.8.40/1c94b8eb50ac4e8899c43c7a897d5e189e52246c2d966c035de1b15e95d02122.json`
- `graphify-out/cache/ast/v0.8.40/1ce23bade69c90ef74e5d2a432153b02e02d0555876d275a904d13d868c174f1.json`
- `graphify-out/cache/ast/v0.8.40/1d77bd81d06b12700a029d6d1d4f0a2272c070db27adb6c8450c79221f3d4488.json`
- `graphify-out/cache/ast/v0.8.40/1e74093834ec55d9918bba44a423b751bc711141ab40274f3292ca74d2977985.json`
- `graphify-out/cache/ast/v0.8.40/1f65282132c8328e841a935c91a53b06b31aadc06e1d81818b3b2ff30c4b978a.json`
- `graphify-out/cache/ast/v0.8.40/1f9dbe906a5718c95df107d2bf7b343f0bcb41678d59fc208e0de323d44e07d2.json`
- `graphify-out/cache/ast/v0.8.40/1fb57a9ae1718ab6900b3dc3fef7b5c70f07f4f371b18c1287cfb06325f26d9d.json`
- `graphify-out/cache/ast/v0.8.40/1fc271b331e9fdc545f6c1a33c3147415a84ebcacf1d0388fe977cef45fb0b77.json`
- `graphify-out/cache/ast/v0.8.40/1fd36f524253a98f2c49f780253be5855dd8ee018113b516f661f844a9dada9b.json`
- `graphify-out/cache/ast/v0.8.40/203cabda82b4476d14c93a7a684482a265e820e3268184e17e193005d970ace1.json`
- `graphify-out/cache/ast/v0.8.40/207237ba0edfe467917c1db342afdb2906e87c5157b534d05b315279da9340e2.json`
- `graphify-out/cache/ast/v0.8.40/21396ec979a12fb850092f6b5a514141fe02ee82b740d1dcf987948c69cf544a.json`
- `graphify-out/cache/ast/v0.8.40/214e2bc538765e627e780a9cbb24482ac8ffe8ca5bd960cac2d974218cd653b4.json`
- `graphify-out/cache/ast/v0.8.40/216592249b7822148a2ba88f3a0fba6f276ed795cc89342bb17c7db07ad14ff8.json`
- `graphify-out/cache/ast/v0.8.40/23124981ef0ada0e9d9e0b760c5d3720091d9f2120e032acb5a2defd128c603c.json`
- `graphify-out/cache/ast/v0.8.40/23ab44e7bc0ef891250912e35fbb1184851c194a81ba3ba8a7c3525677afbc45.json`
- `graphify-out/cache/ast/v0.8.40/24a02395ee0ae6e4b1250ec5dc69f657785bdfc5460437bff5ebb53f1e44e7ee.json`
- `graphify-out/cache/ast/v0.8.40/24dc73046af2fe9f9f78d98fe514ded4fbfbe7e6afb8ec19719baa6b7078bc9d.json`
- `graphify-out/cache/ast/v0.8.40/24fa19ca9dd42969ade39aa800959311ad8ad6b4a2e4fdc961c3d0ac5b77f70c.json`
- `graphify-out/cache/ast/v0.8.40/251cf4dfcfc05f9c28ecf79bf40e68ce1035c565bb55b8368066bc2a9b4e99fa.json`
- `graphify-out/cache/ast/v0.8.40/25d0666f2aeb15194078d28c0d63a21a3cc734c2cb89f10c936affb808334b12.json`
- `graphify-out/cache/ast/v0.8.40/268265b50b8a5d49cdb8a408da7b633b8afbee5fa2d959da764279bcf6d96f2e.json`
- `graphify-out/cache/ast/v0.8.40/26bb0ea52cb4b46dde1a2d1f67f99bae40c59955082685a76ed9822211f238ae.json`
- `graphify-out/cache/ast/v0.8.40/26cc1827f381b6e705c7ff03d72c0717ef521a54ac31f1bfb7a5c6a33fc2afe2.json`
- `graphify-out/cache/ast/v0.8.40/26e8d4d014e89d372424fe93d08496f2e72407a3d1b967b56f06257da6d055d1.json`
- `graphify-out/cache/ast/v0.8.40/275a8d3334cb9e5ee9f190c1553beaff36d33ae12f1678eceafd0c396358f235.json`
- `graphify-out/cache/ast/v0.8.40/289dc7adf9be644284f48d7942a74e6cb938d6faec375f07dc07c7e7f95ce507.json`
- `graphify-out/cache/ast/v0.8.40/29a07677477f430dcb575aed8ddaa354624aeb8de2f3fc3422d9dd8b9b77bed0.json`
- `graphify-out/cache/ast/v0.8.40/2a3a2306a422fa00e08e8cf42218abe347fc7b99429f06f5fa90ab1c6b07cd91.json`
- `graphify-out/cache/ast/v0.8.40/2b8007d7d2486aa689729bf7111bd4a187347756d7981a364ad7f3af525ed5b8.json`
- `graphify-out/cache/ast/v0.8.40/2c075eb0602cdac4a1a26e24d0bfd2cbeb23981c34d8b09641e564e89b27a0f9.json`
- `graphify-out/cache/ast/v0.8.40/2d3a3626e8839a766263ce9c131ad0e1774669a41bac12e3436299da2d93796a.json`
- `graphify-out/cache/ast/v0.8.40/2e5b056da5b6b92b92f406abfb8f4b8885a09a0326de2337fd475eb639e0cdec.json`
- `graphify-out/cache/ast/v0.8.40/2ecb953811efa832e5505a29ec0e612587ecba5d1bef133a125b4a39b9681d28.json`
- `graphify-out/cache/ast/v0.8.40/2ecd019277f01c941aa881906ef175626b1fcf8e341b43cd09abe2f80d70b7d5.json`
- `graphify-out/cache/ast/v0.8.40/2f33c4ef2834791c7671657f92b024dfc646ea22f22a0dd137f4ae9cd411a624.json`
- `graphify-out/cache/ast/v0.8.40/30f8ea6a932f5f77361e63aafea0489a8c8ee93559bb6a925addc54465d7eee0.json`
- `graphify-out/cache/ast/v0.8.40/32435de9674865d5732c7c0b9976ada019a8d211c2dee5d0df7a6092590d63ff.json`
- `graphify-out/cache/ast/v0.8.40/328283fcc7cd632db6922d863959e46f8fe8f534236ac40d6e904d6b946e9fa3.json`
- `graphify-out/cache/ast/v0.8.40/33321d755c73ccb38eb0791000763937d4cdc58c37335e9cb3e1def158409a28.json`
- `graphify-out/cache/ast/v0.8.40/3371a2905230a51bd9bfec91f35c40dd60a6d11b411f3ad9a19baa0c5d2a9307.json`
- `graphify-out/cache/ast/v0.8.40/3376f28226e3b2255baf06fd2c5e931dee8836ac3cec88bbd13d52c3fb3c75ea.json`
- `graphify-out/cache/ast/v0.8.40/34b558be4ce24e286a7d8c39c1655f41a32542402525a94260b7398a6158e0e3.json`
- `graphify-out/cache/ast/v0.8.40/35560801a1b2e365e53071324c001bf1b3bb1d6204404074d50d48ce9587ad26.json`
- `graphify-out/cache/ast/v0.8.40/35baa321ed2768c48be467db3c5966d977346e0bc789700f3665647140bd1cad.json`
- `graphify-out/cache/ast/v0.8.40/35c071891803274bfba3529cfe491cb0514d30966ec1dd688eb9386dd3b4f2f8.json`
- `graphify-out/cache/ast/v0.8.40/3734bfbc0e1f697deb8660ad86207dcdce77cb2376ec258487729abc080f5bba.json`
- `graphify-out/cache/ast/v0.8.40/375824d7da7ad42b0f035a5e18bebcdde5b9fe635bffb88f5221d3e4c4cb5748.json`
- `graphify-out/cache/ast/v0.8.40/379ac71d1041de5870eed4e632aa21a5495fd2c13d52ce7ed5f558a0b59f3100.json`
- `graphify-out/cache/ast/v0.8.40/37c8ca6b87587e820158ffa0d2bcbb0d4edacfbc2e4888aab3dfcc6dadc3983c.json`
- `graphify-out/cache/ast/v0.8.40/37ca1a8067b3056980320459df09622d9836f16ec866090ee11e12c9841e1300.json`
- `graphify-out/cache/ast/v0.8.40/37cb4352a2d1c384a40c3ff8e2b5c1ba2b2c57521cd362323ce0e218a530b684.json`
- `graphify-out/cache/ast/v0.8.40/3897c0e07be95585bf0587522c392333d54c4a2949139369a1ed4e254373f838.json`
- `graphify-out/cache/ast/v0.8.40/39455860a8f3245a933396750fd0eb1e7e40324db40c36db008de19aaa336f52.json`
- `graphify-out/cache/ast/v0.8.40/39566eb73c1514d24882e95c2347d64086fd71849c779d7f5238ee1a69f68c42.json`
- `graphify-out/cache/ast/v0.8.40/39eb580a098b9fbc76b06d3a58a32306470977deeccc9980524e83f078a167f5.json`
- `graphify-out/cache/ast/v0.8.40/3b0ed844e0d787da28559af21abc27ec034aae1c23e6acc1f343acf225e5898b.json`
- `graphify-out/cache/ast/v0.8.40/3bfff7e3538c15d81c2f94758e933e53968b4f290bf091a4deb6163645d99525.json`
- `graphify-out/cache/ast/v0.8.40/3d8150312e7181662a947f818c45f1caecabda5b1d12e5e74001f4833d677f15.json`
- `graphify-out/cache/ast/v0.8.40/3e1066a3a60d501f16b08b5a4aac0068809dd577154adefb4be57f79ac9573b8.json`
- `graphify-out/cache/ast/v0.8.40/3f875a650a6e7fe47c25b0f84c8465d625ce9b5162f94436b81e7d38e2ac7441.json`
- `graphify-out/cache/ast/v0.8.40/406ae521729c44a66e5b7a5391c408126e91ace45a4181dc4e2358348218155a.json`
- `graphify-out/cache/ast/v0.8.40/413fe37b361ed616ae9e4fb2b46803b5a177628bc6486e6c4120f9490a10d9a7.json`
- `graphify-out/cache/ast/v0.8.40/416167821ca88c3202ac306276ac7670f8e538c3b9f4382f654e2649969c9800.json`
- `graphify-out/cache/ast/v0.8.40/427a3efb8e6ac35801cea5bd1498459a06be3fb4b4356100a91fda12c5db24dd.json`
- `graphify-out/cache/ast/v0.8.40/42c8d77bcdd083d1007a6ced9414faf9c630aabfedcd2ff63e4583112be6bc5d.json`
- `graphify-out/cache/ast/v0.8.40/440196e5d9a21dd60cd8a0ac17ecd82753c583d72111885c12798fa07fd42e13.json`
- `graphify-out/cache/ast/v0.8.40/459b89690752c5d23427a4369e4efd1708a8a30c1a119b7f1837053df5d1cab4.json`
- `graphify-out/cache/ast/v0.8.40/45fdd66caa64092b20da5840745c7fbde2dedd4b216dee66facc3a090b4eef9f.json`
- `graphify-out/cache/ast/v0.8.40/46aa2e0d8dfb1a23f6ec50e28060c197be3071bbb2ad281ea98107b4a8a3d46e.json`
- `graphify-out/cache/ast/v0.8.40/46d232cb947bb7aa2ff5a2ea90194b31b5640121c3df61e5c0084b108e7168f9.json`
- `graphify-out/cache/ast/v0.8.40/470f3990debdba1d546f13da5ca14ce938a99ae67ae913d346e137c09e05cd8c.json`
- `graphify-out/cache/ast/v0.8.40/474bd83b1d585ec1729706f84b4117af7c1ccfbd868949d30291b3c84f02bc75.json`
- `graphify-out/cache/ast/v0.8.40/48786b4fd4d58222d2cf84c5d9869bcd6ab27abbb877ae86756e9f8d84280819.json`
- `graphify-out/cache/ast/v0.8.40/48b346210d7306762fda1588976f77884db6675aedf029a55d8f1a35dcbb21e4.json`
- `graphify-out/cache/ast/v0.8.40/493b1caebbb1f06950c975d37601e899ae91de6bc39967047956bbf39c06db8b.json`
- `graphify-out/cache/ast/v0.8.40/49be99efd90b5ad2a70f712928f8294e177742362639a32fd136cd5c2ca17fec.json`
- `graphify-out/cache/ast/v0.8.40/49e7c1c5b88f0e78def805392eb7dfbd1220f589adb245dcbd4581470ac78e6f.json`
- `graphify-out/cache/ast/v0.8.40/49fdfb00f7726b2b8e39d3cc69dcc8004a83ee2ee61fc67c5034470e6b6020b6.json`
- `graphify-out/cache/ast/v0.8.40/4b49c7071661191e56c20395c97e2882956bd196ec07a22e8b6dc5d2363d2a3c.json`
- `graphify-out/cache/ast/v0.8.40/4bbcddd33f6a1338721b14b369aba96e7f60e974e0b545d0033ba0e1f2255049.json`
- `graphify-out/cache/ast/v0.8.40/4d77b083b7e9d91dbf3808b2adc5a7840d1cb8e966063d6ac32315490aec9660.json`
- `graphify-out/cache/ast/v0.8.40/4dd719fff309ffc706057f5802d907ffd5ae86413de50971cbd3f91cc4196223.json`
- `graphify-out/cache/ast/v0.8.40/4f8ea592ae86fe765f7e579fbfcf83b24958673fd31118a4fd8e178a8b8fb9c2.json`
- `graphify-out/cache/ast/v0.8.40/5087b626556ad5909ed4068ad82f9800b69588c4b900c75e4ce65072761363ae.json`
- `graphify-out/cache/ast/v0.8.40/50be7201db9d586f67d56841275bc2fc3f233db986a18627552b6439b578bc49.json`
- `graphify-out/cache/ast/v0.8.40/51493d175ac54a912689688cba625c6af7eeffa528b7799a6f96729f17d9c73c.json`
- `graphify-out/cache/ast/v0.8.40/5156dd15f4b8cfbe4ef2bb4745f433c050c9877920de5073c34b3aad421cd71e.json`
- `graphify-out/cache/ast/v0.8.40/516b6062abd721897a3417ab357c00b2216a8b6b541014d1ecab223da4c20f29.json`
- `graphify-out/cache/ast/v0.8.40/51a1ff3ea491d6326c7753c02d5dc6feb088bf0940edfb170404b022a6c4ba2c.json`
- `graphify-out/cache/ast/v0.8.40/51a2f9dabb01d3cc632454f029b2d28457f4c6d51c1aa41a3dcbda26856e9adc.json`
- `graphify-out/cache/ast/v0.8.40/5266c38ec9c50d95620cb4718caea55e0076981b68257faab2a0d5a83182d97f.json`
- `graphify-out/cache/ast/v0.8.40/540c9ebb1a4b41f61ef72faf91733e7bb2392b4a7bbdc02bacd033b2273be6cf.json`
- `graphify-out/cache/ast/v0.8.40/5435921a356066835eec6b0952c4d978b6c1f6573fd8995b5e31b0170248925b.json`
- `graphify-out/cache/ast/v0.8.40/546a757e3f90d9719ae79f4ee1d77e74400d1390e696104df11e1eb73e2ca305.json`
- `graphify-out/cache/ast/v0.8.40/54c3286aa569348d3e2257b76505cd7846d7ed5db834270d32beaae0a1972683.json`
- `graphify-out/cache/ast/v0.8.40/54ca42a24543b22c75808dc5722fe3c25d668f230067dfb22c1d919915e6fc57.json`
- `graphify-out/cache/ast/v0.8.40/574cf513a0dadd24ab2e7fac3ce2971bd275bbeaeb6a6a9adb6a1c01dad1238d.json`
- `graphify-out/cache/ast/v0.8.40/595a96d12e2ad002424f237e4f8d57fe55b01a85d68345d31b86892855e72a73.json`
- `graphify-out/cache/ast/v0.8.40/5990ffbe74dffdc50e5e5906279020d85af44b49bd25377ab518e7274d14d15e.json`
- `graphify-out/cache/ast/v0.8.40/59e2f809fba1bf6022431919ac7a2161862ad7753f4e2a367d65ac1c5a2db188.json`
- `graphify-out/cache/ast/v0.8.40/5be8d562b41ba5a4034a7424b808efa07ad87772fa1d0e0586f3a856a66774b2.json`
- `graphify-out/cache/ast/v0.8.40/5c130973144a775b869fb5149ae6ad90bd9d649e03b0c3a47e5a8997369030aa.json`
- `graphify-out/cache/ast/v0.8.40/5c2c5fa95f5747de8780fbcf33425159f5c57ca7239e532a31329019a3b03c65.json`
- `graphify-out/cache/ast/v0.8.40/5c82dec2d0a2157e37607e8fde44f6fe5d3ade5bb776f29beb8355aa84cfe15c.json`
- `graphify-out/cache/ast/v0.8.40/5c9e75f80c82216be957c1e5df920c23b902ccc1ab0e8682d7b0a8b4106befca.json`
- `graphify-out/cache/ast/v0.8.40/5cfe3cb1120eba77215b7e56f77f8b255860a5db175b327825dbbdb87d8d858c.json`
- `graphify-out/cache/ast/v0.8.40/5d58964d2874ff9ed3872b19f1c4e9285a855c07fde723666ec06dc1b7206be5.json`
- `graphify-out/cache/ast/v0.8.40/5d81eda060c3c274feeb6504b9b51f693082aece5cb9e2f5b667780431cdf706.json`
- `graphify-out/cache/ast/v0.8.40/5e63997d3e18c7dc7f0ed82e4583f7f8138a7a03c5f4128568141703f87306c4.json`
- `graphify-out/cache/ast/v0.8.40/5e9a54c2ec0432ec468da107394e492c1b47d12d090ffc0e86fc7cf94b1fec3b.json`
- `graphify-out/cache/ast/v0.8.40/5f5db55e143ffaaab7b61bb08f7f9059a57c06c8949df0f4649c163610066fef.json`
- `graphify-out/cache/ast/v0.8.40/604458e343157a8f4d119f0d8cb8a578ddb1d12e6148deb0915b091e941209fc.json`
- `graphify-out/cache/ast/v0.8.40/6141a8035da3e6b18da503d2621b9f21a298275de603baff85ed739c45f49ede.json`
- `graphify-out/cache/ast/v0.8.40/616bd3d77749936f2bb95cc7d98e2e9c115a27df4cba4de6b7d86ed874676dba.json`
- `graphify-out/cache/ast/v0.8.40/619fad265c462a11ddacfbdf58f2517c6e325daeb57bfd6300650a1a9e3298a3.json`
- `graphify-out/cache/ast/v0.8.40/62999312b2f2678cb0ab5df557bb4e2aad0a76182c3213bb3c9b421fdaa77610.json`
- `graphify-out/cache/ast/v0.8.40/63157c63cb68371a69dd43705285c7bfbd5e64942ffc6b7b3c6754bb1152ab9b.json`
- `graphify-out/cache/ast/v0.8.40/638cace2d98cdfef543044c17c97343efecfff73b9a15e7a015e5dc5b3d8fa9f.json`
- `graphify-out/cache/ast/v0.8.40/638ff256cb0de1dad379e2d615accd40d9db220e7d2cecc8801778fdcfc4de7c.json`
- `graphify-out/cache/ast/v0.8.40/63b43a2fbcea9f7e4a54746a4d88036bdc3812bee6755d351df1d3841b3867af.json`
- `graphify-out/cache/ast/v0.8.40/64a8adf739e0a8886eacd8acec37189d6ba873d7a28caa1660455c7b194cf2d9.json`
- `graphify-out/cache/ast/v0.8.40/64e1460d37e9b88edd779866828add84efbe055b24787014f4f75740305216b6.json`
- `graphify-out/cache/ast/v0.8.40/652c065795f3f6d3d5fc2561c307def1b49547458ce11a4d467140980d31e9cd.json`
- `graphify-out/cache/ast/v0.8.40/6635cf55db1f0c76bcf7ea2440adac03893f69922ac1586140d0f296e11056a5.json`
- `graphify-out/cache/ast/v0.8.40/672f74fb760a1c3fe49044a8197916bdf412ab00b21c9c984f89ac07aaaf5321.json`
- `graphify-out/cache/ast/v0.8.40/67eb784c43597aef781f1ce1c12f4e490abfa3ee34ea650b7093ef172d3de58b.json`
- `graphify-out/cache/ast/v0.8.40/681ff15432484fa5acb61cb7d7d43c5243aa5d08b322be2d48ad68a1a38eb04f.json`
- `graphify-out/cache/ast/v0.8.40/6922c5c46f008600df11bf1f0e77d3c50491c8b448df5471cb687ca9e0ab5047.json`
- `graphify-out/cache/ast/v0.8.40/69b38358089a68f7a54a7763170db7a6d75ba6c1bbdd705c060848d874c6c068.json`
- `graphify-out/cache/ast/v0.8.40/6a0626a5a9fa366ea88bb24062b952a7c988e9524b37068782689d6c4e247ca8.json`
- `graphify-out/cache/ast/v0.8.40/6b548ab764597bebb01218d30829634ba6a9b3afdc9a8e948024dbd386d55916.json`
- `graphify-out/cache/ast/v0.8.40/6b722465a53536f1069b403b498e0a5591b2c7959cd5a3a64b486217b528f5c8.json`
- `graphify-out/cache/ast/v0.8.40/6b968e300d4d18ae00c1dde2ad8820271afe3d936346f23c9fd81a85974cee25.json`
- `graphify-out/cache/ast/v0.8.40/6bf674825311e07b916b138d6638a71f8e5036caad1603ad0728417bf4f5b2e8.json`
- `graphify-out/cache/ast/v0.8.40/6c87755a595892588a5dafb9d2d5bea4790ecf914990d0edf726de980599aeec.json`
- `graphify-out/cache/ast/v0.8.40/6cbf15b93b368855110845b4e61ab9752f9374a3607d9da84bd22d8d2e90b16f.json`
- `graphify-out/cache/ast/v0.8.40/6ccb6e6c074f0cbb46ad2422e1e3051949f838da9f3bdea8d3782d91cb668887.json`
- `graphify-out/cache/ast/v0.8.40/6cfc1f1e7a083bb19e8933651ff2e79eb745eca2484635b1cc3cb9f2d25d0c28.json`
- `graphify-out/cache/ast/v0.8.40/6d21ba2d130fa0756942b98a362c210d9dd01183176d6f5cff3fc2df827d6163.json`
- `graphify-out/cache/ast/v0.8.40/6d21fd3cf436ce3ee4816b167cce3da19c427311fcc1db277d010d5a187543e9.json`
- `graphify-out/cache/ast/v0.8.40/6d5db194fdd05edee58cf2b15ad22af56c478392fc15728d489021d2467fc0be.json`
- `graphify-out/cache/ast/v0.8.40/6db10413c5fbe202ed8951c226f4bfac086577b14db1823c1301142f3861e9d3.json`
- `graphify-out/cache/ast/v0.8.40/6dd3a985d8d032ea8d66c0f295753bcffb817f99e535de92128816b5ea69f7e4.json`
- `graphify-out/cache/ast/v0.8.40/6e57534544e8d2e964130b044080609cc86277b3c55b403c4696121839445af9.json`
- `graphify-out/cache/ast/v0.8.40/6e739aa5989c6b6441cff967ae0ba597053f64dd7915b2e6d9455936e0cc9142.json`
- `graphify-out/cache/ast/v0.8.40/6e77744c15e1dbce8089c7cfccc506225931a1bfcf540defbe2e1d971be477f0.json`
- `graphify-out/cache/ast/v0.8.40/6f19c1b4719f3894b984cd33f64df5601f574d33bc1a62306255dcfbfef64720.json`
- `graphify-out/cache/ast/v0.8.40/6f8cba41b9e588df8d95da4977575da4a6006983c7dd89ec4cb0a5b4b39996b8.json`
- `graphify-out/cache/ast/v0.8.40/6fdd011fbfe4bb27208d70779b11310c3c95e7f4d85ba894906a0b8c6aa67f46.json`
- `graphify-out/cache/ast/v0.8.40/700d0d01dbe87bdb78afe59f16682d4dc4d4263856d69823255c631c27f6f4bf.json`
- `graphify-out/cache/ast/v0.8.40/70171f7ab462cbb522f26012cadc50df334a286888a6437e31d705dc0b3a5ed3.json`
- `graphify-out/cache/ast/v0.8.40/7067b804a4924c7cb056ebadd22be263ade5a52251b3a22a6afc35f20e974c5b.json`
- `graphify-out/cache/ast/v0.8.40/713ddaf3424289568b7881b4b5913a2bd8311742c54c184cf32839a0460e2735.json`
- `graphify-out/cache/ast/v0.8.40/7171eeb4388e998203a7d0437a20e7a142f7be3a50ddcb2b9d01ddb9bbbf9e40.json`
- `graphify-out/cache/ast/v0.8.40/721ab87f0c31e2b03550582e46510616f7c8d06b78645aa63f56e3252258127d.json`
- `graphify-out/cache/ast/v0.8.40/725dfc9a1a8d8dabbdbf2328d79e5193c9f001503e3662dac5f4c4c9b837c339.json`
- `graphify-out/cache/ast/v0.8.40/728f42a700ee75c892a0313015d4d31c5ccfeb81ee6707e42e2447ff60840d95.json`
- `graphify-out/cache/ast/v0.8.40/7456ef20018b6485862d5a2e9733aaa6812014fe9e6469baa5d9bbae258d3ab5.json`
- `graphify-out/cache/ast/v0.8.40/74c4d0513b9f07287222b437e00a2358a0cfdcf8e5e622f41c25f79307e5f77b.json`
- `graphify-out/cache/ast/v0.8.40/74e11ce26246d7b91a711aac8e4ed675c801a9e60df2892a5005fe00639fada6.json`
- `graphify-out/cache/ast/v0.8.40/74fd354c75f8783d34ff7c9b362d380cf1a763e769e767ba7a1ee6be7f6420a3.json`
- `graphify-out/cache/ast/v0.8.40/761bcbb13430bba962a1a3a769f81c14d92fad4375235e688ed8e8ca1ca1f5b7.json`
- `graphify-out/cache/ast/v0.8.40/783092bb53a3c971d812b277641c4b926fa275542f6df573f7eaf5ee21cd422f.json`
- `graphify-out/cache/ast/v0.8.40/78b7d7f6a32f67c6f3cf1392f8587c39acfe7caa7232e963e22c6c0c3bb63946.json`
- `graphify-out/cache/ast/v0.8.40/78d74069e6b989629ffa48b32be5d7a6ff9c43e4443df5bac6069eafb4c737a6.json`
- `graphify-out/cache/ast/v0.8.40/7b2b6cb67aa453c7c1149cb39b40a6cb2eac56b12e0b554795917ac93becf219.json`
- `graphify-out/cache/ast/v0.8.40/7b5390793a5de792317f05a7c36369d1bda7c49b6ba6010dd7a6c39b74e9f30d.json`
- `graphify-out/cache/ast/v0.8.40/7bb966a48d6b4f5e13c137cff46842ed847fee5229d66d5a0bc6b44d9a290de5.json`
- `graphify-out/cache/ast/v0.8.40/7bd9229eea9b3a612803823861ee70344a508c131aa6d940a8bcea92229e0bd7.json`
- `graphify-out/cache/ast/v0.8.40/7c068febe738b11a000339a08dd24a38ea37295d59ca9b174d3d6d882554089c.json`
- `graphify-out/cache/ast/v0.8.40/7c287af6d5b09f1616e75b01736f48c23146385ed0f466c25b13202f69a6fac7.json`
- `graphify-out/cache/ast/v0.8.40/7c91d1db9118c7c17a2728da02aec6f1f427eff6afa4a897f87ece5ff741e8f8.json`
- `graphify-out/cache/ast/v0.8.40/7ce3e95ff5b9307acf004958cab2beb741eb3d66a90fa142cb2414c9764c802b.json`
- `graphify-out/cache/ast/v0.8.40/7d5e20a1e7c5e51f6800784dc7d17474ee3cb9b0dd97ccf2ad532cdc650ec50d.json`
- `graphify-out/cache/ast/v0.8.40/7d815a84be66b9556cfbd23bf944503abc34fc0fe1696f51f3ada654ecf1e472.json`
- `graphify-out/cache/ast/v0.8.40/7de397ac00c7676e9375d634ad4d2388bd406d23a9033eec255187fbd6157973.json`
- `graphify-out/cache/ast/v0.8.40/7ec2866501f550955a390f23e620f53a2f6363dc90e87899207c6a469b067d73.json`
- `graphify-out/cache/ast/v0.8.40/7eeb02424019408772e979ac682aa203110281b7e66cad0afc36870ada15e123.json`
- `graphify-out/cache/ast/v0.8.40/7f0f4af23e915ef30d436df36d5d4f0f33f19c55e6ab0fdd06de7ee2dc39d4b7.json`
- `graphify-out/cache/ast/v0.8.40/7f55d8fe4d4b1138776b7ae0b23bd83f7452031af7690617bd8104a2a5013a31.json`
- `graphify-out/cache/ast/v0.8.40/7f6de8126112c86ba22fa5aa1667ecdf71f70e219c3b537d1abf696430200501.json`
- `graphify-out/cache/ast/v0.8.40/7fecc7dc10c5f28818a94b668daa7cf44e7702397feb928e261fdfaf05731860.json`
- `graphify-out/cache/ast/v0.8.40/7ff7355b78862b41fa154c1862e599e24ac347aa5568409875ae407887f59848.json`
- `graphify-out/cache/ast/v0.8.40/80bb6cedc55e8ce61e2090c4c776d20bdef0c69288f777c2baa08c5baa703881.json`
- `graphify-out/cache/ast/v0.8.40/80ceb8e87a319ab4f2427a3325eb71e30e9dcb92d646810ba8f16f4fb01c87bc.json`
- `graphify-out/cache/ast/v0.8.40/8100461f06a556c09b8191ecac91f291d89e743b8d4709cad72536bc1f6f2d5c.json`
- `graphify-out/cache/ast/v0.8.40/81985ad2352ec0cc8016c9fe09dd58d9b8bace0b0f39de68afaf2fc64f1969e3.json`
- `graphify-out/cache/ast/v0.8.40/8253ed4be06f5721f91daca7779670290837e33fcf897c62b13f73403dd50b5c.json`
- `graphify-out/cache/ast/v0.8.40/828aa0460c08f664d1da01cdfee341c5aeeeca00aa66f4fbe141063f6ac2ff1d.json`
- `graphify-out/cache/ast/v0.8.40/82bdf281afd245a823ba23350aa974d22b1c0c417466ada5ee62c6a22f9357a3.json`
- `graphify-out/cache/ast/v0.8.40/82ea956977e3104e1531969dba91a84a8a8b52bf936a4ccd6cbc6a987f73e889.json`
- `graphify-out/cache/ast/v0.8.40/838227a8ca82277cccc3e6c9b176c1277fdec3e50172a430d986f92c88869697.json`
- `graphify-out/cache/ast/v0.8.40/83af08159734efb251f955be23c647b820e45d6c51daa00702a1ad2d70807ddb.json`
- `graphify-out/cache/ast/v0.8.40/83df64a9f97c9bb78237c933e5a593266ef7ed871334f4868535f3ba40ff4a00.json`
- `graphify-out/cache/ast/v0.8.40/84aca25899d3c63469e938421679e62936fa58b6a4fa2439746f7df950d834ef.json`
- `graphify-out/cache/ast/v0.8.40/84bb0e5b34fd10bbb187adbe39bee20df8d1abb05a7f3a28eacf23f505f53a9e.json`
- `graphify-out/cache/ast/v0.8.40/854822e92ef61c61384ce4edae90a61884ea82b790265f8e6dbefa5a11afddb4.json`
- `graphify-out/cache/ast/v0.8.40/858b764c73c33d9be29c4e50423a7c85f995255af6c87bb2e62b6f7012c67d75.json`
- `graphify-out/cache/ast/v0.8.40/865f27dee580ce211cc52f75eb869347229234b93bd32750e5b2a72c055b747b.json`
- `graphify-out/cache/ast/v0.8.40/866939d4fb8dbaf1235d6058f97089001bc2f32bfb7d46bccf710bb7e2ef4e22.json`
- `graphify-out/cache/ast/v0.8.40/86d41d73d379d9874c78bed580556ae0619cb890f4d8e79e117d46f8265a87e3.json`
- `graphify-out/cache/ast/v0.8.40/86fe02aecd7c33cc1f1ac7671bff6ef0c60f5b71483be9f3fee14966d82776f3.json`
- `graphify-out/cache/ast/v0.8.40/8801c8db8c3b3e2389cbe5c3b79ae66dd977027618f46ecae2f80a8ce2777be8.json`
- `graphify-out/cache/ast/v0.8.40/88b272b617e519f8676a8badcfbcc7ee197e7691c11aa3bb996b6d9f4bbbadf7.json`
- `graphify-out/cache/ast/v0.8.40/88d56009bd56d153ea0da616ff29f85f68925c05e5c713605a655db5f3f2a247.json`
- `graphify-out/cache/ast/v0.8.40/890880eecff40591e5c9e035fa4c415e1834045b779455edc19ef054327b5817.json`
- `graphify-out/cache/ast/v0.8.40/8a3352ed4f28ddb169ba9ede6e4876f81ff56cf56902a141217a442c359bfcc2.json`
- `graphify-out/cache/ast/v0.8.40/8a937bb06dc4b8418243ba395c67392615830b242e1e25af901d32ff9ef54e2d.json`
- `graphify-out/cache/ast/v0.8.40/8b2aa49df41c731fbf506ce904b925b0d363762902edc1f7520b97a8d0bf59f8.json`
- `graphify-out/cache/ast/v0.8.40/8c42c9b7783f85d59479b48c9d4c347bfa0613b22bdf93143a7e1ec77ecb137b.json`
- `graphify-out/cache/ast/v0.8.40/8c45ad7271c03d3cf808056adc8008a8875fa08da371aa12fad112ab861fee24.json`
- `graphify-out/cache/ast/v0.8.40/8cf89bdc2941071695703e50d5950644210e950d0edb62ec72c6dcca077f22e7.json`
- `graphify-out/cache/ast/v0.8.40/8d5bddcc13171e07f1d24136b3066c66f199497e99e73404969ee1cf8f0a3088.json`
- `graphify-out/cache/ast/v0.8.40/8e10c977bf6de8f996011a7cb4b953947c8915a12348d3afa320daa16b90d21f.json`
- `graphify-out/cache/ast/v0.8.40/8e2410f718d4679450a815cdc419bb7f26ec52846aa498df74afb785ad614d61.json`
- `graphify-out/cache/ast/v0.8.40/8e4a7cb3fc985f1fe8de5f74fe90a76b234594d0bdec97d7f9b199d31c4131e7.json`
- `graphify-out/cache/ast/v0.8.40/8fa7b643c2638ef04168e033069b092f6ae6792befbdd6f796e18c6ecbb7df66.json`
- `graphify-out/cache/ast/v0.8.40/8ff213f8e5c89773f4e97c6b8453d5c6df595ced054c913d278f8ee9dacaf9cb.json`
- `graphify-out/cache/ast/v0.8.40/901fbe08516e28c28f7eb17dbe0b52d39f5272d3a46feb904c9f01b1c8903fc2.json`
- `graphify-out/cache/ast/v0.8.40/902678f683a5b3ada78d72a2d7ad866d205715f4467bbf08366a69f9acec174c.json`
- `graphify-out/cache/ast/v0.8.40/90fd22f6d1786f3e883c5d1bb01e7054409aea0ef48a304d664d80fa023ae6c5.json`
- `graphify-out/cache/ast/v0.8.40/9118c54e8b5916fbdc3d37c5bdf8f9beefb073bce0ceae416e86e42569f05a77.json`
- `graphify-out/cache/ast/v0.8.40/915c1563edc199e7f694fefccd9e3f52e7eaa4068eb18ad9e2df329d891ff3d2.json`
- `graphify-out/cache/ast/v0.8.40/91d7e3d94c2445c41f2b9e5520d204940348d81eeac55737efc2115572d60b94.json`
- `graphify-out/cache/ast/v0.8.40/92fca0bb90682094bf443a98056ca61394d8f78cef2e85a4876a32834df170ac.json`
- `graphify-out/cache/ast/v0.8.40/9326f7ad753f5b9d7918b026159fba514cf126182c517b941620d90059aa8257.json`
- `graphify-out/cache/ast/v0.8.40/939166eb6edf9009e793e7acac1d26104a32a9df6725ff6a1d6cf16802a80c3e.json`
- `graphify-out/cache/ast/v0.8.40/93e869d18306c9899277932f2c90cfe4269c8abb4315cbd1ea3fd6226fc7e959.json`
- `graphify-out/cache/ast/v0.8.40/94059a406a42801b5bb09e03d6181d29b5552e72eda93085a2a32a8ec5b4f505.json`
- `graphify-out/cache/ast/v0.8.40/9534a9fa71711a951aa7af91925238b0d1c393b5358d8465c080404a4d825acd.json`
- `graphify-out/cache/ast/v0.8.40/9609c5e6682b28fee35b78c86e4bc8777b609347d4842dd27c93b31a32042f40.json`
- `graphify-out/cache/ast/v0.8.40/960ca662d483154844fbef49de3e24a07e445ccfa3b6b65fbca48c690ec50ee7.json`
- `graphify-out/cache/ast/v0.8.40/962723011fbc58bccd6a594b5855a131e45a221891b31aa25e7ffa1fa0adeedb.json`
- `graphify-out/cache/ast/v0.8.40/96a3a9a89f2d0e9c249d2d3afe303400fb3c49a9703721e2f90d35209b05d9f9.json`
- `graphify-out/cache/ast/v0.8.40/9733ef7d123548ea611955648103f03cd2c30888315b24548c4d5f147c5eb60b.json`
- `graphify-out/cache/ast/v0.8.40/974a1229d4750bdc55a88b57670c30d0976d522ad9489bc23a43a65ec4946815.json`
- `graphify-out/cache/ast/v0.8.40/980d35d108b0387491bfdda761c160512bb4c877490e1ce0750dd67b7d45b688.json`
- `graphify-out/cache/ast/v0.8.40/986f91cefdc5cd1d14b50f1d7571cea934320fda62f0a76d1f4989387d79a20b.json`
- `graphify-out/cache/ast/v0.8.40/9a84d242a3c62b02c4a37753b07a01a61843f37a64b03dd95efc62f203940c42.json`
- `graphify-out/cache/ast/v0.8.40/9afff3e91efbcaf73878decacb80341481afbefa23df9f1108bb0a39e5a1e79a.json`
- `graphify-out/cache/ast/v0.8.40/9b373cb5dddf586e2eb52aad86f4e530cba184ad2ea56976545c117f3dfb4d90.json`
- `graphify-out/cache/ast/v0.8.40/9b3db23d998094c989477f046af62fd725d4abd3efc859880d060e7086012390.json`
- `graphify-out/cache/ast/v0.8.40/9b9b38b837a75d0c509589480466b04c5f88a9158a44114dd506a7e0b5c6d5a9.json`
- `graphify-out/cache/ast/v0.8.40/9bb0a665d2594d7ee2b643c3178991e9afdc4d3f3b2f408ae8551ff6b20a301c.json`
- `graphify-out/cache/ast/v0.8.40/9c1434081751663c3d090cfac25b457f6cd34221228b9294faed8189fce05bec.json`
- `graphify-out/cache/ast/v0.8.40/9c1730e2ad54ff5089fc3db9272f1dad5a075a79a55b8a498d8b6e46988a4d81.json`
- `graphify-out/cache/ast/v0.8.40/9c6ceb1c189e63271a665e544226ed06c5e9ba2813b9cda15874b9178747dd71.json`
- `graphify-out/cache/ast/v0.8.40/9c8ea2c3c9626342420411b5d39f105bf977f2f3958522d78e380bc2d157edbe.json`
- `graphify-out/cache/ast/v0.8.40/9d117ba437092c9b19c8bc8fcfaf236ca6bbdf6764ed010eac4bdd83966edd29.json`
- `graphify-out/cache/ast/v0.8.40/9d38d963b4f1c7b0310532959a7f918a588e54485f5fefd176ec8e5c7ec2e8f9.json`
- `graphify-out/cache/ast/v0.8.40/9da8f2c7d1ea3b71950f4b5f55fd48b7bd42bed7f2f2462b6083b1516d14e9cb.json`
- `graphify-out/cache/ast/v0.8.40/9e04f333d01323b8a724b1d5f4de154dfc1527a904dda319ed9420e638e77c33.json`
- `graphify-out/cache/ast/v0.8.40/9eff819cfda1fbc93fff5ea1378b27d60a2abfc3435420d5babc5b1001b32741.json`
- `graphify-out/cache/ast/v0.8.40/9f246f5ef53d0553a85510650e85d2680d32a6a7e83aa30826a8baa38d7c125b.json`
- `graphify-out/cache/ast/v0.8.40/9fc6a1573c569cf27a8716cef8304d2a19e312e5c8c1bfca86760195e196e386.json`
- `graphify-out/cache/ast/v0.8.40/a0a66c23131b40f99fddb800eabbc516493e65a134e57403ab309ed87ed52ca2.json`
- `graphify-out/cache/ast/v0.8.40/a20e3dadb889bef2be66ac1ff84e2716d7e0564e37e8064c3a163c78175fa0b7.json`
- `graphify-out/cache/ast/v0.8.40/a2f44f5e5d1815811cf7e55a8d8cbbd548ececaddc76354aa8d7f4faf9593582.json`
- `graphify-out/cache/ast/v0.8.40/a2ff557ce12f47eeff6f33141e0b5ad259574fb3f0c3a889899387454af55dd1.json`
- `graphify-out/cache/ast/v0.8.40/a323288fc16d0c7974c4e585f1c770bc2c2df2cff609455bef0a61592e01455c.json`
- `graphify-out/cache/ast/v0.8.40/a36eb62c91c5d25bebe5bf378b05dc60d77aead4e7ce39bc1f3affda63090568.json`
- `graphify-out/cache/ast/v0.8.40/a4b8fc1dfc21cd635ca7c8d15b7df15ccd45999036b28c885fd10c464d8a53dc.json`
- `graphify-out/cache/ast/v0.8.40/a5bcbf7ca2370a8ff920505b89a095abc826ce11d65decdb397de6b40107a9c3.json`
- `graphify-out/cache/ast/v0.8.40/a5d263cb5cb647ff647dc99f85895edb2502ff2a56ed7ee41f38b0e4f0805ce8.json`
- `graphify-out/cache/ast/v0.8.40/a69badc0700f001419114693d5ab6538b058eff7e5b9d33465f13344ba36b9f1.json`
- `graphify-out/cache/ast/v0.8.40/a867197f0d758fb96bc1d434383402237266a4278316f304140397d71522ed27.json`
- `graphify-out/cache/ast/v0.8.40/a896d8ebf0748314b5d8708c66071b6f7ce9f03e5334a3e73e1066d218280810.json`
- `graphify-out/cache/ast/v0.8.40/a8aae1ec4c40064722c517f665b3139ff77d6026bc691603f69c3b77db7bf17e.json`
- `graphify-out/cache/ast/v0.8.40/a9bbf5e8e53b7fe60420862951463d0ba2c4f4e8fac0b93d299a0ef5025ccf23.json`
- `graphify-out/cache/ast/v0.8.40/aa344360b50938da6c5c256e8e97b328a5dd4bbe6031c7f433003ac9da0d9ef9.json`
- `graphify-out/cache/ast/v0.8.40/aa3f6e8eb2ce0a093d5d19902d73e03ab069b217bb9c33d4c6a8847280eaa28e.json`
- `graphify-out/cache/ast/v0.8.40/aa6d1501022005b5d01496c938d1b9a7e7f3f174e3cc3d55afc7a1d6fbfafd60.json`
- `graphify-out/cache/ast/v0.8.40/abc9a650a34f4afc0a3d120203db54a2986dc16e4c8109ae0d998f519a93aba8.json`
- `graphify-out/cache/ast/v0.8.40/acee1aba87b19fe5ff6e3c1551f5a5b5dc737e08eb525cacc363b48befc73c97.json`
- `graphify-out/cache/ast/v0.8.40/ad72290c591152ae4938d0131d1eb026cbfb0c023ac95d9ca96633a98a5e3562.json`
- `graphify-out/cache/ast/v0.8.40/ade1441d5e86a84f798b4aeb64326a0d6e44c48d1c865bda219167780fd9df40.json`
- `graphify-out/cache/ast/v0.8.40/adebb8d9b253763c96e9621203d6434ff77b4dc0f196d4beb5432bea445056d4.json`
- `graphify-out/cache/ast/v0.8.40/ae7e17b93e7fb9a8f25c8acafea8c60b36561efbc0d25c7e2e613c218030c18c.json`
- `graphify-out/cache/ast/v0.8.40/aec6f917a34e46b886af6a20f99ef34f10b8d2e1595e4b3c1a811818b96dbc47.json`
- `graphify-out/cache/ast/v0.8.40/af0c8756f132e96df19be7a8e5d3a6e40b35246f9cbb8d4d23b40923ca8502c5.json`
- `graphify-out/cache/ast/v0.8.40/af30fd7c6ac440c708ecda709af42948500762edf635e7a7343cf3be1bba920f.json`
- `graphify-out/cache/ast/v0.8.40/b02f1a7ae4671bef28a87c1b5cd0ff9ef41add5988e0cb1f0c6d839793143be7.json`
- `graphify-out/cache/ast/v0.8.40/b1184ee09d05ae1fda7001f13c4c1ad7a04232b47fe43dd886a27f71a92024ef.json`
- `graphify-out/cache/ast/v0.8.40/b20757469e67a38fe075d0a563fa14010cf6d1cb3ca579dff65d3704f516ecd9.json`
- `graphify-out/cache/ast/v0.8.40/b27cc28001fa7a2cf53888b8ed1d44cc3d41674598cb511f3c9f0bd259d9862e.json`
- `graphify-out/cache/ast/v0.8.40/b2aac6188cbf0e00cbcc65f44b54c1eafb42af03fa075ddd650ba4893fd913e2.json`
- `graphify-out/cache/ast/v0.8.40/b37928983c90c5b20104e311b3473e2931380226552e3db60ddb242c8b6ae7e8.json`
- `graphify-out/cache/ast/v0.8.40/b3a8e56504dabb34af551b5176ac4aaefed79800b146ef5796225b2c27ed9a5f.json`
- `graphify-out/cache/ast/v0.8.40/b5814b0de50d1b6c8b8fe5b8c68a34fe07ac013324cb1ea906b44500da08ab46.json`
- `graphify-out/cache/ast/v0.8.40/b59fae38a5549b1318025db70d619e05f02022a3dd88304a82a7906bcfd9241e.json`
- `graphify-out/cache/ast/v0.8.40/b5dbeb1eaddddb8bb4a2f5c5e2dcf8687fa67c36d886a6199cfc5c20580e16a1.json`
- `graphify-out/cache/ast/v0.8.40/b610f655c8591a4f21d69386c320dac418aff625a8ed540958c43dae867f62f5.json`
- `graphify-out/cache/ast/v0.8.40/b6c6bdb556c51ab18473acc28ad41a8bd2bbd3f70554343c68ce3d5d71b6433c.json`
- `graphify-out/cache/ast/v0.8.40/b702f0f21c733e8135e97288d20d5dbe05fc8bb78cb8e3327bbbfc4c275638f4.json`
- `graphify-out/cache/ast/v0.8.40/b77688e7c8fcd900c4d7241d43e5ebd36cb830bfe1fe9161c68b4445061f413f.json`
- `graphify-out/cache/ast/v0.8.40/b7c264ccf2e3aca72ea55eaaccc46a94034dafb6fc263ddd4d9d0116416afec1.json`
- `graphify-out/cache/ast/v0.8.40/b7d1639107744bede84aecacb819030ffa4cd16ad9261ef71f75f16de90a7c3f.json`
- `graphify-out/cache/ast/v0.8.40/b8683f0d8fefd5f7087a137cda3c5c0d4c625c42ca32612a2029a007bbadadc9.json`
- `graphify-out/cache/ast/v0.8.40/b89c438e3b8503843d9c3ddc39ba3e890cb36a86f3bee380642686d654249803.json`
- `graphify-out/cache/ast/v0.8.40/b8a48b869bfe9448cd348b0917a046c15e51cf6f6836412d3ee7684f65bea1b5.json`
- `graphify-out/cache/ast/v0.8.40/b98e104df4aaa0e780dba1cebf191e5c3530035066789d148d4a7f3c478bb560.json`
- `graphify-out/cache/ast/v0.8.40/ba1cd35f6145436a9136a7a46597ec01100acbec2ad5982070dde42c5b7def56.json`
- `graphify-out/cache/ast/v0.8.40/ba368b2e95c6c0176aa5cf84c90f90f51ecc5bc8e3b2ce96891ec7e301f68af1.json`
- `graphify-out/cache/ast/v0.8.40/ba8b200a97bb546745a825dcff2953f8cac4c7df59850fdab0a9dc63ea8242fc.json`
- `graphify-out/cache/ast/v0.8.40/bb20eb44972e550097c58cfa2e1c972f01eb1ede5149517fa089f72f7d3810e9.json`
- `graphify-out/cache/ast/v0.8.40/bb7e9d74ef9ed3ee974203e6cf3939689c57d4858322576606c4ae645af2091d.json`
- `graphify-out/cache/ast/v0.8.40/bbdaa09f0558b58da61a5a0c89bc62cbef5600345f93bdf8dc60354657ba8164.json`
- `graphify-out/cache/ast/v0.8.40/bbf796ef71735752fc8bb95f9056dfe67e07d64b7ad0297ad44cff14298fb716.json`
- `graphify-out/cache/ast/v0.8.40/bc82063953aa4e71ce0d77e899624324cfb5b00344ac6e043985ec2cca5797c0.json`
- `graphify-out/cache/ast/v0.8.40/bcdc598a8b596e96378eafe508b01d669816f94456a8cc54eab8d109c5755018.json`
- `graphify-out/cache/ast/v0.8.40/bcf4dc109851a489f910a0564fbb737f1027251b5d4774a4f602e8fa53cb6940.json`
- `graphify-out/cache/ast/v0.8.40/bcf5ec32f1eea4be52727ccd971eacc3fa617aca64a9774660f7a731540b0276.json`
- `graphify-out/cache/ast/v0.8.40/bd7bbad790b126c27c79620da8469e5be67c2968eec11cc4ff315621a0abb39b.json`
- `graphify-out/cache/ast/v0.8.40/bdc30bf96c7283922ee2371972c6a4a2e1ae5097acb8427fd14b3172e764b867.json`
- `graphify-out/cache/ast/v0.8.40/bdd7fb4b4bfdb593bcf2f8041a2afb8e6a06ceea927c47493f7d30126462ad88.json`
- `graphify-out/cache/ast/v0.8.40/beb198fb886fddab3454b11d0011361f39fe35dd785555ee74eb5462042fa5f0.json`
- `graphify-out/cache/ast/v0.8.40/bf2c99ab8a1e208f252deeddfea03bccb251812840a2136d8e4e85ca2054d395.json`
- `graphify-out/cache/ast/v0.8.40/bf70526d736b24a42ab735840af9d4c460637a0ee09a07239220be6249f4970e.json`
- `graphify-out/cache/ast/v0.8.40/c061ad6b15c23d5f23dde6e2ec2d79c0b7e5c6f1bfd9816d88a831636650ade4.json`
- `graphify-out/cache/ast/v0.8.40/c1ec17151f9d55e83b4218735e978b16c08e1303e597fe8655b3dd41fa21f19b.json`
- `graphify-out/cache/ast/v0.8.40/c20460c2fb36ac72bcf956653a07b0f5427e0713e06cf511b1edeac5080ffdd2.json`
- `graphify-out/cache/ast/v0.8.40/c240302728f59543b936e19f57625a55ec1de9da3e78357716f426aeffc8acad.json`
- `graphify-out/cache/ast/v0.8.40/c280073cc665e658e65eb64a3612d05baabe44e5df3cc356d2900dd73b43dca8.json`
- `graphify-out/cache/ast/v0.8.40/c37bc210f83480424e38f8e6b71718208b359de93e061b5ceceabc58a582d766.json`
- `graphify-out/cache/ast/v0.8.40/c41bd00c4e69522fd64b47820198dc18d2ce2f69e0fec2a64f6b794ffdd1001b.json`
- `graphify-out/cache/ast/v0.8.40/c43dc39f94ad83e7dee61ca1fbf7f13e0500774e47c50c0c06c1cbcfb54d94fe.json`
- `graphify-out/cache/ast/v0.8.40/c51707345a41cc6e5986289808d249149a092563ac84b847cbc890c577d4ccb3.json`
- `graphify-out/cache/ast/v0.8.40/c53ea4f87a83798d510efda173618abadc985856ceee691cc8169abfc9887bee.json`
- `graphify-out/cache/ast/v0.8.40/c5f90da197a3a27e141b17280332c274d9e9e14f7d70a469afa4edaad28f9c4a.json`
- `graphify-out/cache/ast/v0.8.40/c67270b0d2cda268c2c274791947ac4c46b5f50eed591d9df8dbb664a06fd09a.json`
- `graphify-out/cache/ast/v0.8.40/c68f65916515fdffe51b377ad2343de003e167b6b91437cf5c389b542eb4cabd.json`
- `graphify-out/cache/ast/v0.8.40/c6da80277024241008d94d092fc1d0eb1a069b8cdce4e256dd3b985173ac6a83.json`
- `graphify-out/cache/ast/v0.8.40/c7b86f3d7879265e497bcc1a42198ad48dd0b7c8fceeee833fabdaa265c0c357.json`
- `graphify-out/cache/ast/v0.8.40/c7cb90c22353e86f7a8b7c124d31aabb931e2bde70f0816c94e44f1a4ed8c723.json`
- `graphify-out/cache/ast/v0.8.40/c8a6094e92db3d44abeba9b28c3d43d9c483ae95c91ffeaaf6e96d510d2d1935.json`
- `graphify-out/cache/ast/v0.8.40/c996d5ad73098cf46e1821d60ffc3816ff956846653d15cd81bfb1dbf088e4e5.json`
- `graphify-out/cache/ast/v0.8.40/c9d3df59572ea3bce01b379738f73d54400788e0a62bcf287b95796e6b92e4d3.json`
- `graphify-out/cache/ast/v0.8.40/c9df13fbd534a5b2fd47e084d22aba60c2d19f459cb3cb7036e0b0307854af55.json`
- `graphify-out/cache/ast/v0.8.40/cadcf5caf2eab2c2cbff7cddedd6016415dbb2b34b87b27bf8de7945b1213c58.json`
- `graphify-out/cache/ast/v0.8.40/cb4183aea6598441c31a72b2b0ec3dd7db45d2f27f86493caaf6ebea681d0048.json`
- `graphify-out/cache/ast/v0.8.40/cbc2c234c1140616ed481d1839555b721f5b1cb9ad85ffcd7f9980ee20682683.json`
- `graphify-out/cache/ast/v0.8.40/cc2d3d42c84c643d40f0e8dcf3a3ed599978e639caaa76be41db300ee208764f.json`
- `graphify-out/cache/ast/v0.8.40/cd1f25876f4b8306ba814a170a43fb0f7bf4d8d1a46cffd86f2b92b0d4a490af.json`
- `graphify-out/cache/ast/v0.8.40/cd6155bfbd90c034743cbf3dd87c4d6f20d23ad11da06cd74393401e12165664.json`
- `graphify-out/cache/ast/v0.8.40/cf57d7bed68ce2b987f037a62ec22a7cd30eb90321b0d4b7ce65ed0bf70776a2.json`
- `graphify-out/cache/ast/v0.8.40/cfb6a254246b3ad5f7908149fae8516362f4fb144f48b96a95993c960efab391.json`
- `graphify-out/cache/ast/v0.8.40/cfd068a46f99a70630cb86bb3d744c6c1be63471efe992c95e056a0490bacac1.json`
- `graphify-out/cache/ast/v0.8.40/d052d12ab0d04d841965d6783c8f305b4cf2c794abdbd8a75baf8d8b2e026351.json`
- `graphify-out/cache/ast/v0.8.40/d10c42825318cfb78cb6dec9442b7239abf026a516b2b47e46668b93ae7fb1ca.json`
- `graphify-out/cache/ast/v0.8.40/d1c9a49a69f889483b4fd49da7f50331ec2c7188ae0d793fc1e9da40d3c3bfb6.json`
- `graphify-out/cache/ast/v0.8.40/d25d813c1693653bc2b86e5997b5ddd8aeca95f8a00df1de75d317fec71b03ea.json`
- `graphify-out/cache/ast/v0.8.40/d268d60861ed1ab75ff36cd9dfc5c9354d9df2fdee488d69019a8ad117b4f30e.json`
- `graphify-out/cache/ast/v0.8.40/d2b8d437116174eaf40f6bc2b598821083f7e089beb6c8d1f67c354ce566f387.json`
- `graphify-out/cache/ast/v0.8.40/d30ae6810f40e703f3e7d64db90d26a53d6ed1d5b1df59f9f1bf0967d2c96121.json`
- `graphify-out/cache/ast/v0.8.40/d3be5521e91b785ef948a6f20f8932a9bfa00d4144bd96faf38fa207ed7f4565.json`
- `graphify-out/cache/ast/v0.8.40/d3c6ec13edf1ba0f2e7fd1f377f43edf3d3255ca812c1a14ee42ca08f0d96658.json`
- `graphify-out/cache/ast/v0.8.40/d44f9e77ea3793466eaae4f60af8d14617e9911fcf97a833ca44243aa4b79b20.json`
- `graphify-out/cache/ast/v0.8.40/d463616aa95f54d9e567335d66991369184ce4554d85ad0384717586eba05a88.json`
- `graphify-out/cache/ast/v0.8.40/d620b0b334ad453a19d9254969ea4979fa8681457e06bf9b82b6779cfb4c09a3.json`
- `graphify-out/cache/ast/v0.8.40/d65f8f5e9067fb6ec58e511c3046cf434a9b717c00dd66bd574d2cbe4dcb0a34.json`
- `graphify-out/cache/ast/v0.8.40/d676b178ec833ce67210c5816835818bc1c42d29b56c1114c543c6d38803a5eb.json`
- `graphify-out/cache/ast/v0.8.40/d6d8407bf4988a2c6a2c7a271a71817843268b7fd41fd0a784239d5c765e6450.json`
- `graphify-out/cache/ast/v0.8.40/d6f0aa7f93b905bd177292825cf0ff94385cac78e5c7f354f7006991d2cee4c9.json`
- `graphify-out/cache/ast/v0.8.40/d7527c064e91765608f626a9beb86345f054fb17f86c85d5115b5aa585e015dd.json`
- `graphify-out/cache/ast/v0.8.40/d7bf6ac3699e247a4bebe54746af26cf91aef9dd9242c03c62918661a20823a7.json`
- `graphify-out/cache/ast/v0.8.40/d7c0ad4667cbf17c293c9d5552b746e19951dc0cda02e2a69137e055c923023a.json`
- `graphify-out/cache/ast/v0.8.40/d7de7179c3501bd7d01b4408b42c856ce4a458fc420c9e164828f2383f8863e2.json`
- `graphify-out/cache/ast/v0.8.40/da26626e30a0d9e183a099508917761b6f912f4310e9956bca08d6dd97d5b01d.json`
- `graphify-out/cache/ast/v0.8.40/da319ee3b6d8dbf93b947529220ed61b89a5a26926f5e9fd3de2905ccf28830d.json`
- `graphify-out/cache/ast/v0.8.40/db716889c16fd66e6d792866a2ae39b848b6291206950abeb477f5e3d3f9ae71.json`
- `graphify-out/cache/ast/v0.8.40/dc20f65d8b222834a2536eae9d721e5dba173a1c63583f7229e8df45c8359c98.json`
- `graphify-out/cache/ast/v0.8.40/dcccb639e03c18ba98f2aa58cd45d6f0f3a75da56d901991cb9937e3e03e024d.json`
- `graphify-out/cache/ast/v0.8.40/de5aca1ea972d79f7de45e1eab72d3b687de43ecc1aa2e8b2365e8f0b9c515ca.json`
- `graphify-out/cache/ast/v0.8.40/de699355e9d1c7fc295b745b56f6c6f8eb1c22359eff6266cc24744d1238aa1b.json`
- `graphify-out/cache/ast/v0.8.40/df02df12dffb14cc4f5e66b3c88f6a00458ad0e94f868bb3d64fef4eb035b6e7.json`
- `graphify-out/cache/ast/v0.8.40/df1fa55e9caf582628430f49a3a69042521979dca7495204db4d5b24a8a59637.json`
- `graphify-out/cache/ast/v0.8.40/e0214bae78407c2f342b83a600dc13d157d7a58a001592071fd3998b6037a549.json`
- `graphify-out/cache/ast/v0.8.40/e0462a95cd6e186aaaebf018d038102201a46e87ceca08af4bd1f567871feb46.json`
- `graphify-out/cache/ast/v0.8.40/e1b7b50541bb4f614952794d5c7eb896747418a14160f00eeaf7dcd4b1490d8d.json`
- `graphify-out/cache/ast/v0.8.40/e2766d6ab1195649a543f3a85258e3c3c71f9bc5f1c310fa2205b18cc8b8db47.json`
- `graphify-out/cache/ast/v0.8.40/e3101dff830fd444d3877496504364b2c52fb10cf8eae04456db1e98d4f95b3e.json`
- `graphify-out/cache/ast/v0.8.40/e31305c4622ef9b08a125289c0e2faeb17752d3066fc98d77e29d95579beabaa.json`
- `graphify-out/cache/ast/v0.8.40/e3229faf942164a4fc484a6a0ab587ff7d648b92c8242c579eb2c538def0a2c2.json`
- `graphify-out/cache/ast/v0.8.40/e3a6e9504b5e16d7e63ead2e63db1178a93d15f50a1afc226da121aa6cdc51c7.json`
- `graphify-out/cache/ast/v0.8.40/e45e7047d752b07956e53f270f3b311596125da0a57b1c4a5b9f8ac2fdfc8d05.json`
- `graphify-out/cache/ast/v0.8.40/e4bd3eaf5678770ba011eb1370ffe119a3e347ad442039cc0c1587d6aff79e36.json`
- `graphify-out/cache/ast/v0.8.40/e507eaa266aa9b73d2f220b7935b8d5caf2c73e5d6007c2c6745fd10d70785fd.json`
- `graphify-out/cache/ast/v0.8.40/e5198d8dbba7694d7032018f446e93f0f3d0fc182ea7c1cdc4fcaa7a84e01559.json`
- `graphify-out/cache/ast/v0.8.40/e569299249edab5bc2f2cd0902a7ddaa05164b8319194304dcd0f6b3f56294eb.json`
- `graphify-out/cache/ast/v0.8.40/e59a5dacab160fc12f601418d3c8b64724d20c7005667e1037bef3714621e24c.json`
- `graphify-out/cache/ast/v0.8.40/e5c84ba2466c2244d0b8e163576992666ff04ff72bbbd98460491f25b3124e6a.json`
- `graphify-out/cache/ast/v0.8.40/e60acc8f4f116e079dc7ab0c638eeaade995d3eed35889e24636bdb3796d74d5.json`
- `graphify-out/cache/ast/v0.8.40/e6cfa46d90926d7dae6eac173b3b685bfc19d257f0882c3f3901e34536e622a6.json`
- `graphify-out/cache/ast/v0.8.40/e6e2e99bfd2ea8859a3a2da39c7ac327c29e1ea49703fb416f50d58d94cfe2ba.json`
- `graphify-out/cache/ast/v0.8.40/e6fc8fddee6d2de40ad354dad768328c343c58eb11acc3ec05708d51fe41b745.json`
- `graphify-out/cache/ast/v0.8.40/e6fec2a0e718f6e7040adf20dfb0a0ddc71fc33ddf1fb1cf8f68137f7d6d44cc.json`
- `graphify-out/cache/ast/v0.8.40/e775f32a21ef2449651ba5e21c0606087e51a8e432cb0c0fa9af4b46a9f911a1.json`
- `graphify-out/cache/ast/v0.8.40/e7c05391bce6c9b6a91ac01f495446bd173df1ca62268cc32ae7f2637ae09efb.json`
- `graphify-out/cache/ast/v0.8.40/e8e27278e6ae32501b930bc0a4c66d3b368242d545828333a66bff511500adc3.json`
- `graphify-out/cache/ast/v0.8.40/e9c6211497a6ed15827a94fab4adb7d1e1d1fb199d162da93f9c87ac13c109c5.json`
- `graphify-out/cache/ast/v0.8.40/ea4595642e7b0300e18f191398f1d3694417b8c5dc8dec894e4ee3508589b24a.json`
- `graphify-out/cache/ast/v0.8.40/eaab4455c10135cbaa7a156a5fe0170d216ba9a42483f54fa657b4fe4cff40cb.json`
- `graphify-out/cache/ast/v0.8.40/ebb8b9524e3cbbb576a7f61884c38dfe2758787955d0769a1f744719c4f652bb.json`
- `graphify-out/cache/ast/v0.8.40/ebc36adbac66f35b2f74c394250456852089d20a07a7bdc0570d9088af2488a2.json`
- `graphify-out/cache/ast/v0.8.40/ebf61d657bf8c93e6486842b6a88f54eb8d2c52f082610ce941de93e00aa873d.json`
- `graphify-out/cache/ast/v0.8.40/ec85cadf88089b5ee5c774160c0f07f398ba17ffd4eb2427ddd8438a504453e8.json`
- `graphify-out/cache/ast/v0.8.40/ec9e25517b085d1ad431297a65afdc857fa040e9731c6d4c3c037c29e9b13730.json`
- `graphify-out/cache/ast/v0.8.40/ed9b2c0092dbb56935c3dbbcbdc3ffba0f4555f5fd452951acf16c4ab250e017.json`
- `graphify-out/cache/ast/v0.8.40/eddc2a2d45610727f35ae6dc57f012affc3c53dcbf5892eb9109d80a409754f9.json`
- `graphify-out/cache/ast/v0.8.40/eeacf14ab44acfcdb515ec124114f8a1f0a73b4eb6713f18d331357be4edf420.json`
- `graphify-out/cache/ast/v0.8.40/eeed32c58a3470d20738c9e017de1242c0ba697ddb2fba915af1c1e99c355962.json`
- `graphify-out/cache/ast/v0.8.40/ef59bc5acce454e114768457521757a6aa9f99733ee564cb8af4dae5badf384e.json`
- `graphify-out/cache/ast/v0.8.40/efeb44df0402917ee115c0a09b2701b02918a259c045da1b86cb35c7b3c80673.json`
- `graphify-out/cache/ast/v0.8.40/f00a418160be0d525216f47f2611b1f85afa41d3601f31316574cec2f76f3002.json`
- `graphify-out/cache/ast/v0.8.40/f049a53d8225a5bf129f77b250adf1695b1d4eafd0f74beab0808965a9a8fe4c.json`
- `graphify-out/cache/ast/v0.8.40/f0e5eb57b5123125cb3fa25be5ab914cb086b7e37fafc2cd1f68096fd04a2d44.json`
- `graphify-out/cache/ast/v0.8.40/f11f2e86079c612c101c0d64e28889ca9f129c00f5d361192f5d069041e4195a.json`
- `graphify-out/cache/ast/v0.8.40/f1cdb263ad680ba824221f1d33232bf2797836706e3300763d9bab93d27ae30e.json`
- `graphify-out/cache/ast/v0.8.40/f1e1a4a04417d5c21a54edf79dc6c4ca580abb31785432569af18f88a3ccc014.json`
- `graphify-out/cache/ast/v0.8.40/f224f2da2e60e73bba9170d590b5f80bcb4e292468bfba731b24e4d8189cd601.json`
- `graphify-out/cache/ast/v0.8.40/f2d507e47142a288ea1994e645e6f18d6b8b4ca1b992b7b683cf364e7f274970.json`
- `graphify-out/cache/ast/v0.8.40/f33125f7f95bb6244582d78fc7e6b2333ae47f22e8cea19ab0915b7110e733b2.json`
- `graphify-out/cache/ast/v0.8.40/f33a2c71fdf5b4e593ecf8402f101ea119ea9f190bb64aa702c05934f5746445.json`
- `graphify-out/cache/ast/v0.8.40/f37e219577441a6517367e5cd5655cfa714b75fa2a9d60f253cba40d1cbc7ce0.json`
- `graphify-out/cache/ast/v0.8.40/f5246224bdc08f81b9cfdc3cc331afe44c9b6075b80f91989fdda5b0f87f4d22.json`
- `graphify-out/cache/ast/v0.8.40/f53a51d2ae240390d28fbaaf7520f3948f3184c8d9e2caa65afe1ae7ebbd17b6.json`
- `graphify-out/cache/ast/v0.8.40/f5f739781fe471e33de7d2a37e55b751b685bd1861c7ae4139d228eeb78d2f83.json`
- `graphify-out/cache/ast/v0.8.40/f64c056d78add3730389e1ffe9238cb80b588040c3b3d8bad097c3c79537a5c8.json`
- `graphify-out/cache/ast/v0.8.40/f6aba5a1eae500342375a1db187a72d5b6db32608dde0bc4ccb53da5af9f60ff.json`
- `graphify-out/cache/ast/v0.8.40/f7203dc02f9b3c08cbc290a705b08d76bd1e0df69e5144b45537dd3e6ecc8296.json`
- `graphify-out/cache/ast/v0.8.40/f8225a725b76e67d0874106d30c5bf643fc4bf9a3aaefb4df8647b86d5dd9ba0.json`
- `graphify-out/cache/ast/v0.8.40/f85d1a1ebcf9f6edcaea25c6e6adbf137393956172597a4bb80364f445750fe0.json`
- `graphify-out/cache/ast/v0.8.40/f866628b551ce9503a47e1a12531f3ccaa815649b00a23abc6ad400dd50a0787.json`
- `graphify-out/cache/ast/v0.8.40/f87064cb403ffaac9b4959e458410057c80ae13c62cd205cf49ae0f78e64e1d9.json`
- `graphify-out/cache/ast/v0.8.40/f88c46fd2d6c64d2f30edee7d642c8f2d058e5ef81e7a79d100f49deb0b6e4b7.json`
- `graphify-out/cache/ast/v0.8.40/f91eaaf016ed0c06c9ecf2c0fcaf86421cf47781c11297a33aec71cad091733c.json`
- `graphify-out/cache/ast/v0.8.40/f92290e4b8457b5bc6b34f5fbd9bb8a715cb9e2cb8648389361d67621e451427.json`
- `graphify-out/cache/ast/v0.8.40/fa6e4913823a1ffc6c7418eaa219a2a9eb3acba34db25646e2384919c77df376.json`
- `graphify-out/cache/ast/v0.8.40/fa886846e67411eec9b19d0b35e64cf25ba7fa7640fdf7c94a5a4c07a812427a.json`
- `graphify-out/cache/ast/v0.8.40/fae0f63f02c2cf139e1a30746dcc570edc9d66a7cc1f4d65a7c8e73813dc8e11.json`
- `graphify-out/cache/ast/v0.8.40/faf4fec511398609d4e1e5b41c281dfcbaf55628131bcd6aecdd2ac8d9f83f97.json`
- `graphify-out/cache/ast/v0.8.40/fc291347c374761ac703b5256915d93025383773f2c44a3f43b3247ceafeae31.json`
- `graphify-out/cache/ast/v0.8.40/fd08dbee550c384f229c69b7c869d8ab020af36643579277b1d6586b6540ae53.json`
- `graphify-out/cache/ast/v0.8.40/fdd8ac5deab6759aeb32bc4c1d0dce1e036d10e4d671e908dca0459ca2ae0653.json`
- `graphify-out/cache/ast/v0.8.40/fed6af863e0633174b9fca3d6f0fda80e8976387d61afcc38f592fa3eb24338a.json`
- `graphify-out/cache/ast/v0.8.40/fee5e61af367d510752f8c1bef2052df5096e11dbf2e1f8cb8dec743e27f235f.json`
- `graphify-out/cache/ast/v0.8.40/fee795e4cd90053a93ec3e4a0ad775895f4c985ddcf2616ed5a74c4100a562b3.json`
- `graphify-out/cache/ast/v0.8.40/ff55754bef5ede1783743073be4556cb7c55da781fc8f7908b5623a5beb97042.json`
- `graphify-out/cache/ast/v0.8.40/ffb1c913a102cd43c157707ce7a1e1790c04f42aa74c6bc08fc6734c32e0b22a.json`
- `graphify-out/cache/stat-index.json`
- `graphify-out/graph.html`
- `graphify-out/graph.json`
- `graphify-out/manifest.json`
- `hyperframes/graphify-out/.graphify_labels.json`
- `hyperframes/graphify-out/.graphify_root`
- `hyperframes/graphify-out/GRAPH_REPORT.md`
- `hyperframes/graphify-out/cache/ast/v0.8.40/00e4c95bbbfa705f0e56db61c37c74d9de7b0bbc2b612432fa2c5b53bae45918.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/016aa801503a738d214f7d613d5cc3fb11c8c688d9a1e7d081727a3d9757eb71.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/01779c6a2d3973bf630c5efde1c3298826dd5f31012b9eb6f131a66323141e85.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0194ef9a1d493f72bff9c0fac9322fcd321e6a791edf5ba7263cb28248455ca1.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/023fe0dc728b7685631f0c7ed4e33d6fdf16bc02d05330418c026defbeba1f14.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/02c2694f91fe9a6b7679b3fea9bf8af0938fcbb79a8abafe9e6859330902e358.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0337b3be9881e87db53a183b2de8e61899dcb8ffaaa402823c5519ed2135874c.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/035f60293b1ba05ac479b66123da306dc1e8dfc493af590a4ea23295bb6af965.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/036c3fa25d6230424cf9f3dabc78578a7088dedb39695a41c283995095a5c589.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/03aad66e55a4c7685486c0fdfa7291551e73f76fc02536751e71a43e6a76b63a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/03af62b473e02606c2c0a9705175dbc9f75b737c1458fdc53cc6bc4c694b9355.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/044573981161fc76af27dcff59cf77673b5f0cb4e957ff1967d20ae516f14b28.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0461a85c6595bed09a978b29cf77ebd3f424b0460b94cd12ef4dfded158bd3dd.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0577a7e9e334de9a1f1af65fa8530349252ad09a72d81989b5727c3d677ffa99.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/05a257461cdce7cff44720080732f2e0dfcf98a4c9f8a559bb28aef0b37ef378.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/05b90e08062147f66419245ae9c30a2b25cecca04a40a642b0c830e2d75618af.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0613ee0a897af81ca6ab83c529777c1cd2502865c92898a54e30402f66a8ed1c.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0649f7db2cc84570b02687e1934da11a5135e06954da74b36053032b5b2a2e52.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/065920f688828d747db5c36c3cfe737244382a08dfa921d09197082cae5386fe.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/066b065aec95f006a63561110adfcb82af8700523a95ad95d273cf7a7197508e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/069a3e00fd9c4780270e48696025098b0969d2549fc2be750e7e42b7a009bc32.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0711175423b6e6753efbecda419e13d19595c3aa96dd6964418f53724582f3be.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/078a5fcb52336abe4fe7a9fcd8dd034334cf78401f533d6c34cefd316fc8222c.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/078d815fc2a3ce854239f628543ad626a36aefaed3c7946579d51cfc127fd3fa.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/08e46ff80dc7a158caf90ec0002565a385a8131b238302058b4f09a27e2d69bb.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/094450ccb5641983acde0c4ae7ff535f3abc72da2545bc640e22dfc17819eccc.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0971bff5623c98b6dbd8902746edd6f9d8ad66a3acb40a0623026de2769da365.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0a35ecc3a9d39bf3a46137405b15d4973506814a510df7b4e644d456b12f7b0f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0aacba1221861eaf18d226a0f2e26809252bd134d933517ddc23cc167fb4ebcf.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0b197b5c9da4f3ddbc2d7679af275ad59483b512efbb63dea5902e1da410a299.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0c2cb25f3cea11b08ba06546faf8afde1c483985a9305740c7c54634c6fad3f4.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0c7b090d4e82c80ff8e97ad1781f8838b8d28a1c6951340b69f141a5472a816f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0cd10cfb38151c6fd98444835b751363f4f347982037022c7e0005d6763eb8f5.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0d245d2006d2994c704d95b702246b468e0433201a7fb290657d7ffc92f164ec.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0d2ae54c2b0d012b677858625aae130ba252f859d82b345ab92da013759e56cb.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0d595b1492e2009a5d60ae52a61a846eca2b8c51666cb4bc78a2adfa5805c52a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0d621b9945e4f71ac0d77fba6b8c13ae2365c26cab0162526ec17bcaa1302a1b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0d79438f35133cf1e5c666cfe9f06f2c45e4626e79b39e4b85dc0275767887d2.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0e10db5c202082a14a1817b266106b638532ce9cdfbd0957e111e23c2af96e41.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0e1d3660f4099f5156fef7493fafb167916ccac4e7e6f1714678bb7aab6a30d8.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0e2f241792a4673515a01d2580836241f7269a4bc8cad49407752861df5271cb.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0e7345549356823df8be2c1b428bb965127d3ffe5e2a364c2e9110605a5a2cb3.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0f3c25bc0428ad82e3d6cc6cf7e0ff6e5affdd3f89b07e07a3ba6053b11fe33e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0f460dfcaeab897e79d79258e9b3852f0d80cd90c86cb0dad88cb9c0e04c15b3.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/0f9fdfc45d59cc332c8a937ee89415c0fbf79d8ef83b9d3cb413ea858f6a5858.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/10a353681d0c03da63a75386d5b336cac9086daf068e4b9724064c3f0af3e85d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/10dec933b9ac796935329fcd262aea83bbb7e2eb4fc1f54b3ad86a395bb5faaf.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/111251a9178d61d437641223a1b854b1d2cf252b7e2d41bd8bbde94357aeae15.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/111c1e4a14e686ce8c59dfeaa0eae37ba721b8578f216370ea27f3e64d5c4038.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/11451e4c35ebf2eebd091d1170248b1280edf0d4786a24e8e85d189ab5b2a624.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1207c1dd2c9214128a5fbaf18f8d7d8a385075bda64b9b434c0b38f6a99ba689.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/12339a8a5aef83587574363c4568ee4cea6a6ef69273a440459495f0b10e7473.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/12f536eb51bdea175ecb93e7af043d284ffb8d3e6800b2fed739dcfe95aa3936.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/12fcb3e708ca51afd07198caa2d64e7e076df6386893699e4280ccf85fc80a6e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1353c70ce3d4e76fab4ee267011f0b9fb909f3b85790c700db68e2796e74ff09.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/13673701f9aa4bfc708db51cc2878fdcfef957f180b8b4fafacd0c5aefeafd06.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/143e366ef5b73b8a1dd393d836ba1c4037656e174deea9fdd7910213882f4974.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/144844ad53576d89fbd44b63d5a1b6c99adf9568b38e7b581af2dedbad28b41e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/14a4cdff3fa1deb8b75811bc7702f46869d1468054042b88a19613aed32be974.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1522b9b5f0d2aaf705a676fe5fcf47a4c1ac3da9f73507b6d5cde7b53562d562.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/15502d1a3fa8481c353c6c9b41f18e0f521b4a45f91b5145025a7e0739127a16.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/162163e50167ff54c540f1809c65313d1be895c905175c1ffea2101b64440c84.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1635d6c4eb4d20047b903c30f0be5230c12b75f769c0871e148c24972f474308.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/16c3b67fb12145214e74b26dbc1e13fa5364bac8c06db403f5e6f0924741a224.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/16cc7b7988ffaab05273d0fd067676d700142ce4554648063e71f9258fe3a5d4.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/16cdfb07077111fe9a3972c4d4c146c27cb8d615aa44f17dbff8086fe2addb01.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1782bd936fdf1e25b59c5f5b74862eb7dab9f2242a94ce5d73baa53f764c7bed.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/17955f1e487f0939134effd77a37bb5fd6d034c209bb440883228173c617b77e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1818e822db88bc1f4c1bae136215bdb2a0f76fd668db936120697d0db4edf3c6.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1910daf329f88460279fb5ce2dd6d637c8228ed20b9040d2ae9568351442f045.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1940dbb77ce69bc09fd307b781528b0875491f6e49c317313e9e0e84f98a50f6.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/19512a3f4814325e1b515128a7b753af32c14840a4c35c260a4fbaf4c141a133.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1b0546e2524ec706beb85f7b0ab6966c4589e9519adc9c6a062cdf2c5d1b9291.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1b139d5452a9fd56578d41fb0ec5a763677ef1918810c32a58e16f96cf149333.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1b246d19c181889f005314832200e72a4ab61b758224dfc0273074c2d451c841.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1b29ef13e2dc7041faa7075faa114161b43c58559e98175d573c8356e7dc62f3.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1b56da57e266d1b273a0161d86e99201affa1c221635c87c85170e7fdfbbddaf.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1b98ba9323229d0f43cd2d5b8dc371c434f7e1af91cc895be159d2b0c4f58e08.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1ba78793680326574ff3ba37f2d9ad1351044321c7bcc4a27da2717d02876108.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1bda2a2a89a47a1cfe3e1d8ffb10c8543532486979ccbf58eb2b9fde9c544ff7.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1c069c5b7074c6289a6152d8d7529e926c5866354f7d4e9089911fc5bc19329f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1c5dc4625220b71eae5933fe6db99e1428a8678fef1384bbc0ebc1b01263900e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1c94406277263d129196ffac339d79798669f25693acb7cde41803371891e18b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1ca94830aae542995741ee5e22e6ed6a73759e17c04db5be80d5be63b146941b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1d4455c44350a322d14b64acdc2123ece9189574d04def891a4b3bff4feffe9d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1d46a6fdb5d808d918fddd5f9569bea73ee19b3e18ec84c1a06cdd7cb6f5a301.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1dad9fd9c38a9cbf7698edefec3520df9b454a07c22d3329f66d10770459a71f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1dd392f95e4e134ff9b2d56e85e3ab540a3fe0ba1da88b6bfabe581a9b02e8b5.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1e362ade4548cf2eb58473de55f04e2b70cba0f6a684111a4d92ee6093571078.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1e6016a8609822dfa6e3397d8dc579bc7ab2d0d8dca6841b3f098f89989a85be.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1ea730c075dc88392225717b57f7778977b6e5bc4a796e4a5c268019a00f6003.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1f5dc166c10679ac72cc1d9c184d8993e0bcd1926ede91376d63d5faf2376500.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1fcc38f6b65c8de6db12047fb0cf96f8e6d1c990310e7d15462890664fdebc25.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/1ff7eb5aa4d6f87634e761fbf9cdc8abb527b08a5ed41108253e375355581c23.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/2020a35d63767cec55b3f1c3fcfd033c6f8a00306aa8e771ec00ad075e6ffe1d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/2049421296dc6218d071a6f11a6dfee60f3dbb54260219de404e4b772a40c882.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/2074255d14e838a01cd477ce87a614aee33c4dff71ef87f72e8b0f97c1113655.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/20ea1bcd7961e0efb8af9c5774bf64bc508a747cf4bd780b3ba7f88cd0a08be0.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/21b5f85acec37e4af555a3eca42ee1c7e350fbd87f7b7bc341290abbea799858.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/21c8e792344b19378b70d2735182d681f0bb6ab995b928087aaee930cc9acb72.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/2345fa9f216cf7bbf1017de43c47fc798f3d818feee5c5ea7b637ee751ba250e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/236b1569868f35c8ea7daad140e6bbb6a04431a2fb068774204a059e2b9c0fcf.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/246fd077db8f6e247b817692cdf68c8518013fdbb8c91d980c698aae7c838bd1.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/248cb60b4d552b89af10e5f4e75dcb55e5e4226cde9d10ee07aefb2b20e5b3ac.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/24b08af1ad892b7f1b26e790e8aeab7031e2826daafa2de3ce8a2242b5d05045.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/24e1d531a61733ae171482b7b7b4b99381b97217bdb190da406b452c6dbbac88.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/252ab98ebf3266cab3b3a977080f90ac14022e3a0af36d8ee791937a509a7190.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/2577229bb22ed8840297c7f5ba8a3e11c4f511db856a13c8cee56bbbdd18e58e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/25d28f33322544057ec838362398d02db34002cfe328d96d585c09971788277b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/2662af7685276aa98fa03169e8068f3be02cf83ee749d4f85435629e164e65c3.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/27189fb5ce0e59d0240107717049f6bf2677c963d108d56497a60410e72d3b42.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/27f2ffd040430920866d00b2d4663f1c7ca79c72af2c09640386aba331dde318.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/289242b9d0847394bea7b8ae605373f00bdb57536f0a2637de314e13a2317137.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/291b108084a8b471452c4e4a4b9a5d627b93dd1e94b641f2b9b370a5b93970bc.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/29458591b7755b407e850bf4fb6b3a28ad19129742513bec1ca99a5b369cf218.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/29f966ccb67c3238c19451af33673c3f5532b029614a6aaa3c9e9d9d76b376db.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/2a05c8fb59c3024cee633e67c1f8672e3a3cb3431cb272c0ef46c404f621163f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/2a82446f0465d9f671e5c314aabc84f9a4420de1df6598c9a77ef819305086ca.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/2b75acc1e267a3b4060c123070862afea4fcb8b6d97e5035585935a802f3b967.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/2b8dfc2b53d38dd9aaaf37a6bf695ddc9993518b74b0f7ca8ff3d83c41fe7e11.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/2c11d16b7a4346822e09817dc59147078173476579fe7b6c9e5aa86990338cbf.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/2c5e835f00f81e2a2bb989627cf2418b8b42053348c01b72e1fc153954725f78.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/2e39103c1e3164ffb5ff3931a82775a1934b792ea3c5faa64cbdc38a64767027.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/2ee7e38b3473879435767ebde265bbdc52a717b518131200e9e4ac91a6e61276.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/2eeecbc75ead309acfd55336e14d4a4eec846a15b7fd336764ff7232f86bc420.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/2efb636de9c3866a6a36bb24291a9d165940cd8148509298f818e05206b4520b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/2fb2c0a9cfb0bf094d1e2df6612988444b73b480a44a41836fa2ceaa40e2caa4.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/2fca0a57891d4f3081119c93fc790df3c0ae7d46680241cc1accdc4093704457.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3004e9eef12751607fcb31f4b3fc819faf1fed3c3cb94646a3f9a4d787e8637d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3019de3c0fa649ba164e91c192f3c50458cf5701ede218bf664822ca0d23352c.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3133bc7580a3ba57bf08b70b62a6557a65399f1f59edb0fca9dc7aff6b27c4f4.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/317aa7fce164c01eb45984bb302a24f71a68ff83ac43ca89645dfa12e260e069.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/31be284100cb4b7663400b5181d9332621991f29af8f406e962d9b8f51e59877.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/31c77e1a18fab906188d385cb586918ddd7561286e5e105dc5a6e9f194701653.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/31e8aef0b9ec9ed064a0bccea109848786f7dfbe1a4feb536687faecfee2ec4e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3225552278314576d84e98c7306067b0a4c388f73a384b0f177a0790067b43db.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/32a8f6f5003a7ccfd108a56dfe1faa3a218c9191abc30fc96e08eda4bdb7e2e2.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/32c281fc47c5d268689c6567e71761e242a3091ad585f1d6f39fafdeb54fbf6e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/32e86f6580f63524d92d47d205adf1ac15b4c76e63275c8a9bd2c8c016a9559f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/330a2c7b8cbb8bcd26f0b227483e08dbb2adf5cc9d105b920be9906bb19a361f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/330cda8b666f6670a924d701c5e965280ac2a5c491d601cd21793469e700d440.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3335ab6ac48aee2c01e57902dea85c1e3143975c44797a5ba8d1c78f57a975b4.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/33440c3483877585c76419863efc0dd0c1a70529ffee0df0ebd156a93bbc67f2.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/335b8fc15f163277fe04fc95ee53bedbe44bdc967bbad658777dc1901005e890.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/338213c83879df4e0db758497a20c621fb85b845d075e7d8efe357d883345b4f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/34250c8712b28a1cf02c788330c2cf23a44745f43087a7aa1ed071150fe7fe2c.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3436e172436db5584e848b4514ecac2f5de36101f0fa5f3a0ed66589ccbc1ec4.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/346915acef07521d05a08cd71f1f6cb1bda81fc87d88aa4aa33b0c5771e95c31.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/34e4d813e1c42841d1d7ba36230d5fc4a056ec3446bf8e300eff36f79688edf3.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/34f29fc875c47ed094df08d228aab435f72b8c06d1033e5c36c2e998f380038e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/35cd55b9191e885ca48662d0e25c6b37b024c58713a7ca277acfa140a4af95ba.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/363e9eb96aa691de4232adf655738679eba4ee3f2d14262111cf103638881c1e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/36994ca5d002c4d71bbde5a4c4e83faeb8640906b7d7cb9f1594e004bd49733d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/36d0682ca73bed3c8924f58bac372572d01c06f9a95158d631f1fd359f3b2e69.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/37895113cd84bbaf2f89bcae455e93e2b65008679bb3da95c86a6099734f3779.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/37ed5036af2de6fed68f0bfd39091cb0121badb66f394eed835a89aa99df9d60.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/38d505042e09764631f5c8ea9ece560eba954ba0631f617568fa13f903192cab.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/392d68c9e346cade9019abfb6a27f2d86f7bee4c42c0a0308a14795d5029e5c3.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3a1d83cc6c0e26737986d197c1f8b7d17a31ab8c42f1b0af37638f43e5c29d9c.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3aab990a04125132f7d1794536bebbad5ee1f0f3cf609024d559751480a63c08.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3acab643e2ad635216c12a481578136860c1845d211aa62c3e4a13445568d5b6.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3ad2e921698f7605b877409c96539da852ce8d6b500b234c464cbeabaae99241.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3afe6a4c85bc2c00cc65621e9ad9fd46713cb79bb76d7fe89cf993d57e9bfa79.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3b6583e5466cc81723fe112322c956affe5f35669b12a1edadff8a48a74a8101.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3c629f28465bdcf582472867faa0a3bd6522575847b4c338bb31441ffe0ce023.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3cb025d1db635f5331424fa08dc1ff0a958b4310648b5b89fe815d62069b67b4.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3ceeb2e3aa64a569c4fc5d828d987f9467f8c5cb13820190667fca70989505d7.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3dc2b258af9a3a7c9743962f87fce8b74c4ad0d7263960ec6f7c36f00c93ea19.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3dd91d74b2f5d7b2ed957c99916460238def68103a9e56f74fe1f24e1b9ff3b7.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3e15189b813fb175ea99235907ae18a86f2149e116e6170e627da52b8cf8a8fc.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3e2736f3af0f2ffbfaee7e9f702485eeef409816baf45e1c00ba7034af4a34dc.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3e2bb7d6c5f31a91ebd27d085b78089358c1189129632ed23e3d3824c9201fc9.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3eb1279598ef57490c8f30d77c993ce49012ea404d4977afe5a2955e1607da24.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3ed18e03b19a966482d6428c014f3c79a128342d75bbc6e8dd2e9b6ea245e3e8.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3f2a37726aa10d71c3b2d6698bef34beb8d22b1b048e8e83fae21cb1226a606d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3fa3e973bfb94b37a6fa9712d18f413d610392dc19857414cff6c139d3ae2aaa.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3fb8476dd0129a38375e70b7b7ab334d2ccd39bf63dcf65b23d45f37f9b3dd2f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/3ff71653ed76288babce4f2b780979396d556cb74ceec49085aa156da4cf22af.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/405c8f64b44e0acb728042c965f1f483f7babdc72f2b27e78d264a2f90e643e1.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/413ff835bdadef0eb971446963afbf28e0a8b8659cfad0966acf473e08fed286.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/41532ca9fc80c23347de360fb82b98d381b4fb5b767cc3563578004e0d800b5b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/41751ef0d5a13d355fbc638c9c6ccad83a0bd9062c625bed2126b2aafeddb04b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/41c78a0ef08719e49ad4da234c076f04104557d71d111fe2d925e0da45a55473.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/41d5b980507dc1e9cee3f6b0df9aa063393c444637c5719f3a4a3efe9956d378.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/42f554b2b093b5c7382dd6523a570d6ad433a6ec2f2efdecad9fd8f2fb3fc3ef.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/42ffc7f30bd8543c78d5bca84fa1b4a3b24d987d83369f504c16bc277a7b2b25.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4336a36772d2ae73e8737857b0cd1ae4cd78a8314b7be14c4014ca64671f0109.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/43cef6530cb3fb5ace420c465c8991b7a6660bedabdb09c78a021418f9eb02be.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/44267d93230ea2c0a7ca75c26599657be570c10daab45c60c22684b8d80cd8fb.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/457f0bea41030c1d853939988729728f8f6a9e51abec846c138bca797307286d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/458e7706f2fde765f32177763fa01bab9936bd177660a40708b24035fded76f0.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/45ebaea7c573f76d2362cc3036f80a0ce8d2060da9eb07fc513ca7e59b7f2ecd.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/46ad2beb9ec0e4eebadaa9a1b371f809eec6f103355aaca4376a9f31f1170fa5.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/47a99a2916d080acb7ecb0ce920c50b6794325519a6191d84a744c4a074b0e4c.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/485a96f24bb3bd662d42ebdb685e955391dd1283a51f4006df2fb3da385291a0.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/48e5f9ae45ba9bef07e6faafb1cc49f769ac64ef4483d11880f5bd313468a457.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4968f8ae9f793ae3fe8b11a65390520debfd22eeaff2f880757d7c8f282c9bf2.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/49af4d0281cc3eca98407b3c5f70c24770fe7c77c9cef7256c050d3da0f21268.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4a1c637a7fc0184ba8a5eb8110ec4222888a52ab8d7eb4d4442429bc1891f0d2.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4a428567ecfb2df9a8f13d84d104f1beb0b27c90f8a6a5f43644842e9b9cb7f7.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4a90512d6ca3cccc10c748ad15d33f89f2f997a286838ab063585cdf1a3793e2.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4ab2d35e7baecd91ceca237a1f9420e9e364609c37b13e5e89e2bd820af44dac.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4ad6df8e193d50bb9a8b345e95f86338e5bd12daaf163f9763ecc04f485b5261.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4b0e3b113140f4500a1a8ba25c68f96cdae8da1fe001d4a8fdd3a2981dd78b9a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4b398a6ea1946b4885ffd718953a719bd771148a40f50e8e893b39706a48e68d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4b65baf9c1c9990ab82fd53ded29c0ead725714764ad9892285de73ab5187693.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4bb090e1596e420646ba07dc4b5f1b9be7cb41378470bd6aebb07dc396f99bf8.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4c0617d3efec62bbb737e36da89ba9d00c7a19c8eaddc0ace0c2ae6730262b76.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4c1a6506e55e4a6e9b873204a68196b082abe9c5e6719255a5ace277d28cb591.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4ca1794736e17095327eb499ca10460e03f04690e064397b96f82b4943da941f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4d0a46bd775cc913f3bc133022732df10776590e23b022e9719a56bd123d113e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4e425a5fa51d0ccc1f8edb5f9d953e46ee9d63dc4472f132a8921f1f502c0092.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4e4d22e05b0afe5b9eb6b81c0c0d2b44d992369f24f6ca9dbf42d1036d36ff5a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4e9e6c89ca2727c28357d8b3fa1e6c0bb1d87538ceb9fa98ed2acfe6324f9e55.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4ef3b7007978ea3cb71b667f4cdfdb8e9b7d8c32b44d1b76491ae59c708d855b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4f201131fb674309788b4b35a7583cdf7b92cacf861a7f554bdb55101edbd797.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4f7d6196ccf97f50af528c6f670abaa659b89984d7aff87351a7bb9df3c0a845.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/4fb0d032b8e3138fd0fe7f634ee82937667b200ddf1fae0fdd78b6c8d33f1a1f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5043dfddfc670d47457b7a6ac08e2ad43dd2aa90e76bfd67f1560c1e9f5cfeaa.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/50548be1b5a980abffffe195ec4d7de903506aef0e68af37933a1b6d556552c0.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/507c924137cba8534ee94d14dd53b001f7d377e46fad5ceca988fe9b50f43934.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/50ab07fa39dde3b687d48a9d3cd53206fe893d2b7f395da081655db2bd55961b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/517919f8e32d3b9639a72c1b2340ce3f6f3fd7c97801e689e38a66ea9999072a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/519f4661602c444894beacafff723396c45f8ad9f23ca5363572a43a5bc3a348.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5204974693786333ba7cb5fd2012e421d85f6fca404ae7556e63820a6e907838.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/52203587fb7ded0ec89b6d45619485ec81dba4dd318b84672a111d5aedc794df.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5253b24cff989fee7dd5fed7f008d71ffe8644cc6d2da5be4c661abce8b1338b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5271e15ab731843e58960195270970f06879f81d959e1159c3184e4d6a671e26.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/52f253ef6d77aa82515c57677be70fe5db460dcc9467bec94e6cb8f2e14b513d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/52f7575c89ee61f3eecb5015b5cdbb5a807ceaed86ee0cfb15d42048b87dd7a7.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/531bba9d1710413fb091993bde54a849fc81e599cc631db8d8d1988f07c29b83.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5368df3f92fe5fd66c2af89de68d20abbc37340eafc76fc297f3d731095089c9.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5369d4f52fb48b74dc514392bd8ebbe91ee1fab2eaf81acbf60594092209a4f7.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/53c2f33f0f1694a955f4d95c5326ef1d4b01b82c1ae608f4ae85c87d9571f64b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/53eb2900f624549450271f424f540f44aa8b1e1c959e115b29a6098924419b31.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/53fab8477b6720fa302f96a21b176a1d52bd90f6a481949373ffdeca1266890a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/55375e11e4b15a672b8388e4eeabcb467969d06f7787a3a620df650f9ab6db63.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5592a57d9fe7f044362c35403ed6551b3d307229511557a00bb1cf966f328aaa.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/55d2d9c93ca3ec6778d60db6800b066d78975fcdc84426ae26ac912a2949f7ec.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5632706e2dffb855028662f6354281f3998a8d7a5fe016ed070f1d71b3a2e9cc.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5658f41e9214d2416f046e3f283ceada338f4fdd8af7ba5819f25fbbf1da1325.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/56948d17ce96bebcaab52e78ad30b6d52b6ab5203ab25c428ef70ac074cfa974.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/57389d28d93dabbaa4f6bf067fa73865c8bd52770306705de47b827ccb4d2114.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/580bd5d31400e2c54df9d6e608624f800c7c7460edb03f0397bc557730e4586c.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/582afa3baabf82d3e48da7b293f081d9792b3d5a0da9a36e780c9dff9d651ba4.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5847aa3e4cafe5d4149ec11313ac24b72c66701094aa2d63f33320ee84beb9ea.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/58d323cf0a1695a2efb19f0457a1021165682883e09d823e00d38c131be417e4.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/593ddd79505ee966342284e4563a6d944eb0b242986e982151c8400bbc953a13.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5952b4c2a893a342fb95d65d44e8ebd7e7accc6c66722fd67d78fc6e3398343d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/596cc71603b1eb5a2425816977f313d163e964f4a1ab94cab0cf5623a9d28c1b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5976c9544fe2e9fbc2eee8b3883a2f1d7a87fb42e989c5e0a34446678626c32e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5984855e746df2e3b9e02260f6941aca30b3c546a89f74b00844575c5b896d08.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/59b2a859e22951361c985d6f0cfecb016897b482cf40a95134eeec2d554aca1d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5a06f1315f99894811e30f48e4e3cef8f518637a6b7d18b9f832d67b4bf5adc5.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5a0a788a03fc01d4f2146dd6b338d8b3a77ca95bb02bb05c6b6b1c8b827477a4.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5a9c6702ba942a92afd932452c4d90d349fac0256d34a37a20f6510bf7e5ece8.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5b0256729e577c523d9c95240393da23e259d16418801165934d7eb82bf7a066.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5b0437a5e89c5563416c60bf89180b2b1f79f565ea1edcabeb9f8061c6f5ee46.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5b7986d6d2c52a306e7698db4bc9e176f9412a93a3c7f26636cebb8e3f65649d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5bc40f2d10ca98167a0fc8d4864d036c584f359784762ce900f5d0fdaf995069.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5c30ba4d3906b8e8febbf2800e2d0f7b5fbaa22515fb49252d022de7fd18c3bd.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5c415648e7ce0984043780ca171b7e2961703b3f2c6c24eeb5f952cbf5c9a2a0.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5c6c3530d771cca16323de7e86c8c557268b6941aa009659452018250e5afd79.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5c771aa27041ea41fdf33a1a10eaa9b68a2ce4ca8fe4fdd5058351ab6b0b6786.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5d1de9fcdda0f1e02639e65da8c811c960c0b23511df06e49c4d66ac7b05f259.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5d47527bd8a62015153d55b997c85fae0b5e8733a5b082999a3092151f391e91.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5d4c739ae23c133a5ddfc632f2479d5681a33075353daedb3038330690b46e73.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5d867bb46ed7f90cb6e45b26617098978f0e4ba0717ce06aeaefa8c5f4ff2169.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5ddba20ca32d14e5e0e3245b655a92f752342ba74f16122d6ffd2cf2a83c17ca.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5def8d370e69cb8c92788b47a4765aeb7bfa14ad64c23c0ea9aca2d206c151a9.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5e5ecef36302dcd7783226f38c5171cdd59f2e33622c9b421d72a393b1061d77.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5ed06188ce457d6d70a342b10ef28bf017304e61e01eb6032d9efa1d05c61026.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5f3cad530cff42ea31dde75b3a2e8e24d9fa4cd4cc847429d1cfb86b5c12738e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5f65da20600baa70feaa5ec3bdbe80064f2dc7ca50170a4eedbc2ece265b85a1.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5f84ae679ed5b4510912f09069a162e00ba3e874d523cca94572cf5195d3e47c.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5fc092684f640d23794389609e1122973466f3e248a3064566d8bcb27663de83.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/5fee9b9527490e73d838aba9fc61120dc9baac829e115891e158ebd9333d89aa.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/61d005cc7749c20e65b7ad13fcea66952901ae8c36830be31ab3212524bc9f6c.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/620810c0c654991d839ca6867f2a46041d960f58b0b11177a779d12328ac868c.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/6267ab1336aafd579bbd273fd31c9295b26bf466250d524ffc1fe0f9a7fb0531.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/630413a3c3413763b5083d06962c6c0c15106b62db1fa419e94866adb7023aeb.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/636fdc077a60d50b2b6ddbeb3806a6895ce46c5d73a938c5ffad50292257b250.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/6370b7e6d83128a75d405c48fd4d520ae8e05b2722bdf8051542af81cc78ff9e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/638be5ef90cb7ac086f963e9bca35549da9ec49b2a224cb53ddfb49d7e294cb5.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/63ed0804e4b98b1e0e1ff7551371972dbb3fe0a8c66bf2f2de034c088ea3c66b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/6419873dea28853888a7b3c3bfc00b65bc0828d4337d5340dc40de5e9d541b81.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/642e8b0cc7c5612df0a44fc226ba44bb5b0dfa5a2d3bc1967e81df3e63e815e2.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/64492425b7f6a9d82f5d534e5747308c12217740fc5c7ecfcd781d67fab96872.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/644a0611f67758cec00b57586b40e09abbb125dc8a7788dbd701d0218c644c69.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/64556a8141c256e55b6870cc9f62f3c27f0efbe2ca217bc13ef08bfc71d6e90e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/6473131c5b8f906f82fa0b83891cdaec83ccd19bb1915420e78fee4a023d4d0e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/64b5d3490731e5835db2d907abef852e1f357fdab7bcf2d650940a89f04792fb.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/662c09f8f180ba91d8486ccda57889664bcd7e66c7457b82d7b1ab70d555485e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/66546b812a554c5e6d4f3be6da2a5fd2c8ac0d82fa2f69d4a2fb1b2a7814d0f5.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/66be662a03cbf1abe197ca113f6d3aa41c8fea918874595aadabfe812207bb3b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/66e9d33c28e61eb5b4623ebf0d000279adaf01a9aec816e57696a39f512f093e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/67c43b0c65104dfe6b10e64c153b25b7b54ac631c61add15e79a68d7bc65f2c4.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/68b55673f734cc1744e9f1f8f1d3e327d928b0fe2f916d17021ed1530385b967.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/68ff941b9d3b7ef7ee7bf7552a148a0b8da12a7dedeff2e6ab085db31ddca2c5.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/69200199a64e36e8d248e1907abfc9fc69339d2849920cba76f57c2a3d5fbac7.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/694f93349224648912ef8bd5547a8857d7087fb1c7bbbe9e4dd703ee4b60ea0f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/69dad1086c17cf1e76b06627e688c650e1cb69f8331c452588af2184abcb0397.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/6b16fed2ae43dfd39fe77de8ba7c2f28724f861db1963d61cfa768ad6c99ccc0.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/6b85cd4485d398094da4267e3d2343cce62cf3b8c78cc733674c02cf2a1cab27.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/6bb4909a11dcf89e34e55141035a8a92513180941076aedfced45e3b886f5f7f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/6c5f0e695a8b2dd8adc0d2fb484e7995149068737e2ab505af51be2bca758fbe.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/6c60f966622ba818efd5abb7666184842abe861acad56fb500a59035ca85fbcf.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/6c8734e4d181afd00507b011c836edb4642fe7947ea9826e3fdd250caf7d9b5e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/6d035e0bfafb9a57ef13d6e10404c086abc729432005c256ff53bb3b600c05fd.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/6e746acedbdf074bde1058b018a82e359f94a794a38171bfeefc140377fc4f3b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/6f55ce3d4d416e9b2c30510a8becc3c02d2115fa9553cf27db10281f61be7e01.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/703e008d91a78604927122a369c65ac588da3389c672dd7d75dc4a147642b1e7.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/70546bdf74ce3bf19afc3dc3082a7094f7f2be6221232a881e4ee766dece4cfb.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/709f45c625ca60d84eddfe1428932f070707d75ede17553b6809de627357afac.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/70c395166ccf2c80108f6fc2fadc3760dd0ae99ed864a083bc89ee21f0a200dd.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7140ee981917e3eff2a72623f5fb72b4cdab4b49a3d07403e19c411325f21cf2.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7184e2fb2fba5107c115cf7467f5c4b77d0e09d3119792ba67b6f8d2d53d0620.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7263daa107d02f129851004692e9a64bafe0ad4d0559fd4ab47f5ef447944959.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7298ca3729a65254aa658d84fc340627d41ce77a0b599acac10e09bcb2d5215b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/731a3c61ab1ca1efc29817b540ab0a4c4844714926b2ce79d523f4976b1b9fcb.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/731b5ff7e6c34bea248936f0c71cd4942a975dce1e3ffebb2b0f0641c09d961b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/735980f59c7edccb2dbe4379d20a893bc2bad8fcb063c1dc4dfbed210c711a7a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/73ca847fc87994d0a8a6db27cabbc37f903554121da6cb51ac93667f06648393.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/73f0e4061647f8080971dc9328b7c3d4e7f0cd4858e50c8ceaed7ea56f5c49be.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/74116bfa32e0f5063994f869033bc2d45c6dcf78f66d0f907d099ec3a38cdc2f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/748708357265a9259821e8f38ed97e57b38f0a78d1c3cbd50b1929c678ec8a8e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/74d02665e047c14d30fbb205cc4a9002b4b417eef85f39367bf8286a1304f01f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/74e83b2e2c71b9a2f079dc8d4ad4b81911c89624c0d200e6f55e3a43cc3177cd.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/753b2f17a6b8369b8ad426755929a8ddd574ddd92fecc1af8e71295bfa1411f9.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/75420225dfd537b8d1ae041db664262afb7253be2906fbed131060d8acec1756.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/754d45a483ddcaeea1332e60e5b0a0646ec020c72c727da63f4174301b513fa0.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/755eba963b8b5912b6be14d10d28812b08c653643b2bdd1bd87f9b09bf98ea9b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/75c249bcf2a883392f52f528071e834ce7f9efdf036bccb935d9116594eabc40.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/75e5009c7a419f9a689d84f8fd8062b238e062805a8ea6bfa0b1d85acd0b5419.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/76032338a324bfd0bb73a17e5aea77ab309cd0e1dfb25e0da1846b025cf1fdf6.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/763a47aea26680034b5eb06bd88adf030a0008af792d20a3108700cf1d44dc2c.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/768388773ac3fd5383e3400772f45496e9f012675c5302aedeac431b78e1d4cf.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/76bb339568c0d7a66373b0350ee1ec00312c4090e2b89c8718d4f9ad911479ea.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/779c781ea96d7bf28e249fdde19605e148cabdd2b33de698f6bbef32e64f8b79.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/77e68d285dd7ecc1e9d19b5fd563f526251ac17d001ceb4760b8d6ab504c697f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/784b6437799672f2436518394664ad3c8cb17a7dd42e92a8ef643cd1959534fe.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/78b7a803676c3c05a9e56351dcb588923613b03c91eb18585dd4f4ba334dd426.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7919ff3dbaaaad2a687db5727e22780cc748b5c95f62debcc345f4e73f7509e4.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/796b534e75aa769a362019732351259031a9b297cec4acf07619c158f2bd5548.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7a61de01f670c78e66e3b74749aa2e81743e4823267b2b22712c696400b01cff.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7aba1a7917e6e1c45f2736cd1d60c3876ef007154984949c99006d1e6f693b4a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7b03c29f663308b9c71660ee849e875d4d54e38f0aadc1591a9ca06203d730bd.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7b16128095b7cb74240d322a4fcb987a6f5eaf96958d6c8e7473c2f1a80a612a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7b4968d58c84dfbceba216e98b77946412ddfaa72153143324af641f486e328d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7bddaf37e49232e86590a8f4f17f353c0a6eb96998ceace669b8616e39c58cf0.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7be74cd68310bde29f69147dcd73bd842d9e10156f4ec0885605f23e95035bd8.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7d1255e083ed5f0b8175f943ed26084e25512cd03a5a04c23924e4b5519e4fde.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7d25c6d4c3fc4bbe510e3a91b9f5f34de4cfab551812325f7c0e7a06b8814a8e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7d2c3b4308a491f32a60a4df260971bc49d57d3a55908379398b8bf8a8cdaf42.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7df96e59bb7a5edfe9064be2b6313a27dac44020637e4a9747fa9db0d760df7a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7e6c7b91f2ab7fd6cdae6d0cf15b2820a0db79eff671460622624a58594fa974.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7ec1b7078c44b92355d48b95fe52fcadcc36b2bf5a5687940ca40426468c9ece.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7edbf4143f7dd27c0285d2e13d3e0a8efa804ab0e7338d30bd932bcd7a4b505f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7f0217d5e9fcd9c8f4331439b11b9ed2a2d9b5d707d434926471a213fdf3ade0.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/7fdf9a27075ad1a52a075a1f454d780d2f4822bf5af9611071d67f7784de1408.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8043a3df6b189994c409674cdac340ef5e46fde6ef7837032a3325526fa0598f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8182a2382dfa02ac48a5b54ee4085d2e3afb6bbc2b030ccc7730462c82846710.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/81f5fe2a83a9fe6841419f4e0b5b82c977795444b5e03ec09b0f1bb9426446bc.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8268fe38976aeb16c643b18c216b06cb2c4d2ccdf60b65261a9dae89f9ce5d43.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/82fd91807ca96ee7cd4c5876a703efd4fbccf50949f9c1cf4e6ebb914d9c9614.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/82fedc5cad4660766f83eb5e9b2dc1bb73d1ff45c507936d87a5fa236af37271.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8305d904ee29992713ce7f22d22eeb82239d1c570c53eea94bf9b6a35d01776a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8385f73ef9063e476f54501c48a835ffc76cfae8b02a6055955f16b2dd1d51dc.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/83b93f2f637604cd67b17dee083782a693a70a05168beff51236604499db07d9.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/83eff0ece2a10a5e521a80e6e7393d3be5fdfcb0a4ad0d2a7cc1342bf121b5ba.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/847197c0ff464dfc3114e7cc77b3cc09e5ec54b5afd6901afa9288af58766519.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/84c426a2532925368e0498bbdd67dc3d82080d502c852bae825b80e18a16e046.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/852e7107c456d560884db7360524105a02391c94e2b5504aa0c69c8306918736.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/85b3284a30406861ed0e479da539c346428c2d80b67663647d275e17e9708b3f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/86de84d7fbbecc3958832239127a292d4d510613c8d3b9a47a70ad980b903c79.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8702146daf7bd9182a2327a6b5f4bacd84b0bd3c8c2e021239fed57b01308f32.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/875bc5494477a1fb8c6c72dc31bc98648084574e9e2d2bb751dc9383680124f2.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8803ab6aed4c96c099dad8f5641c1d90d30bef69bdacc997ff64a99e38f3ada1.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/88092e12eb9cb7b2bf65bc5ad31b204915a0b7d7325e1f7e92b161998af18323.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/88845f405a56e298e53d5b48b4659b0ff7396276cea664f1a6ba367bdb47fa6b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/88dfa35105091054be2e945ba6df690b978ebc210b47aa5a34b846edec537e80.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/890ec0cbbeb22c75d5316798462186992a3bda6b098b6bc2db24f26e9bbb4945.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/89bcdb88f7117ab8f06946696c6b37084de995c0104e265010c60bd0cdeeef3a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8a27540b8b864b7d0a4cbc1bd709cd62787228aa12d4aaf345ad4a19875afbc2.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8a4c2c7cc4256bd91847a6c4ae299081c7cf432388f2a4a9d12ff55aef6587f9.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8a617324abef8ec94e51a8a8acda711d24a7aa13dc46f36832596cf925e2f0e4.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8a729623093702a0711f9134bad0302b170b4a1f7adae98d4acb0602e222d73e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8b65e991491ab8315b166e90819e858b6375ee79c901b6fdf0f119103a04b036.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8b72705e83306165e711acbe034702d8b992852fab7e0ea9b0df26fd645bac90.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8c00412a2decde0a2b09a8b14b363ddb31a27fa1c59b0c4d82404d832f65c859.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8c045c068e0d75d4e3a287f0d86f64d9481f937b929f50f9354b8a9a37d0e662.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8c8f6928a57f1db8266ed8b700645f2ec6b780ba72e6248dd78bf8311a8b1441.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8d071cb96a4319410e5a2056a0b37fc8c094bb9a2c37174af56e856ae2fe604b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8d436b971d421f7f564f52d90884c3409f2c60d4195a53431f972536401a2427.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8da86aa4cbe8e862c38d91598cda907bf4547c6db793d21f2fb2720a9fa5720f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8f1c171d01a4835f637014896e5102a52678c8a6bef2dad5a4b9ab0a6703a46a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8fd159ba3eba9b458ba1d88d0843cb8f887d21f2ded379de1dd8ac9a918be085.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/8ff93c6a86c0bbeaf85537db3f6874b0eedb0950f66840802438ac7dd16cbe97.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/90726982e18c60d2c97686ee58e31821722148873b35f6379ed7ee58e2199244.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/90937582e74241358da20c1bbbe3cec2260cd7773b3d3f82052a9cc0375326e0.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/909e0ad99fbb60ddda9169a539f904be96c2b31d37a2d3e81beccd063820afd3.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/90a0e2cbfbf72853d97747a16d1a54c4ebe66ffa3723b9a01e5378718476bbc6.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/90dedf26a5196ad4c9dbcb0bc42b164f8c5e3b399a7880fbb3a9eb53187823d8.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/90f1f52ccfaff1852b8d1166abb515d4006ee2aa508d86e2f2c5ad26ad94153f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/91202b5b3c88e3f0e33c4c8c77f32734bed0d0d95600b4e7fb30b4434436d44a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/916958b214cf47b51a3b670cc37bea520e81a8685fde8a62c1e0839b1210494a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/91d6c5ee1c600fc29257b4a39770090fa4be91a6dbc8ce01ad01a5e279846bde.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/92c49aaa6bda7985a24f46f9fbb49b3ea61934e34118483e9d29e0713efa8d63.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9318de578aef18816bb051e206fd6ee4f98476c6434d53f1eee323b0cd12581d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/932bfb6b88c60266b284538c2ba7b70f23e6acbba8986d0f19c5773b7e9ed675.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/93583466baefd314e489c6526855d73d1142e014c31949e2577994cda20eeced.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/944d0389cf01027be5a4d49562fc29b4205cc7c290f2db5f20582d45944d9b20.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/947be6e1fdd114802fa2700d2b73c7b127d1dfb8734f2f8531bb6c7a1928ef37.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/94fd81e282407dc148393bfcdc7a5927126c7bc60d522f9d87a577271b6e6083.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/956ea396ec6c13ea97ed011c1fa35dab986f8d869927235a368934a8d7c32891.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/95bdc72608ff7ac779ff40a56de9fcb17b85014686715573470b15d904852f10.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/96b6e79f93f5a9e5860dba7db4dd1b98e853bf36f625afb4785cd7de204ef947.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/970244087bd2dd4c0b9ef2005cca55ef097b11111d5d764b912e47415a3608fd.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/97065cadc68e1f9db468ed5642e4e15a08434ad575922f463314023412880e55.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/97528d21cd8491f6d2d50ce52a2f3683c2ce61cfd16bf0934a51ef6fe121faf3.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9758b1b4b9d014da6782abf3238bfe68c25cbb47b8513c5dccc28ef6cc356c1f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9785f98c227c6f06063f1b567b6cd37b9fe6d681768035e81140d6be5a4661ed.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/97c113a73b9e40352f15d9a8a656ecf9fd0b37390e9d097295fecb8ca8804243.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/984ec80fa04ee8f3af165b721156c8940a485a776be1d25431d60f4a9b78cb3e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/98695bef47ffd010b13a0aefbeb59fc14e04ae81a7b1f3201d47479267a68d9a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/99003d75fd8c3c22a0181d6a84cbe83ed94cee163b154cd4f01e56d9aebe37a2.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/993ea425022046423b4ca0e93ef9671cedee8e9ec65bd2d9921376fd0d492fd8.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/99536fcd90705416ad28eef802d74f968c70b0112cbda3d0caa9406d0377d0cd.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/99f53193cc1ce34405e4373cb7c2ae188bab7bda6681d5dfc557191e8c9c65ce.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9a3c7920723fcbeebb6a92c2f959e419e877948619c475d0903cd36738ad6596.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9abdb7a829554f8b1eea59ba8dfb01f024430f850a493ca5a17936b11d7b17ea.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9ada7fe3e0469ec4664e78407bd7986220075f5b3655caaaca389eb1a423eb47.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9af27dcdb8452545e4ba2e19eabc5abbadac36e296e9766368371a2d9e5cd536.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9b28767d17dc43acb6cd0d6b35daf143ca6b44b97ed13f7778e090ca65b7eca7.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9bb7e672ddd37bf6ea4b2801edde32547b35324defb08d60768277a05dd3f867.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9bd6abbe81873dd51546aabd9183b2120440f5c226757994b2b884228cc4eba4.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9bf3c4606226345a447be183a7734174b47d1bbef1008b9e87ae0409855b6225.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9c33a0997a87f10482455f479653f04202638fe6e661a51a62165a45b6aeab80.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9cdc45a086c11d7db480306bebe303193201b44e538cb3c2c417c623a62eb38a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9d1584cfbb865e994672ce087396b0981d70a35a52e846aada71a408789f75a2.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9d448031a6615bb88d65494e9030fa115f711c580fe27386e278e88313399c20.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9d81c4bab62be67929b6f1298e9ac642f03f04d6fe6aa25929dd3206a6117dcb.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9dc1741b3391f7371ab2621cf82214620dcc24df2073c712e5d0e6cd26ef6d8a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9de6b4180677ff60a19c432b31fd1a3157beae4f1bf5c26e3318c6109b2b51d5.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9dfd813d1a2abf61fc8a01d2989788200ee50fdef8e3a12dbcf423a570d05f86.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9e5516d86795af901f8246b72fe450167cab22681c7ceaa867e2c698ff82dd2b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9ec325253ef5ede63627cc47f196c6c6341a5d0f713f3cea6157b41d76d6ce32.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9ef89c66b2401c66fcf2296cb84647009e8bdef7ebdb64913484b50346befdbc.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9f1942e90d39188e680dc287049041818f0182fdb2631eb09ac83f70407993ea.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9fcf95fe87aed8acd87c424687025d7594bc25c21ab7d9f5c06993e5d8861e29.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/9fe1b4c92ea6794a27a9c31f2d7b786f94233db3feed914b8b54fe8a6d9f70f1.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a08152df7e560c047f4feb15fa443deb90da9dd762e990ab8c8a5fa08b12e0cd.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a1daed63f02dbf6a8d1684432ec5bf91db1c91b3c241cce12b7a4ef47fc2b71c.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a2366249ff8c94196615b4a2c494d4ac2e5c60f1ae0a3d2f6f24d01b43b7cd11.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a23680cc43fe565fa95afaf5b4b281d9b3f477dad46a4db137c104db5ef2a012.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a2958b1a84014da9c26af2f06024f27a1dab2ec2b224a7a0f702c5d32f23b6ad.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a3b6857391637409345665f1b4f529f0fa9a300a4a9c8427a199e7fa137c5c9b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a44e1cb0aa466e52a8120eed46bfe49ef6c765a06668deb9a10db2154e176e45.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a4a8e48ab6f0cab0c0e01926cf29959ff2ea3b05a240ee4d5c62f386cdce9196.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a535248780592826ae47144d0999166799c4369b88d26397142c0007edc2187f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a56c19ad34ae27a0fa539aacd48241e1f9ebde76a2732bb3355eceaa45f1b387.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a5892d7e56b2b76c7567357a6b4a2e63078bf183e8a46333b41b04ce7d352636.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a5fad4c10962f875570edd28e8bf07dd8e1d7569f8838c14c85885cb261b8d26.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a61944ef7e5251276212bddc897c741dfb072b181f7f54a780857e5db27beffc.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a61cae1c7171adf8e29539f67a3ed780703689f911e9499ca350a77e449d480d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a61ed8352b3f435c63d6c15b19f2d0e18345bbf89dd29a504d79beb145fabe81.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a623407d9a43c43628f17d2305e9f6fdbdc1065e8fcb884ec1bc767339da3151.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a67d40c84e0b32a7afed286e64bb9fcec37a3896796f11a90f3a119e30191e2f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a6d7e3fc4ee40273f92ad89cce1970dc8030fdee6a571df6c05e77e15f26e844.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a6ed10aca6dd4b6a1fd5b4b4c0912b4e7dae7cdf43ee6ca1ac9f148e0cfefdc8.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a719c64930405e6c42e302e0b82334ef61aafc4248fb8a674bf3594e7fbabd6f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a72952cd1affa714f52015351d2a82bd27b07671d2c4749603460d70878d59ae.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a7c3963a13af015b9e64c0133b06d3489872495373ba80a6d63da9bede4e5608.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a80dcb26e11cfba0515662b9e29a8c6f898efbfea304485f32981351bbd23536.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a82c32ec1fc9c7855a036920669643e41f037294ae0b20b309e62cfcf6be12d0.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a9103d3d4a9e62eb2b2748c4af004fc0ffed62f224c1ad836b47a1447a50dbfc.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a99d1d3512649ddd7d76fd3db8d1e2d41e02a8b4d0ae7ea54b9fd059e1ab7b52.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/a99f251f6cd8a65ab74527d1a375de3ec9a8b71173fd757a7693962d3b078f7b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/ab40c8e0e9fc249dd9764e4f203ac51f5c05db7a24f15b1a8b31eb2a3fb7f4f2.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/ac1e2b85c4b64d18b59c3fb28c61fee100c617e50e3fd8ce9dea2de6ba388338.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/ac399d10dc65c209d39b289432c4c4baeee194174ba8bff4fd44b0ac98ff1668.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/ace21acbae32caa85e56fe30df9e38369a90aee3763b63e42d1cf7ec26a4fc77.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/acfc61ee474440bec8fb3771648f2fdf0f13b9fa9fee24eed55952c5337a58ff.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/ad0933b88107e967ec169862a094dd4207dcd3dd16f0e69eb21f8427a4fb158f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/ad21c2d01175a19226a6373f5e4c48df1291db4c6e2cf1e7c7bf7295d9a7aefe.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/adb92f620f6c11a2cbfe2c6ee53118d462f55bf61234c0fe3b7e55662e44bb96.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/ae66ea059c9a4f3339533ff32ce31f58a2ff7ace5dfc9092284230248533cd56.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/aed7d5cbf476b76b922925af61685e54d5aebef6f882099b59166877378fa396.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/b0bbf2e167176cb9bf90689121bed60867a061ff82e7826eb521e12decb6c3f1.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/b0c472cfc2829247446db51e65013364d18bcda5ab7e51b3f3df64500159b171.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/b12afa7862d90838b68a04d116bb235316c01468cf5e0e6d17d20fa0019a225e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/b12e40991bbbe787538f95e1bc8bd7ba8be9cd5251fde84673e8dad9e5353dca.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/b12e6f221faa8cbd88e627be38dfcd79832ab36fa16b45eb9db497f3bb591000.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/b18699a77aeb1a7474157cd681af6a0cddadac50cc16052b834c4325f5e76fc1.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/b2090bdccd2200db84b79eef9179bef2e508f187fb6aa14a64ae9cc16fba512a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/b2a8bfaa6e87ffeeb4d055f2949ddf755578da779aad4025d5998347ce32f73f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/b3b4d2b0d3f0f24d9fcdd4c160ae90beb1b2eaf6466510f43b145fe58873d67a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/b3c24b48321b7bc34e88a709c2e9197bcaacda6156e451bc298f8a9f1695bee7.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/b43070b8e7c0037d35ab48bc7d23238d0a58ad381bed8586a689f2f90a69b55b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/b45811c9ce53695cf08803348aff2e062f04cb5b2a013b36e78e5da969fad338.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/b475d53ef7d0c7b982b5f1201e61edbf3019c0b7acd1c4e72eb84279d8fd40a4.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/b4a971fab0f6b2cb07e0a887ef9a84d2b63e486394de5836ffcc8ed52bab9eb0.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/b4e0e60a2aaf4a13f6ccfcfd0a64fd4eb5022d4e6aaaae0678912296d3fa87cf.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/b66905319873c530e1c6276120f3659c45ab6677e095a34ee2010baf581698ca.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/b714eaee98c8d712f84ac0c532c39a28cc34416c33c17d43c5ff2b8b4ec44bde.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/b887efa2510a55ba227f7097cda8379109840c38bedd1a49838022b4b4f6ce0f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/b8daf388b4144d2b09c02dbf483ff142c4fb297bf5ccf9dff0e58a17f8e9c77f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/b9fab83453feb3d1c7aab9d66c548e0b9e08d18e58d2a6c4473e4496d4c2a105.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/ba16e65de0b94903490f3bc68cba2e6bc5d61072ca995731fd0532f938caeb77.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/baf36bdd4387b11e86b0847ef262fb251bbb8778bc69896ade4b32015019944a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/bb44da6aafa79faa6a985e6d115587e68a280832654290d1729db91006ea7686.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/bb65cee6f2c5c06515c039cd4e9b78795d46c5c9f04800ab5f6b113dcf96ad80.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/bb74119feb0536c218c019d462cbb316a7c779aca7ae309ed6b5c4d920b09b02.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/bb84afa7444c27b35e833309752ed978161f7201f26e953863f5dd0937e8c2b9.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/bbc445b3dba82d062dc3fc8de5701816df8bc38ddd0790ee294af15214b5c65b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/bc43a1de969e34c2e8607a1986311deb9fc80d0613ccace59f9df55a2cc5f3f0.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/bcade69f7cb15946d34b21317d54082d3696a518bd479d6469d5b4efffe5a287.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/bd75c0cf6e99fce53a323a24ce9d374800d2b9755e83722c1557d923bea7870b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/bd94b1fc200d8d435205c3dc1f1f1f23acc8b7b285e97e78226fb46a1872aa93.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/bdeaa12bd9b96fd7baa57824fc035ec682afe560abcd724594f3e1e8f52546ad.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/be0fee57c43b6e88618cb417bc9d68bd2531d081dfb6f4f8c87a9fec93b450cd.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/bf05ec09669ee62551cf03339995f5abc47f813483e9dbbc9cb87bfa16f68d4e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/bf8ad92b4e72b17c23d2c1e4a32bda54b06cfb42751d558eeb1be41ce090b3d0.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/bf9364fb9b1a3eb53541848408122180889277b59eb68541972fd50f6b801e70.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/bfe614ae81a43450bcd0899de296a9a2288203f3e6dbf34060d61f3e34d9a980.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c010acb2d881213236f0f02e02b0a666fc580bd2f584c745a94803ef8de28ae4.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c0cc6ba04197081a48680c8ae1146ddb024988a89777cd669bb163f98c846533.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c34bed51e5da47c8ebb25b7bac109f34e35cc4db1eff5012bc8461361d4a95dc.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c3a77ab76676f19debec95e08ce1696951dfd90ff9fc2d45e5125be3cd3deb16.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c483c3a91408f480492c81ef1a3afc766462058f717fd4d9d43fe713540289eb.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c4b3c3ee8a8d036fc57dcafe7aec77ea715764d3c51d4be45362658300a8bbd6.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c4de486a5b8cf200977871d4061d5616e5a3e8731353b1adb7cfd095c25ef44d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c50d456d9eca6dce9af6db788993d2eb9f48985e74eafefe936edd42291d1cbf.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c50db09f4a0f5f981c4d024f044cef900b593a53413ce84bcc7ce2d835b351e2.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c52d04a1a9457743fb4572179967b67ac83c581ab580ceec68fc983ff5ef5a74.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c6337bfcf2539a225495b5becb9440d59b7b02cb384b093944967666422e1fab.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c648098188e485e12c97ea426bdabe9b7ec9a726a0005380090286e7fee4d39b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c648e3f6e667fc022bb94ce283b5f8d068321c5ef4197c7cc3dc909f323e7885.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c7c22ecb7c8bd28cc07d7acb504f130cfd19253d90f4f081ad4e6433ddf2b39f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c8119b12b3839fcedc5ee33287f13f478b5878c1708a5746774c01f3b60c53f8.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c8140a28d003b86551b0c6ab5742c49a6a002a8e23c91b0fa81f0549a23268eb.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c831de2e722db00e582f6ac20b64a8becabe681a3dd317ea4415946a285d9491.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c855c0808a6764bcb1258cecfdcf9baafc10656183ba09a0aaac7247505283dd.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c89075a808e79fc377cbc01f2141faa0d2b5a1b106531fb36ea7b14220d3285b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c8aa6651428c59619fbd52422e9fd6c09c48e90560d68ed3457174fe14541b48.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c9b8833cf9269273223e1a5d636719b118b06a71d771396411a1ccf6b680ae8f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c9d15d41b12f356fb41322cc50481ed59b399a859b8368935151db859819acd3.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/c9f5354dde2a7bfc8fb2d27e7b9b5b4309c3f7467b1452c71e301abf1a6714a2.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/ca2d045c000fec4c42be13ffe585b076cfba12ed744ddb7523e66d6cf8fec6f7.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/cb1641b127cd3f65d508f4efc3b4a06aeccf82e5cd1ee77e0ec5c222b6f5c1be.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/cb1e4f47351b4bc38a6fb45a1fc88879d7ba65b91f0e2fbbed6abaa0f6369a44.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/cb8f39873116f5ebcee10229fdf3d0503fd01da49e14da67b93e9c1a92470590.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/cbf6a831d1423c7a46a4539bc3c213b4be3c15a851cfbadcd402e2467dc10a80.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/cc05b1f74fc479b06684232ed83518af1ccff6d9a6484b54ba8fdf3174598477.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/cc6b4df9c460480a90d97222a197d9194a9c3ed1b3f07facbdfe49bae976c9a3.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/cccb8ea101864cf0547a0d43bd8c63864d32656fed70a9c2f48461baba025ede.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/cce1170154ed47ddd6cbe182543f7e5f93b86f2a154009bc42d3ef91cbc0c0a7.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/cce539b179665615380d6ba209b086560150a3f8c932184e3aff0c671f6ffb60.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/cd249f84aab496dbe74e761f1de1b3cad60b85f405f062fc657dfe89069791a8.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/cd55c9d9edd3ecd378656ae77323d1deb0f31d4a15c85950c5b81bf8ca89eea6.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/cd5d4fa556ec97f79fe687612a52fac2ae73d45cf9f676940589e9ca893031df.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/cdc97b8ccc5614976fba0c1ecea69d3eec7bcc6010daf5955a0ebd3eb25e6479.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/cdccc6513e30fc5e7bd3d59c35cf407d131ce58b7d67eb4bcbb80f98437a167c.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/ce6d2fbd0d5f71fdb7377d88640443b99da910aff416c56f94c3d2f4cf3c19c6.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/cfcd6d663836405051f91502adc1ae12dd6507d71c36efdd0e3d657daefde212.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/cff6fcc88fbc7d6e2375c9080da8a52ebdc57c2dbd64d09c5410d970c83c66f2.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/d19ab8b57bc935847d3b08bad87288ee9a06e45d84725d882ca028d8fd6219b1.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/d1b570e35abbcc20ce69aa94825ec0ffcfdf69123ad8344c48ebacc37d597880.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/d225aa13eac0a7fd53e8e6cab13f978728e4a7cc6a35a0a92ca93d9b5f3fdee7.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/d32d1fe0424a2ad37ed8b413dfb69fcc5c0743bb78f8f417d92832518fb9c112.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/d34ec41a31aefbc87e75d834b63c99321511b0e44c1b8d23b3bcf3073d5a6613.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/d39bfdc86ebbe4edc116394dec228376a1fcad0ba3024134d4591a6384f7fb52.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/d4471f0b4b224a2c5299762572f3db2eb8947ced9c6e383c5ea9cf5310c43a76.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/d48291fc3ccdea8025b3d64869a69a9c661c44fcc2ed60d4fcb6d5b258bf4f09.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/d5a72307e1d7747ffa61607fe78e8cec8cc9cf983757518a8eec9759ec41f2a5.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/d616f07f74755f5b26935b73c99afac07f22a87d0dbe479b54371014f689b439.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/d7753d488a0488ab08370b797b27b14aac507f170bbc7e197b71a69af47dd385.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/d7c8b34b77037ca5550f8842f3cdae7eb834449655b57d49ced9bc9c93a59e8f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/d8d3db586b30b835f6ae1461d667101e33b67ca737ff66c2b76b0e9b4cc1b6de.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/d906445f9fbfe77738c3d95f25f12282e3f5f309f6385e2295c9bf4010174dc6.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/d91fa69b1e334cb787fa242058eebccb90ec8ad9040b98d6f7c074e2cdbf2f84.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/d9933193744f4a17664acaeda0d869564653e8b39de35fd47263538f4032d527.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/d9bb23a1fa260b326daab89db5febd9a55528d4c3b1a2f38db38d24bb9e664af.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/d9d450318131a45d94dc7a1fdd62b94419f823206fb869de4e57a5295d237570.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/d9de0c364b4d8edf8c16499491d9259e7d0698b13b62466420be9ae4f34b2bd8.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/dae1f60b4b3fd27ae662bf5c6120782d38b982f334b32c81abd8111d872645f8.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/db12f8aca59d6e7d5b3cb1e0b883319a2a281cb9d99c02075380fd11ba0207ca.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/dbdb7688a4a8ecf7411b3621953a2da9da4df7919a034340570da556009c7adc.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/dc441bc5b6ed5a96dc547d6c605de1a7bb4dfd1adf9ff30e879563ab4f969eca.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/dc78b459d6b03cea125a920035c36be0d8b233aa1ceb41a1cc83763bb0279af7.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/dd08e0c1521463c77bd27adf933a7658915edd7259ed3efde3fe30e087c8e1b5.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/dd10998dfddec51bca751e72f1a720351bf4d152765f4cd35550ea6ec06df6ff.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/de0c44f2c74038c772d98af4ee0a33cdd823afe8902e58252962b820f9b9757c.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/de7c84c9033da6e481d23d0ce2ebe57e961dfef249ead955115f2f0902920f22.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/dec31b46e11a9f81194610f56f6a7f4652a3c136b822557aeb5ef01936b55a30.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/df16ec83fb9eb0e85b50d14871396cecb09cf53e9f94a8e4826a8090dc990c9a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/df1d37f495aa2f6c4c2527e7ca4b7fd33c287dd4a09f57721b6b07ee5e72a660.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/df222aed329f10d20ab6f983f171f9833c6867f6c967286cf3863bfd502ecbf9.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/df33e41cc25298e3138896f673c13ffb360f6254097b6bcbe31c12a9a38aefc4.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/df4db1dde5ab6f1e3a262fe851ecd40a1f4aa6a93085e5c882ea3cba40cd1896.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/dfb04dadc45c6048c6b8f7e75c59ebf05cc24f10c4090327549a4020d174a2aa.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e03d556f386a1f594881dcad1115faf6d6e06838c8cd54c6b5b9702a2b49ea33.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e0447f1463ba210637225bde0264ddb7ebc18f94cdb313c18ef6dd9842b1a14d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e0e1835014035eecaf4d121d38f2144102e9411baf424d0025c5a9d3582104c5.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e174e5fb935250a13756f68760d25652cbeaf7afbe7707ec76c7b8a0dfbc9d48.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e18ad5087675d4be0dc8e8937c4024ef8f90ac9ff089f5f802b8ca30392db996.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e1b86fad82f996fca5b9d5706ba9add209aa1f1ddca245da87477987de718775.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e26b003546916927e42dc730d4c114768b6878151fbc2144bb5ece71170981d7.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e2a8db21faf2726f78ea5249e6a539f70d3905e00c3997208603f93cbea506df.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e2beac5d4a2b4bff494f2cd75c9ba59805d011a41e7733828d5035132178f856.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e2e1adab58e3c7f0d03cde27e6edfac95f6d92e4d36c5b50819a4906ca7d1c99.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e2ead293e751d780944791d1e08f66b82b7c0342d3e473ac24f5e745cb6d803b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e3738f240a30cf19fb3e8d057c66c6d1f2a74a8abb52aa784666d53f1ed9ce75.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e3920b0216b0f1e57544696f42f0170229ec34179c368ec3eb266c856d5c72cb.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e3cc6443669217d57512a2762d43edf044034b09c7d3120ccf1d296a9db4713d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e4f3f27b60d9c2be6806dca136b3995aaeedd14763f740d480467791ec01c52e.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e5a327d02f790875fedf1a875c1f78912ac319bd6b81e33bce63fc2790111df1.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e6003be2d81f08d882f3481ead985cb97b893ba6412ae2ccdbc9bddd7eacb9cb.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e600f8c83e6d7cb4bb9b0f72be9c4338c52889889ba833ffa3a17b1226863d57.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e60889bb52d250a0572cc40de109558275be6038f6d9ae6ae95df2a8a1872aa9.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e64827743ff69b950448c1e8707145a19f3c92fffb1c2bed475d8199e274d043.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e69f178b853201b55a78e09199f367f0db8483e855bd382ab0f6ea4bfa844732.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e78849d6e9d04ce8158775767d8a87a534ed0fc513900476767e3c74496a3f6d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e80d594191ac1136eceb7a3590b451cf410bac0616194ffb5f49c75be9aebc3d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/e9c46c72d9c64d756ac91f0fa8cfad9c547e16a3737791c26683b377259a2f0f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/eac6cfe0b885683f387930a18ca85db8e55c3bcef83178e255955ab60a90d237.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/eaf7a9bd0f032829e8b5d1054d34bac19c9ec0303d6439f68c80ffda20ece997.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/eb288e0bed6dcf63413762e3ac0f4632800297ba3958fddd53f49c8dd29f99d1.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/eb2a0f049e9c4f5f0e71d19093f289d328e9a575ea93e7b63efab7f0c0b6e367.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/ec8af3e32106325d839cbcb893989ef32179587d27e206e436783a8e9a692197.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/eca0a97efe2a61fde372b1d3d506b3b7f86678693174d2765ac61d671813e843.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/ecb0664517ff2d56dceb6b1fee3716566f0f8ca675c850d66d826a3f2c7cf764.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/ed555503112b65c7f2c0c11d0ac25559d2f8dc491d4db4cf49f70410d96b0e81.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/ed64db594e4b32ad643a1af1dcb67a010c49bbb1443933dd361e4a34098466a3.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/ed8247d8525349551accacaf24dc74c42c582063108a517ceeae951f7aea26d7.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/edabdb3f5267f4760df58e9386d7cf0eeaf42ff8dd2a089a84595a00daa52fd3.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/ee7090beeb1ede7a8c0ebc65fc3a78f7f7f47195deb767cc6b17539a7bd73a2d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/eeaf9c82efd9905c7922aa0a08f3fac6d7d746443038797b99608d0f3bb3b9e7.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/eeb8492142c16532df758c06143a7450f078b549077c62cc1e56b46aa1746fe3.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/eed55d42eddb6c2758e9b5d8da54e391a5ccd3277169063c2481f4a6157d8fe6.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/eee62e6d230aa7c2c7b5bd71fe2c674448f42ea8e9d13760c751902bbb9281eb.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/ef926c25687999dc73557dde7a0971067b5dab16bb21d9e49e4c6c5e3e2677ec.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f057106da98b6e306b4ffa33cf4be0eba70de57d76e5ef1ec6235a80913c88b6.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f1d45ef421d02823551490094f5256f488855783e4ae4788155e829de5ac49ca.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f1d7eed81b3b8abed9e5715f5686126d8c1e48bb4da2d18ea93af16b5bfd0cb6.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f1f1c0017cc5e7b8196a70b489ad0f8e4c81c52d221fbad9c7e502230f4e0946.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f221a3ed7d458d78373e74e4262df835ccf88b440e36ab16a45191725a65a450.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f29594d62ae82032fd3910163c275dfa0a92c37921b29b0eb285f5fe5a037fe5.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f2b2d0ec05dda3ba3a2e7056439dea4ce7e5b012adc19e927ace5283b5bc8e90.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f335435ba9d71a7d7fd13c7b41cdcdfba9574dd5879dfa0234005ccfac7a2d5d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f34688217bb21ec69c568a52bd59181c4b9d07b91ab35ddfdcaf65c881cb47f6.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f38c82a0dad6e1325557fa709ee3276a8decca2f936ac9ca228872dc9a0b3b7a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f3ecc99986a4a32b0c2a2bb84049a3d5cc02158f8b561c1cd46458e0c8500b2b.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f4460e0dae66d74ef359783cf42aec1eb9a6bfc24eebfaaab3bff5e871ef7384.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f4a47df5a8006454e9a5adbefaa80f69859f15bb0a902dce546e8388c073fabe.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f4fece1f5a2289b26fb418c3b76d0556f7800e795d1007f429be96ad5753bc65.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f5196530a90509edc79375d9c9750353f00b6742a6829a1d7ba0eaec8d50164d.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f56fdc76593905e95e0449ad0d22f2d7bb0d144ef8b7f6dba0681c4731f2bb27.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f594d6dbc64b9ac2949990b76f2de342e1e57f9bd49f28bdb2347deccb322d47.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f5d8699e5bcbd2af79d8874cb83da5e0d99b9826544ec5e1f3a8c6bb74d3f258.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f6a59e893fc00f3b65946d4a041ca8d801c82da3be9da2122b66417efe572c75.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f6e725766a210e0b0b0c960c10ff3223cd173674ef9dec926dfe96b32145ab71.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f6ee5a386999cd0d13c93b5515c5ad7ddef95bd39f17268effba456f165bf27c.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f711edaef9c428c0527b078333356230a07043e7b1f02270225cd35efed106d7.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f7430f80b0d98490522f5bb4b3b6e217f08743cfe2998072d33b895e81ec92b3.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f75497352dd657524380207b9324c33dff5835dac633cea8a38366b2203e5dd7.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f7a7bf06366c539f0b169de72c4dbc29ba6f36d1cb05363909a075a83a6b019c.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f7cdbc47ea6bc80382c0288c4ccd997c15039108be17ad7fa080ee5bf2e1cf83.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f84288f67e54a4a1474be17a7a87d3cb3904f11d729970abedc1f073f22dbf6a.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f873ddddbba040542010959fac2f036fe15cc83359137aa02814a4c42e516f69.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f8fef2cfe2c272b068373cea67d8aeb3be1355c30f1000522036c38aa3bd94bf.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f9597a78e5578bd04f633d829e0ed7bef261e8f975b33c906c887eb5d0148318.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/f9a1af2cf2fca5fbc9a82b0cdc91e47f1597085fa43ea40633f3f853ff54950c.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/fa0de7682996eeece6dfb2a29eb3100d9cb4f81461b749ca485880fb9e6b5bb1.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/fa706219d7bff83b1008b6511f5a22abca488ba378291fdeb27e8d2861f8c368.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/faa65bf813e0d4e52063d5e46fec00df3c8e3afc1950dcb76760cdfd21dc9c71.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/fadc6bbbd4d3726b7ca3cbccb1b10a4ca8e8a93215363eaebcef36697c09fcbe.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/fb1ea75b4f2ad694010a064ae9e9531888f658032c5480ac65251d441bd3e64c.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/fb43b85f77a4eae554ae137fbef8848fa527e28676211070ba91c65038c12168.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/fca1a91abf9ec234eaaa8af2ad119ead6553ca37baac0750d04b0c688385238f.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/fdbd16d258f1c7b29972485d677b800d476ee8a6a637bc4b46c29829713f3272.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/fe043120ed75a0da6f02ddeb1e6f39cbe7b67d5ddea6daae4a7f51833de591e4.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/fe27445a8bd9c4d04402cf40e320c47d01f362bae1e3b75d6eef0cc4752307f4.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/fea8e7283c860ee5cc6725883e09aa2be4c0cf02e828f479e9f5794692f18370.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/fee39aeec8955652b961269926e88946df3f9c916d42e05324148100db4d2e61.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/ff2248a39d24b7b7d130f30d75b1ece0ce6fe6472b5351dd2fad294e031b7525.json`
- `hyperframes/graphify-out/cache/ast/v0.8.40/ffa041a085d8eceaae39e061bc7ed0ebd4a031a5ccd0de0ecbd9f103f48e867a.json`
- `hyperframes/graphify-out/cache/stat-index.json`
- `hyperframes/graphify-out/graph.html`
- `hyperframes/graphify-out/graph.json`

### `skill.json` (5)

- `background-generation/skill.json`
- `edu-video/skill.json`
- `hyperframes/skill.json`
- `manim-video/skill.json`
- `talking-head/skill.json`

### By extension

| Extension | Count | Typical role |
|---|---:|---|
| `.json` | 1245 | Configs, DNA, catalogs, samples, graphify |
| `.md` | 298 | Docs / SKILL / references / rules |
| `.html` | 131 | Templates, presets, compositions, demos |
| `.mjs` | 69 | ESM utility scripts |
| `.tsx` | 22 | React/TSX samples in motion-graphics |
| `.cjs` | 18 | CJS utility scripts |
| `(no-ext)` | 16 | See file list |
| `.sh` | 10 | Shell helpers |
| `.ts` | 6 | TypeScript helpers |
| `.avif` | 5 | Image assets |
| `.py` | 5 | Python media helpers |
| `.js` | 4 | See file list |
| `.svg` | 2 | Vector assets |
| `.woff2` | 2 | Fonts |
| `.txt` | 1 | See file list |

## 2.4 Complete directory list (Skills)

- `.` (root)
- `background-generation/`
- `edu-video/`
- `edu-video/references/`
- `edu-video/templates/`
- `edu-video/templates/horizontal/`
- `edu-video/templates/horizontal/assets/`
- `edu-video/templates/horizontal/assets/fonts/`
- `edu-video/templates/horizontal/compositions/`
- `edu-video/templates/horizontal/compositions/sections/`
- `edu-video/templates/horizontal/lib/`
- `edu-video/templates/vertical/`
- `edu-video/templates/vertical/assets/`
- `edu-video/templates/vertical/assets/fonts/`
- `edu-video/templates/vertical/compositions/`
- `edu-video/templates/vertical/compositions/sections/`
- `graphify-out/`
- `graphify-out/cache/`
- `graphify-out/cache/ast/`
- `graphify-out/cache/ast/v0.8.40/`
- `hyperframes/`
- `hyperframes/embedded-captions/`
- `hyperframes/embedded-captions/assets/`
- `hyperframes/embedded-captions/assets/brand/`
- `hyperframes/embedded-captions/assets/fonts/`
- `hyperframes/embedded-captions/assets/strokefonts/`
- `hyperframes/embedded-captions/dna/`
- `hyperframes/embedded-captions/modes/`
- `hyperframes/embedded-captions/modes/cinematic/`
- `hyperframes/embedded-captions/modes/cinematic/_archive/`
- `hyperframes/embedded-captions/modes/cinematic/_archive/champion/`
- `hyperframes/embedded-captions/modes/cinematic/_archive/memory-wall/`
- `hyperframes/embedded-captions/modes/cinematic/_archive/portrait-header/`
- `hyperframes/embedded-captions/modes/cinematic/cinematic-cream/`
- `hyperframes/embedded-captions/modes/standard/`
- `hyperframes/embedded-captions/modes/standard/fonts/`
- `hyperframes/embedded-captions/references/`
- `hyperframes/embedded-captions/references/example-renders/`
- `hyperframes/embedded-captions/scripts/`
- `hyperframes/embedded-captions/themes/`
- `hyperframes/faceless-explainer/`
- `hyperframes/faceless-explainer/references/`
- `hyperframes/faceless-explainer/scripts/`
- `hyperframes/faceless-explainer/scripts/lib/`
- `hyperframes/faceless-explainer/sub-agents/`
- `hyperframes/general-video/`
- `hyperframes/graphify-out/`
- `hyperframes/graphify-out/cache/`
- `hyperframes/graphify-out/cache/ast/`
- `hyperframes/graphify-out/cache/ast/v0.8.40/`
- `hyperframes/hyperframes-animation/`
- `hyperframes/hyperframes-animation/adapters/`
- `hyperframes/hyperframes-animation/blueprints/`
- `hyperframes/hyperframes-animation/examples/`
- `hyperframes/hyperframes-animation/examples/assets/`
- `hyperframes/hyperframes-animation/examples/assets/avatars/`
- `hyperframes/hyperframes-animation/examples/assets/brands/`
- `hyperframes/hyperframes-animation/rules/`
- `hyperframes/hyperframes-animation/scripts/`
- `hyperframes/hyperframes-animation/transitions/`
- `hyperframes/hyperframes-cli/`
- `hyperframes/hyperframes-cli/references/`
- `hyperframes/hyperframes-core/`
- `hyperframes/hyperframes-core/references/`
- `hyperframes/hyperframes-creative/`
- `hyperframes/hyperframes-creative/frame-presets/`
- `hyperframes/hyperframes-creative/frame-presets/biennale-yellow/`
- `hyperframes/hyperframes-creative/frame-presets/blockframe/`
- `hyperframes/hyperframes-creative/frame-presets/blue-professional/`
- `hyperframes/hyperframes-creative/frame-presets/bold-poster/`
- `hyperframes/hyperframes-creative/frame-presets/broadside/`
- `hyperframes/hyperframes-creative/frame-presets/capsule/`
- `hyperframes/hyperframes-creative/frame-presets/cartesian/`
- `hyperframes/hyperframes-creative/frame-presets/claude/`
- `hyperframes/hyperframes-creative/frame-presets/cobalt-grid/`
- `hyperframes/hyperframes-creative/frame-presets/coral/`
- `hyperframes/hyperframes-creative/frame-presets/creative-mode/`
- `hyperframes/hyperframes-creative/frame-presets/daisy-days/`
- `hyperframes/hyperframes-creative/frame-presets/editorial-forest/`
- `hyperframes/hyperframes-creative/palettes/`
- `hyperframes/hyperframes-creative/references/`
- `hyperframes/hyperframes-creative/scripts/`
- `hyperframes/hyperframes-creative/templates/`
- `hyperframes/hyperframes-media/`
- `hyperframes/hyperframes-media/assets/`
- `hyperframes/hyperframes-media/assets/sfx/`
- `hyperframes/hyperframes-media/references/`
- `hyperframes/hyperframes-media/references/captions/`
- `hyperframes/hyperframes-media/scripts/`
- `hyperframes/hyperframes-media/scripts/lib/`
- `hyperframes/hyperframes-registry/`
- `hyperframes/hyperframes-registry/examples/`
- `hyperframes/hyperframes-registry/references/`
- `hyperframes/media-use/`
- `hyperframes/media-use/scripts/`
- `hyperframes/media-use/scripts/lib/`
- `hyperframes/motion-graphics/`
- `hyperframes/motion-graphics/agents/`
- `hyperframes/motion-graphics/categories/`
- `hyperframes/motion-graphics/categories/asset-fusion/`
- `hyperframes/motion-graphics/categories/charts/`
- `hyperframes/motion-graphics/categories/kinetic-type/`
- `hyperframes/motion-graphics/categories/logo-reveal/`
- `hyperframes/motion-graphics/categories/lower-thirds/`
- `hyperframes/motion-graphics/categories/maps/`
- `hyperframes/motion-graphics/categories/news/`
- `hyperframes/motion-graphics/categories/stat/`
- `hyperframes/motion-graphics/categories/tweet/`
- `hyperframes/motion-graphics/categories/webpage/`
- `hyperframes/motion-graphics/grounding/`
- `hyperframes/motion-graphics/phases/`
- `hyperframes/motion-graphics/phases/source/`
- `hyperframes/motion-graphics/references/`
- `hyperframes/motion-graphics/samples/`
- `hyperframes/motion-graphics/samples/asset-fusion/`
- `hyperframes/music-to-video/`
- `hyperframes/music-to-video/references/`
- `hyperframes/music-to-video/references/motion-primitives/`
- `hyperframes/music-to-video/references/motion-primitives/3d-card-flip/`
- `hyperframes/music-to-video/references/motion-primitives/assets/`
- `hyperframes/music-to-video/references/motion-primitives/bg-flow-field/`
- `hyperframes/music-to-video/references/motion-primitives/binary-decrypt/`
- `hyperframes/music-to-video/references/motion-primitives/blur-resolve/`
- `hyperframes/music-to-video/references/motion-primitives/braam-punch/`
- `hyperframes/music-to-video/references/motion-primitives/chromatic-split/`
- `hyperframes/music-to-video/references/motion-primitives/chrome-sweep/`
- `hyperframes/music-to-video/references/motion-primitives/counting-punch/`
- `hyperframes/music-to-video/references/motion-primitives/crash-zoom-in/`
- `hyperframes/music-to-video/references/motion-primitives/datamosh-smear/`
- `hyperframes/music-to-video/references/motion-primitives/directional-fill/`
- `hyperframes/music-to-video/references/motion-primitives/dolly-zoom/`
- `hyperframes/music-to-video/references/motion-primitives/electric-arc/`
- `hyperframes/music-to-video/references/motion-primitives/flash-cut/`
- `hyperframes/music-to-video/references/motion-primitives/gooey-metaball/`
- `hyperframes/music-to-video/references/motion-primitives/hard-cut/`
- `hyperframes/music-to-video/references/motion-primitives/hypercut-whip/`
- `hyperframes/music-to-video/references/motion-primitives/iris-open/`
- `hyperframes/music-to-video/references/motion-primitives/kinetic-letter-in/`
- `hyperframes/music-to-video/references/motion-primitives/liquid-morph/`
- `hyperframes/music-to-video/references/motion-primitives/mask-reveal/`
- `hyperframes/music-to-video/references/motion-primitives/mosaic-pack/`
- `hyperframes/music-to-video/references/motion-primitives/neon-flicker/`
- `hyperframes/music-to-video/references/motion-primitives/outline-to-fill/`
- `hyperframes/music-to-video/references/motion-primitives/palette-flip/`
- `hyperframes/music-to-video/references/motion-primitives/particle-burst/`
- `hyperframes/music-to-video/references/motion-primitives/pixel-dissolve/`
- `hyperframes/music-to-video/references/motion-primitives/radial-burst-lines/`
- `hyperframes/music-to-video/references/motion-primitives/screen-shake/`
- `hyperframes/music-to-video/references/motion-primitives/slot-machine-reveal/`
- `hyperframes/music-to-video/references/motion-primitives/spotlight-sweep/`
- `hyperframes/music-to-video/references/motion-primitives/staggered-exit/`
- `hyperframes/music-to-video/references/motion-primitives/text-spectral-rays/`
- `hyperframes/music-to-video/references/motion-primitives/text-wave-distort/`
- `hyperframes/music-to-video/references/motion-primitives/tile-mosaic/`
- `hyperframes/music-to-video/references/motion-primitives/typewriter-reveal/`
- `hyperframes/music-to-video/references/motion-primitives/word-grid-burst/`
- `hyperframes/music-to-video/references/templates/`
- `hyperframes/music-to-video/references/templates/card-flyby/`
- `hyperframes/music-to-video/references/templates/held-message-living-field/`
- `hyperframes/music-to-video/references/templates/held-text-strobe-burst/`
- `hyperframes/music-to-video/references/templates/intro-kinetic-cascade/`
- `hyperframes/music-to-video/references/templates/logo-split-lockup-pulse/`
- `hyperframes/music-to-video/references/templates/poster-tile-mosaic/`
- `hyperframes/music-to-video/references/templates/roll-flipbook-word-cycle/`
- `hyperframes/music-to-video/references/templates/split-anchor-word-slot/`
- `hyperframes/music-to-video/references/templates/typewriter-phrase-keyword-shuffle/`
- `hyperframes/music-to-video/scripts/`
- `hyperframes/music-to-video/scripts/lib/`
- `hyperframes/music-to-video/sub-agents/`
- `hyperframes/pr-to-video/`
- `hyperframes/pr-to-video/references/`
- `hyperframes/pr-to-video/scripts/`
- `hyperframes/pr-to-video/scripts/lib/`
- `hyperframes/pr-to-video/sub-agents/`
- `hyperframes/product-launch-video/`
- `hyperframes/product-launch-video/references/`
- `hyperframes/product-launch-video/scripts/`
- `hyperframes/product-launch-video/scripts/lib/`
- `hyperframes/product-launch-video/sub-agents/`
- `hyperframes/remotion-to-hyperframes/`
- `hyperframes/remotion-to-hyperframes/assets/`
- `hyperframes/remotion-to-hyperframes/assets/test-corpus/`
- `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-1-title-card/`
- `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-1-title-card/hf-src/`
- `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-1-title-card/remotion-src/`
- `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-1-title-card/remotion-src/src/`
- `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-2-multi-scene/`
- `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-2-multi-scene/hf-src/`
- `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-2-multi-scene/remotion-src/`
- `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-2-multi-scene/remotion-src/src/`
- `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/`
- `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/hf-src/`
- `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/remotion-src/`
- `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/remotion-src/src/`
- `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/remotion-src/src/components/`
- `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/remotion-src/src/scenes/`
- `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-4-escape-hatch/`
- `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-4-escape-hatch/cases/`
- `hyperframes/remotion-to-hyperframes/references/`
- `hyperframes/remotion-to-hyperframes/scripts/`
- `hyperframes/remotion-to-hyperframes/scripts/tests/`
- `hyperframes/remotion-to-hyperframes/scripts/tests/fixtures/`
- `hyperframes/slideshow/`
- `hyperframes/slideshow/references/`
- `hyperframes/talking-head-recut/`
- `hyperframes/talking-head-recut/assets/`
- `hyperframes/talking-head-recut/assets/vendor/`
- `hyperframes/talking-head-recut/references/`
- `hyperframes/talking-head-recut/references/frames/`
- `hyperframes/talking-head-recut/references/layouts/`
- `hyperframes/talking-head-recut/references/styles/`
- `hyperframes/website-to-video/`
- `hyperframes/website-to-video/assets/`
- `hyperframes/website-to-video/assets/sfx/`
- `hyperframes/website-to-video/references/`
- `hyperframes/website-to-video/scripts/`
- `manim-video/`
- `manim-video/references/`
- `manim-video/scripts/`
- `talking-head/`
- `talking-head/assets/`
- `talking-head/assets/vendor/`
- `talking-head/references/`
- `talking-head/references/styles/`

## 2.5 Complete file list with roles (Skills)

| Path | What it does |
|---|---|
| `.DS_Store` | macOS folder metadata (ignore). |
| `AGENT.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `background-generation/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `background-generation/skill.json` | Manifest: tools, baseTools, hooks, phases for the harness loader. |
| `edu-video/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `edu-video/references/edit-requests.md` | Reference/rule doc for agents (progressive disclosure). |
| `edu-video/skill.json` | Manifest: tools, baseTools, hooks, phases for the harness loader. |
| `edu-video/templates/horizontal/assets/.gitkeep` | Git ignore / keep placeholder. |
| `edu-video/templates/horizontal/assets/fonts/NotoSansKannada-Bold.woff2` | Binary/media asset (font/image/audio) bundled with the skill. |
| `edu-video/templates/horizontal/compositions/captions-overlay.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `edu-video/templates/horizontal/compositions/mode-a.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `edu-video/templates/horizontal/compositions/mode-c.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `edu-video/templates/horizontal/compositions/sections/.gitkeep` | Git ignore / keep placeholder. |
| `edu-video/templates/horizontal/hyperframes.json` | Layout/composition config JSON. |
| `edu-video/templates/horizontal/index-root.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `edu-video/templates/horizontal/lib/liquid-glass.iife.js` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `edu-video/templates/vertical/assets/.gitkeep` | Git ignore / keep placeholder. |
| `edu-video/templates/vertical/assets/fonts/NotoSansKannada-Bold.woff2` | Binary/media asset (font/image/audio) bundled with the skill. |
| `edu-video/templates/vertical/compositions/captions-overlay.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `edu-video/templates/vertical/compositions/mode-a.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `edu-video/templates/vertical/compositions/mode-c.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `edu-video/templates/vertical/compositions/sections/.gitkeep` | Git ignore / keep placeholder. |
| `edu-video/templates/vertical/hyperframes.json` | Layout/composition config JSON. |
| `edu-video/templates/vertical/index-root.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `graphify-out/.graphify_labels.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/.graphify_root` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/GRAPH_REPORT.md` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/005868f990d20d796fb834457dfa315cb785d9fb460922d71553a397900bd11e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/010bae2eca17e8115036f667327bd70a10f35e684e59fea3dc8963e2456d7c06.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/0258c7dd8fadc004d46727fb231331cb6713949b0b4caa98a3c7c1cc45716afb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/02f50a70b974fb39ea54392fb4fb44fab6f6b6d7e836bc5b0f8fdd5156b05b58.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/040f31c4ebc9654b6cccf948e3d94ce6630f8973e993ab3bf1f58b48cef24714.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/047675fc429e1805022cbf43fb9dd92a331134693bb20ecf30578834d50a1007.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/04b18dd88ecdc5ae0b3d8e41dffd1fbe139326c61ad82f0141bee220f1c38d92.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/0527936ca3a15cb0ef12b25cde9ff41eca4a251e382e42ee0f760ea75adc62b6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/060c0f14d6a2d13c1f6f8be07ce074ff3ebd42000afe72ad3254a3765ec6cefe.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/06282c23f5f7a43f95c7582eefa853a95033dc068775ee88de0c9e771f2f98c5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/068f8532376fecb641da7b0246d6a51d0f6c6cc7c7c2e86383c0f3a3b2b0e439.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/0755b6ba6dfc8700cac680c76c255d34c90f4a8647c90a709d4cff865e976604.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/079fbabdadc525c3dcc44bff025f3491e6c2036757bed4b9289d37c1cb3eda5d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/080c3fba45e44c5f8cb31581efa05e435a92653310275c90e294ca4ba38bd10d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/094f0bafb8ae362d4f89cabc845bc1324f1de262455a5da962dd250938729240.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/0add325653f4bc752631c30540a2ffceb453461b2f4dbc6ee0c122492a99737d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/0b0e268344bbb65c8d99b88c7c8385ee3c98592b22d45643c630a800cb7e6089.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/0b64d203ac73acc1d03143f1a36bd86df744cbb0e93027bc11da1fec6b2d078b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/0c42ac0ae82304a626f457ea2fc09902f39a77bd21c2a322672101cf1767a348.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/0c60bac0cb7f7fb65bfcbc224a437a03c6e41f53ef9dc22992f7a9b40010c982.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/0e628260d42588bb0b7a5e03a5b7d6a9a48ca6773de25ac78c649fa1d9a6110d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/0e7f00d5e14000963cd62f224414d28aeda683c91d0d4ca66252594a0b272f90.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/1023d615fb77246e3d71fbfaa95f161c1df42e5190b4f6de75a546f5be7f79d6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/109e98985e91347207b57ea2e0e6f0e90a6574d470d6966a5aa045c0f626c08d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/121d0a16c304f71588306908a4a44905c31b305252f173b03373524ab9449cd7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/1249f5385ba4adf5e72d61494bfa3c68a0bdbb76e935e8fc136c4acba291caf5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/1278094427c257fcab07245f1b764d6c93b09f9b5938d82f2b89790c3cf5e553.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/12e7f66b8e5ffde6bd9bda1c3b92218c4af3d1215f921de0dcedf0e3dd478a20.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/13f7b6e52d251975c23d04646b999f774a7a02b5edbec96424e61ab5c46c978d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/156638dbcb2adfcf56f8657b368abb952895f9789e76728ba324df2345a66e00.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/175b8dd82ceea599c270894be831aa205acc07e6a9f8a44b17e40684986581aa.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/17ea27af9bf30266982bd895013659f38ae957f0a86fc2b2d4d5f51694907131.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/1bf603acb628c719480a896f2f9de4b44ce6777b223b7f9bad137add88a15074.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/1bf67e63383a1e02560f269ae6d124be09600497470909c3e8aafd2e74668897.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/1c6ad14d2dbff8a2b8d451a43c7174fd677bb9d4f0444eb3dd45990456507aa3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/1c94b8eb50ac4e8899c43c7a897d5e189e52246c2d966c035de1b15e95d02122.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/1ce23bade69c90ef74e5d2a432153b02e02d0555876d275a904d13d868c174f1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/1d77bd81d06b12700a029d6d1d4f0a2272c070db27adb6c8450c79221f3d4488.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/1e74093834ec55d9918bba44a423b751bc711141ab40274f3292ca74d2977985.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/1f65282132c8328e841a935c91a53b06b31aadc06e1d81818b3b2ff30c4b978a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/1f9dbe906a5718c95df107d2bf7b343f0bcb41678d59fc208e0de323d44e07d2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/1fb57a9ae1718ab6900b3dc3fef7b5c70f07f4f371b18c1287cfb06325f26d9d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/1fc271b331e9fdc545f6c1a33c3147415a84ebcacf1d0388fe977cef45fb0b77.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/1fd36f524253a98f2c49f780253be5855dd8ee018113b516f661f844a9dada9b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/203cabda82b4476d14c93a7a684482a265e820e3268184e17e193005d970ace1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/207237ba0edfe467917c1db342afdb2906e87c5157b534d05b315279da9340e2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/21396ec979a12fb850092f6b5a514141fe02ee82b740d1dcf987948c69cf544a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/214e2bc538765e627e780a9cbb24482ac8ffe8ca5bd960cac2d974218cd653b4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/216592249b7822148a2ba88f3a0fba6f276ed795cc89342bb17c7db07ad14ff8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/23124981ef0ada0e9d9e0b760c5d3720091d9f2120e032acb5a2defd128c603c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/23ab44e7bc0ef891250912e35fbb1184851c194a81ba3ba8a7c3525677afbc45.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/24a02395ee0ae6e4b1250ec5dc69f657785bdfc5460437bff5ebb53f1e44e7ee.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/24dc73046af2fe9f9f78d98fe514ded4fbfbe7e6afb8ec19719baa6b7078bc9d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/24fa19ca9dd42969ade39aa800959311ad8ad6b4a2e4fdc961c3d0ac5b77f70c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/251cf4dfcfc05f9c28ecf79bf40e68ce1035c565bb55b8368066bc2a9b4e99fa.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/25d0666f2aeb15194078d28c0d63a21a3cc734c2cb89f10c936affb808334b12.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/268265b50b8a5d49cdb8a408da7b633b8afbee5fa2d959da764279bcf6d96f2e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/26bb0ea52cb4b46dde1a2d1f67f99bae40c59955082685a76ed9822211f238ae.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/26cc1827f381b6e705c7ff03d72c0717ef521a54ac31f1bfb7a5c6a33fc2afe2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/26e8d4d014e89d372424fe93d08496f2e72407a3d1b967b56f06257da6d055d1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/275a8d3334cb9e5ee9f190c1553beaff36d33ae12f1678eceafd0c396358f235.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/289dc7adf9be644284f48d7942a74e6cb938d6faec375f07dc07c7e7f95ce507.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/29a07677477f430dcb575aed8ddaa354624aeb8de2f3fc3422d9dd8b9b77bed0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/2a3a2306a422fa00e08e8cf42218abe347fc7b99429f06f5fa90ab1c6b07cd91.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/2b8007d7d2486aa689729bf7111bd4a187347756d7981a364ad7f3af525ed5b8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/2c075eb0602cdac4a1a26e24d0bfd2cbeb23981c34d8b09641e564e89b27a0f9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/2d3a3626e8839a766263ce9c131ad0e1774669a41bac12e3436299da2d93796a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/2e5b056da5b6b92b92f406abfb8f4b8885a09a0326de2337fd475eb639e0cdec.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/2ecb953811efa832e5505a29ec0e612587ecba5d1bef133a125b4a39b9681d28.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/2ecd019277f01c941aa881906ef175626b1fcf8e341b43cd09abe2f80d70b7d5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/2f33c4ef2834791c7671657f92b024dfc646ea22f22a0dd137f4ae9cd411a624.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/30f8ea6a932f5f77361e63aafea0489a8c8ee93559bb6a925addc54465d7eee0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/32435de9674865d5732c7c0b9976ada019a8d211c2dee5d0df7a6092590d63ff.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/328283fcc7cd632db6922d863959e46f8fe8f534236ac40d6e904d6b946e9fa3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/33321d755c73ccb38eb0791000763937d4cdc58c37335e9cb3e1def158409a28.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/3371a2905230a51bd9bfec91f35c40dd60a6d11b411f3ad9a19baa0c5d2a9307.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/3376f28226e3b2255baf06fd2c5e931dee8836ac3cec88bbd13d52c3fb3c75ea.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/34b558be4ce24e286a7d8c39c1655f41a32542402525a94260b7398a6158e0e3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/35560801a1b2e365e53071324c001bf1b3bb1d6204404074d50d48ce9587ad26.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/35baa321ed2768c48be467db3c5966d977346e0bc789700f3665647140bd1cad.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/35c071891803274bfba3529cfe491cb0514d30966ec1dd688eb9386dd3b4f2f8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/3734bfbc0e1f697deb8660ad86207dcdce77cb2376ec258487729abc080f5bba.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/375824d7da7ad42b0f035a5e18bebcdde5b9fe635bffb88f5221d3e4c4cb5748.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/379ac71d1041de5870eed4e632aa21a5495fd2c13d52ce7ed5f558a0b59f3100.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/37c8ca6b87587e820158ffa0d2bcbb0d4edacfbc2e4888aab3dfcc6dadc3983c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/37ca1a8067b3056980320459df09622d9836f16ec866090ee11e12c9841e1300.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/37cb4352a2d1c384a40c3ff8e2b5c1ba2b2c57521cd362323ce0e218a530b684.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/3897c0e07be95585bf0587522c392333d54c4a2949139369a1ed4e254373f838.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/39455860a8f3245a933396750fd0eb1e7e40324db40c36db008de19aaa336f52.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/39566eb73c1514d24882e95c2347d64086fd71849c779d7f5238ee1a69f68c42.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/39eb580a098b9fbc76b06d3a58a32306470977deeccc9980524e83f078a167f5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/3b0ed844e0d787da28559af21abc27ec034aae1c23e6acc1f343acf225e5898b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/3bfff7e3538c15d81c2f94758e933e53968b4f290bf091a4deb6163645d99525.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/3d8150312e7181662a947f818c45f1caecabda5b1d12e5e74001f4833d677f15.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/3e1066a3a60d501f16b08b5a4aac0068809dd577154adefb4be57f79ac9573b8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/3f875a650a6e7fe47c25b0f84c8465d625ce9b5162f94436b81e7d38e2ac7441.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/406ae521729c44a66e5b7a5391c408126e91ace45a4181dc4e2358348218155a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/413fe37b361ed616ae9e4fb2b46803b5a177628bc6486e6c4120f9490a10d9a7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/416167821ca88c3202ac306276ac7670f8e538c3b9f4382f654e2649969c9800.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/427a3efb8e6ac35801cea5bd1498459a06be3fb4b4356100a91fda12c5db24dd.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/42c8d77bcdd083d1007a6ced9414faf9c630aabfedcd2ff63e4583112be6bc5d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/440196e5d9a21dd60cd8a0ac17ecd82753c583d72111885c12798fa07fd42e13.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/459b89690752c5d23427a4369e4efd1708a8a30c1a119b7f1837053df5d1cab4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/45fdd66caa64092b20da5840745c7fbde2dedd4b216dee66facc3a090b4eef9f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/46aa2e0d8dfb1a23f6ec50e28060c197be3071bbb2ad281ea98107b4a8a3d46e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/46d232cb947bb7aa2ff5a2ea90194b31b5640121c3df61e5c0084b108e7168f9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/470f3990debdba1d546f13da5ca14ce938a99ae67ae913d346e137c09e05cd8c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/474bd83b1d585ec1729706f84b4117af7c1ccfbd868949d30291b3c84f02bc75.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/48786b4fd4d58222d2cf84c5d9869bcd6ab27abbb877ae86756e9f8d84280819.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/48b346210d7306762fda1588976f77884db6675aedf029a55d8f1a35dcbb21e4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/493b1caebbb1f06950c975d37601e899ae91de6bc39967047956bbf39c06db8b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/49be99efd90b5ad2a70f712928f8294e177742362639a32fd136cd5c2ca17fec.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/49e7c1c5b88f0e78def805392eb7dfbd1220f589adb245dcbd4581470ac78e6f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/49fdfb00f7726b2b8e39d3cc69dcc8004a83ee2ee61fc67c5034470e6b6020b6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/4b49c7071661191e56c20395c97e2882956bd196ec07a22e8b6dc5d2363d2a3c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/4bbcddd33f6a1338721b14b369aba96e7f60e974e0b545d0033ba0e1f2255049.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/4d77b083b7e9d91dbf3808b2adc5a7840d1cb8e966063d6ac32315490aec9660.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/4dd719fff309ffc706057f5802d907ffd5ae86413de50971cbd3f91cc4196223.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/4f8ea592ae86fe765f7e579fbfcf83b24958673fd31118a4fd8e178a8b8fb9c2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/5087b626556ad5909ed4068ad82f9800b69588c4b900c75e4ce65072761363ae.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/50be7201db9d586f67d56841275bc2fc3f233db986a18627552b6439b578bc49.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/51493d175ac54a912689688cba625c6af7eeffa528b7799a6f96729f17d9c73c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/5156dd15f4b8cfbe4ef2bb4745f433c050c9877920de5073c34b3aad421cd71e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/516b6062abd721897a3417ab357c00b2216a8b6b541014d1ecab223da4c20f29.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/51a1ff3ea491d6326c7753c02d5dc6feb088bf0940edfb170404b022a6c4ba2c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/51a2f9dabb01d3cc632454f029b2d28457f4c6d51c1aa41a3dcbda26856e9adc.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/5266c38ec9c50d95620cb4718caea55e0076981b68257faab2a0d5a83182d97f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/540c9ebb1a4b41f61ef72faf91733e7bb2392b4a7bbdc02bacd033b2273be6cf.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/5435921a356066835eec6b0952c4d978b6c1f6573fd8995b5e31b0170248925b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/546a757e3f90d9719ae79f4ee1d77e74400d1390e696104df11e1eb73e2ca305.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/54c3286aa569348d3e2257b76505cd7846d7ed5db834270d32beaae0a1972683.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/54ca42a24543b22c75808dc5722fe3c25d668f230067dfb22c1d919915e6fc57.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/574cf513a0dadd24ab2e7fac3ce2971bd275bbeaeb6a6a9adb6a1c01dad1238d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/595a96d12e2ad002424f237e4f8d57fe55b01a85d68345d31b86892855e72a73.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/5990ffbe74dffdc50e5e5906279020d85af44b49bd25377ab518e7274d14d15e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/59e2f809fba1bf6022431919ac7a2161862ad7753f4e2a367d65ac1c5a2db188.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/5be8d562b41ba5a4034a7424b808efa07ad87772fa1d0e0586f3a856a66774b2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/5c130973144a775b869fb5149ae6ad90bd9d649e03b0c3a47e5a8997369030aa.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/5c2c5fa95f5747de8780fbcf33425159f5c57ca7239e532a31329019a3b03c65.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/5c82dec2d0a2157e37607e8fde44f6fe5d3ade5bb776f29beb8355aa84cfe15c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/5c9e75f80c82216be957c1e5df920c23b902ccc1ab0e8682d7b0a8b4106befca.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/5cfe3cb1120eba77215b7e56f77f8b255860a5db175b327825dbbdb87d8d858c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/5d58964d2874ff9ed3872b19f1c4e9285a855c07fde723666ec06dc1b7206be5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/5d81eda060c3c274feeb6504b9b51f693082aece5cb9e2f5b667780431cdf706.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/5e63997d3e18c7dc7f0ed82e4583f7f8138a7a03c5f4128568141703f87306c4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/5e9a54c2ec0432ec468da107394e492c1b47d12d090ffc0e86fc7cf94b1fec3b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/5f5db55e143ffaaab7b61bb08f7f9059a57c06c8949df0f4649c163610066fef.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/604458e343157a8f4d119f0d8cb8a578ddb1d12e6148deb0915b091e941209fc.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6141a8035da3e6b18da503d2621b9f21a298275de603baff85ed739c45f49ede.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/616bd3d77749936f2bb95cc7d98e2e9c115a27df4cba4de6b7d86ed874676dba.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/619fad265c462a11ddacfbdf58f2517c6e325daeb57bfd6300650a1a9e3298a3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/62999312b2f2678cb0ab5df557bb4e2aad0a76182c3213bb3c9b421fdaa77610.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/63157c63cb68371a69dd43705285c7bfbd5e64942ffc6b7b3c6754bb1152ab9b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/638cace2d98cdfef543044c17c97343efecfff73b9a15e7a015e5dc5b3d8fa9f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/638ff256cb0de1dad379e2d615accd40d9db220e7d2cecc8801778fdcfc4de7c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/63b43a2fbcea9f7e4a54746a4d88036bdc3812bee6755d351df1d3841b3867af.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/64a8adf739e0a8886eacd8acec37189d6ba873d7a28caa1660455c7b194cf2d9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/64e1460d37e9b88edd779866828add84efbe055b24787014f4f75740305216b6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/652c065795f3f6d3d5fc2561c307def1b49547458ce11a4d467140980d31e9cd.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6635cf55db1f0c76bcf7ea2440adac03893f69922ac1586140d0f296e11056a5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/672f74fb760a1c3fe49044a8197916bdf412ab00b21c9c984f89ac07aaaf5321.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/67eb784c43597aef781f1ce1c12f4e490abfa3ee34ea650b7093ef172d3de58b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/681ff15432484fa5acb61cb7d7d43c5243aa5d08b322be2d48ad68a1a38eb04f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6922c5c46f008600df11bf1f0e77d3c50491c8b448df5471cb687ca9e0ab5047.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/69b38358089a68f7a54a7763170db7a6d75ba6c1bbdd705c060848d874c6c068.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6a0626a5a9fa366ea88bb24062b952a7c988e9524b37068782689d6c4e247ca8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6b548ab764597bebb01218d30829634ba6a9b3afdc9a8e948024dbd386d55916.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6b722465a53536f1069b403b498e0a5591b2c7959cd5a3a64b486217b528f5c8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6b968e300d4d18ae00c1dde2ad8820271afe3d936346f23c9fd81a85974cee25.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6bf674825311e07b916b138d6638a71f8e5036caad1603ad0728417bf4f5b2e8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6c87755a595892588a5dafb9d2d5bea4790ecf914990d0edf726de980599aeec.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6cbf15b93b368855110845b4e61ab9752f9374a3607d9da84bd22d8d2e90b16f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6ccb6e6c074f0cbb46ad2422e1e3051949f838da9f3bdea8d3782d91cb668887.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6cfc1f1e7a083bb19e8933651ff2e79eb745eca2484635b1cc3cb9f2d25d0c28.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6d21ba2d130fa0756942b98a362c210d9dd01183176d6f5cff3fc2df827d6163.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6d21fd3cf436ce3ee4816b167cce3da19c427311fcc1db277d010d5a187543e9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6d5db194fdd05edee58cf2b15ad22af56c478392fc15728d489021d2467fc0be.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6db10413c5fbe202ed8951c226f4bfac086577b14db1823c1301142f3861e9d3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6dd3a985d8d032ea8d66c0f295753bcffb817f99e535de92128816b5ea69f7e4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6e57534544e8d2e964130b044080609cc86277b3c55b403c4696121839445af9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6e739aa5989c6b6441cff967ae0ba597053f64dd7915b2e6d9455936e0cc9142.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6e77744c15e1dbce8089c7cfccc506225931a1bfcf540defbe2e1d971be477f0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6f19c1b4719f3894b984cd33f64df5601f574d33bc1a62306255dcfbfef64720.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6f8cba41b9e588df8d95da4977575da4a6006983c7dd89ec4cb0a5b4b39996b8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/6fdd011fbfe4bb27208d70779b11310c3c95e7f4d85ba894906a0b8c6aa67f46.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/700d0d01dbe87bdb78afe59f16682d4dc4d4263856d69823255c631c27f6f4bf.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/70171f7ab462cbb522f26012cadc50df334a286888a6437e31d705dc0b3a5ed3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7067b804a4924c7cb056ebadd22be263ade5a52251b3a22a6afc35f20e974c5b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/713ddaf3424289568b7881b4b5913a2bd8311742c54c184cf32839a0460e2735.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7171eeb4388e998203a7d0437a20e7a142f7be3a50ddcb2b9d01ddb9bbbf9e40.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/721ab87f0c31e2b03550582e46510616f7c8d06b78645aa63f56e3252258127d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/725dfc9a1a8d8dabbdbf2328d79e5193c9f001503e3662dac5f4c4c9b837c339.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/728f42a700ee75c892a0313015d4d31c5ccfeb81ee6707e42e2447ff60840d95.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7456ef20018b6485862d5a2e9733aaa6812014fe9e6469baa5d9bbae258d3ab5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/74c4d0513b9f07287222b437e00a2358a0cfdcf8e5e622f41c25f79307e5f77b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/74e11ce26246d7b91a711aac8e4ed675c801a9e60df2892a5005fe00639fada6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/74fd354c75f8783d34ff7c9b362d380cf1a763e769e767ba7a1ee6be7f6420a3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/761bcbb13430bba962a1a3a769f81c14d92fad4375235e688ed8e8ca1ca1f5b7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/783092bb53a3c971d812b277641c4b926fa275542f6df573f7eaf5ee21cd422f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/78b7d7f6a32f67c6f3cf1392f8587c39acfe7caa7232e963e22c6c0c3bb63946.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/78d74069e6b989629ffa48b32be5d7a6ff9c43e4443df5bac6069eafb4c737a6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7b2b6cb67aa453c7c1149cb39b40a6cb2eac56b12e0b554795917ac93becf219.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7b5390793a5de792317f05a7c36369d1bda7c49b6ba6010dd7a6c39b74e9f30d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7bb966a48d6b4f5e13c137cff46842ed847fee5229d66d5a0bc6b44d9a290de5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7bd9229eea9b3a612803823861ee70344a508c131aa6d940a8bcea92229e0bd7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7c068febe738b11a000339a08dd24a38ea37295d59ca9b174d3d6d882554089c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7c287af6d5b09f1616e75b01736f48c23146385ed0f466c25b13202f69a6fac7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7c91d1db9118c7c17a2728da02aec6f1f427eff6afa4a897f87ece5ff741e8f8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7ce3e95ff5b9307acf004958cab2beb741eb3d66a90fa142cb2414c9764c802b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7d5e20a1e7c5e51f6800784dc7d17474ee3cb9b0dd97ccf2ad532cdc650ec50d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7d815a84be66b9556cfbd23bf944503abc34fc0fe1696f51f3ada654ecf1e472.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7de397ac00c7676e9375d634ad4d2388bd406d23a9033eec255187fbd6157973.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7ec2866501f550955a390f23e620f53a2f6363dc90e87899207c6a469b067d73.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7eeb02424019408772e979ac682aa203110281b7e66cad0afc36870ada15e123.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7f0f4af23e915ef30d436df36d5d4f0f33f19c55e6ab0fdd06de7ee2dc39d4b7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7f55d8fe4d4b1138776b7ae0b23bd83f7452031af7690617bd8104a2a5013a31.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7f6de8126112c86ba22fa5aa1667ecdf71f70e219c3b537d1abf696430200501.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7fecc7dc10c5f28818a94b668daa7cf44e7702397feb928e261fdfaf05731860.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/7ff7355b78862b41fa154c1862e599e24ac347aa5568409875ae407887f59848.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/80bb6cedc55e8ce61e2090c4c776d20bdef0c69288f777c2baa08c5baa703881.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/80ceb8e87a319ab4f2427a3325eb71e30e9dcb92d646810ba8f16f4fb01c87bc.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/8100461f06a556c09b8191ecac91f291d89e743b8d4709cad72536bc1f6f2d5c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/81985ad2352ec0cc8016c9fe09dd58d9b8bace0b0f39de68afaf2fc64f1969e3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/8253ed4be06f5721f91daca7779670290837e33fcf897c62b13f73403dd50b5c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/828aa0460c08f664d1da01cdfee341c5aeeeca00aa66f4fbe141063f6ac2ff1d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/82bdf281afd245a823ba23350aa974d22b1c0c417466ada5ee62c6a22f9357a3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/82ea956977e3104e1531969dba91a84a8a8b52bf936a4ccd6cbc6a987f73e889.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/838227a8ca82277cccc3e6c9b176c1277fdec3e50172a430d986f92c88869697.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/83af08159734efb251f955be23c647b820e45d6c51daa00702a1ad2d70807ddb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/83df64a9f97c9bb78237c933e5a593266ef7ed871334f4868535f3ba40ff4a00.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/84aca25899d3c63469e938421679e62936fa58b6a4fa2439746f7df950d834ef.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/84bb0e5b34fd10bbb187adbe39bee20df8d1abb05a7f3a28eacf23f505f53a9e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/854822e92ef61c61384ce4edae90a61884ea82b790265f8e6dbefa5a11afddb4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/858b764c73c33d9be29c4e50423a7c85f995255af6c87bb2e62b6f7012c67d75.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/865f27dee580ce211cc52f75eb869347229234b93bd32750e5b2a72c055b747b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/866939d4fb8dbaf1235d6058f97089001bc2f32bfb7d46bccf710bb7e2ef4e22.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/86d41d73d379d9874c78bed580556ae0619cb890f4d8e79e117d46f8265a87e3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/86fe02aecd7c33cc1f1ac7671bff6ef0c60f5b71483be9f3fee14966d82776f3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/8801c8db8c3b3e2389cbe5c3b79ae66dd977027618f46ecae2f80a8ce2777be8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/88b272b617e519f8676a8badcfbcc7ee197e7691c11aa3bb996b6d9f4bbbadf7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/88d56009bd56d153ea0da616ff29f85f68925c05e5c713605a655db5f3f2a247.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/890880eecff40591e5c9e035fa4c415e1834045b779455edc19ef054327b5817.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/8a3352ed4f28ddb169ba9ede6e4876f81ff56cf56902a141217a442c359bfcc2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/8a937bb06dc4b8418243ba395c67392615830b242e1e25af901d32ff9ef54e2d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/8b2aa49df41c731fbf506ce904b925b0d363762902edc1f7520b97a8d0bf59f8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/8c42c9b7783f85d59479b48c9d4c347bfa0613b22bdf93143a7e1ec77ecb137b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/8c45ad7271c03d3cf808056adc8008a8875fa08da371aa12fad112ab861fee24.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/8cf89bdc2941071695703e50d5950644210e950d0edb62ec72c6dcca077f22e7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/8d5bddcc13171e07f1d24136b3066c66f199497e99e73404969ee1cf8f0a3088.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/8e10c977bf6de8f996011a7cb4b953947c8915a12348d3afa320daa16b90d21f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/8e2410f718d4679450a815cdc419bb7f26ec52846aa498df74afb785ad614d61.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/8e4a7cb3fc985f1fe8de5f74fe90a76b234594d0bdec97d7f9b199d31c4131e7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/8fa7b643c2638ef04168e033069b092f6ae6792befbdd6f796e18c6ecbb7df66.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/8ff213f8e5c89773f4e97c6b8453d5c6df595ced054c913d278f8ee9dacaf9cb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/901fbe08516e28c28f7eb17dbe0b52d39f5272d3a46feb904c9f01b1c8903fc2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/902678f683a5b3ada78d72a2d7ad866d205715f4467bbf08366a69f9acec174c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/90fd22f6d1786f3e883c5d1bb01e7054409aea0ef48a304d664d80fa023ae6c5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9118c54e8b5916fbdc3d37c5bdf8f9beefb073bce0ceae416e86e42569f05a77.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/915c1563edc199e7f694fefccd9e3f52e7eaa4068eb18ad9e2df329d891ff3d2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/91d7e3d94c2445c41f2b9e5520d204940348d81eeac55737efc2115572d60b94.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/92fca0bb90682094bf443a98056ca61394d8f78cef2e85a4876a32834df170ac.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9326f7ad753f5b9d7918b026159fba514cf126182c517b941620d90059aa8257.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/939166eb6edf9009e793e7acac1d26104a32a9df6725ff6a1d6cf16802a80c3e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/93e869d18306c9899277932f2c90cfe4269c8abb4315cbd1ea3fd6226fc7e959.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/94059a406a42801b5bb09e03d6181d29b5552e72eda93085a2a32a8ec5b4f505.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9534a9fa71711a951aa7af91925238b0d1c393b5358d8465c080404a4d825acd.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9609c5e6682b28fee35b78c86e4bc8777b609347d4842dd27c93b31a32042f40.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/960ca662d483154844fbef49de3e24a07e445ccfa3b6b65fbca48c690ec50ee7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/962723011fbc58bccd6a594b5855a131e45a221891b31aa25e7ffa1fa0adeedb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/96a3a9a89f2d0e9c249d2d3afe303400fb3c49a9703721e2f90d35209b05d9f9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9733ef7d123548ea611955648103f03cd2c30888315b24548c4d5f147c5eb60b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/974a1229d4750bdc55a88b57670c30d0976d522ad9489bc23a43a65ec4946815.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/980d35d108b0387491bfdda761c160512bb4c877490e1ce0750dd67b7d45b688.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/986f91cefdc5cd1d14b50f1d7571cea934320fda62f0a76d1f4989387d79a20b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9a84d242a3c62b02c4a37753b07a01a61843f37a64b03dd95efc62f203940c42.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9afff3e91efbcaf73878decacb80341481afbefa23df9f1108bb0a39e5a1e79a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9b373cb5dddf586e2eb52aad86f4e530cba184ad2ea56976545c117f3dfb4d90.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9b3db23d998094c989477f046af62fd725d4abd3efc859880d060e7086012390.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9b9b38b837a75d0c509589480466b04c5f88a9158a44114dd506a7e0b5c6d5a9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9bb0a665d2594d7ee2b643c3178991e9afdc4d3f3b2f408ae8551ff6b20a301c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9c1434081751663c3d090cfac25b457f6cd34221228b9294faed8189fce05bec.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9c1730e2ad54ff5089fc3db9272f1dad5a075a79a55b8a498d8b6e46988a4d81.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9c6ceb1c189e63271a665e544226ed06c5e9ba2813b9cda15874b9178747dd71.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9c8ea2c3c9626342420411b5d39f105bf977f2f3958522d78e380bc2d157edbe.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9d117ba437092c9b19c8bc8fcfaf236ca6bbdf6764ed010eac4bdd83966edd29.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9d38d963b4f1c7b0310532959a7f918a588e54485f5fefd176ec8e5c7ec2e8f9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9da8f2c7d1ea3b71950f4b5f55fd48b7bd42bed7f2f2462b6083b1516d14e9cb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9e04f333d01323b8a724b1d5f4de154dfc1527a904dda319ed9420e638e77c33.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9eff819cfda1fbc93fff5ea1378b27d60a2abfc3435420d5babc5b1001b32741.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9f246f5ef53d0553a85510650e85d2680d32a6a7e83aa30826a8baa38d7c125b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/9fc6a1573c569cf27a8716cef8304d2a19e312e5c8c1bfca86760195e196e386.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/a0a66c23131b40f99fddb800eabbc516493e65a134e57403ab309ed87ed52ca2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/a20e3dadb889bef2be66ac1ff84e2716d7e0564e37e8064c3a163c78175fa0b7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/a2f44f5e5d1815811cf7e55a8d8cbbd548ececaddc76354aa8d7f4faf9593582.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/a2ff557ce12f47eeff6f33141e0b5ad259574fb3f0c3a889899387454af55dd1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/a323288fc16d0c7974c4e585f1c770bc2c2df2cff609455bef0a61592e01455c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/a36eb62c91c5d25bebe5bf378b05dc60d77aead4e7ce39bc1f3affda63090568.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/a4b8fc1dfc21cd635ca7c8d15b7df15ccd45999036b28c885fd10c464d8a53dc.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/a5bcbf7ca2370a8ff920505b89a095abc826ce11d65decdb397de6b40107a9c3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/a5d263cb5cb647ff647dc99f85895edb2502ff2a56ed7ee41f38b0e4f0805ce8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/a69badc0700f001419114693d5ab6538b058eff7e5b9d33465f13344ba36b9f1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/a867197f0d758fb96bc1d434383402237266a4278316f304140397d71522ed27.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/a896d8ebf0748314b5d8708c66071b6f7ce9f03e5334a3e73e1066d218280810.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/a8aae1ec4c40064722c517f665b3139ff77d6026bc691603f69c3b77db7bf17e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/a9bbf5e8e53b7fe60420862951463d0ba2c4f4e8fac0b93d299a0ef5025ccf23.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/aa344360b50938da6c5c256e8e97b328a5dd4bbe6031c7f433003ac9da0d9ef9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/aa3f6e8eb2ce0a093d5d19902d73e03ab069b217bb9c33d4c6a8847280eaa28e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/aa6d1501022005b5d01496c938d1b9a7e7f3f174e3cc3d55afc7a1d6fbfafd60.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/abc9a650a34f4afc0a3d120203db54a2986dc16e4c8109ae0d998f519a93aba8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/acee1aba87b19fe5ff6e3c1551f5a5b5dc737e08eb525cacc363b48befc73c97.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/ad72290c591152ae4938d0131d1eb026cbfb0c023ac95d9ca96633a98a5e3562.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/ade1441d5e86a84f798b4aeb64326a0d6e44c48d1c865bda219167780fd9df40.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/adebb8d9b253763c96e9621203d6434ff77b4dc0f196d4beb5432bea445056d4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/ae7e17b93e7fb9a8f25c8acafea8c60b36561efbc0d25c7e2e613c218030c18c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/aec6f917a34e46b886af6a20f99ef34f10b8d2e1595e4b3c1a811818b96dbc47.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/af0c8756f132e96df19be7a8e5d3a6e40b35246f9cbb8d4d23b40923ca8502c5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/af30fd7c6ac440c708ecda709af42948500762edf635e7a7343cf3be1bba920f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/b02f1a7ae4671bef28a87c1b5cd0ff9ef41add5988e0cb1f0c6d839793143be7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/b1184ee09d05ae1fda7001f13c4c1ad7a04232b47fe43dd886a27f71a92024ef.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/b20757469e67a38fe075d0a563fa14010cf6d1cb3ca579dff65d3704f516ecd9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/b27cc28001fa7a2cf53888b8ed1d44cc3d41674598cb511f3c9f0bd259d9862e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/b2aac6188cbf0e00cbcc65f44b54c1eafb42af03fa075ddd650ba4893fd913e2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/b37928983c90c5b20104e311b3473e2931380226552e3db60ddb242c8b6ae7e8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/b3a8e56504dabb34af551b5176ac4aaefed79800b146ef5796225b2c27ed9a5f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/b5814b0de50d1b6c8b8fe5b8c68a34fe07ac013324cb1ea906b44500da08ab46.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/b59fae38a5549b1318025db70d619e05f02022a3dd88304a82a7906bcfd9241e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/b5dbeb1eaddddb8bb4a2f5c5e2dcf8687fa67c36d886a6199cfc5c20580e16a1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/b610f655c8591a4f21d69386c320dac418aff625a8ed540958c43dae867f62f5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/b6c6bdb556c51ab18473acc28ad41a8bd2bbd3f70554343c68ce3d5d71b6433c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/b702f0f21c733e8135e97288d20d5dbe05fc8bb78cb8e3327bbbfc4c275638f4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/b77688e7c8fcd900c4d7241d43e5ebd36cb830bfe1fe9161c68b4445061f413f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/b7c264ccf2e3aca72ea55eaaccc46a94034dafb6fc263ddd4d9d0116416afec1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/b7d1639107744bede84aecacb819030ffa4cd16ad9261ef71f75f16de90a7c3f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/b8683f0d8fefd5f7087a137cda3c5c0d4c625c42ca32612a2029a007bbadadc9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/b89c438e3b8503843d9c3ddc39ba3e890cb36a86f3bee380642686d654249803.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/b8a48b869bfe9448cd348b0917a046c15e51cf6f6836412d3ee7684f65bea1b5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/b98e104df4aaa0e780dba1cebf191e5c3530035066789d148d4a7f3c478bb560.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/ba1cd35f6145436a9136a7a46597ec01100acbec2ad5982070dde42c5b7def56.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/ba368b2e95c6c0176aa5cf84c90f90f51ecc5bc8e3b2ce96891ec7e301f68af1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/ba8b200a97bb546745a825dcff2953f8cac4c7df59850fdab0a9dc63ea8242fc.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/bb20eb44972e550097c58cfa2e1c972f01eb1ede5149517fa089f72f7d3810e9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/bb7e9d74ef9ed3ee974203e6cf3939689c57d4858322576606c4ae645af2091d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/bbdaa09f0558b58da61a5a0c89bc62cbef5600345f93bdf8dc60354657ba8164.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/bbf796ef71735752fc8bb95f9056dfe67e07d64b7ad0297ad44cff14298fb716.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/bc82063953aa4e71ce0d77e899624324cfb5b00344ac6e043985ec2cca5797c0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/bcdc598a8b596e96378eafe508b01d669816f94456a8cc54eab8d109c5755018.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/bcf4dc109851a489f910a0564fbb737f1027251b5d4774a4f602e8fa53cb6940.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/bcf5ec32f1eea4be52727ccd971eacc3fa617aca64a9774660f7a731540b0276.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/bd7bbad790b126c27c79620da8469e5be67c2968eec11cc4ff315621a0abb39b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/bdc30bf96c7283922ee2371972c6a4a2e1ae5097acb8427fd14b3172e764b867.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/bdd7fb4b4bfdb593bcf2f8041a2afb8e6a06ceea927c47493f7d30126462ad88.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/beb198fb886fddab3454b11d0011361f39fe35dd785555ee74eb5462042fa5f0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/bf2c99ab8a1e208f252deeddfea03bccb251812840a2136d8e4e85ca2054d395.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/bf70526d736b24a42ab735840af9d4c460637a0ee09a07239220be6249f4970e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/c061ad6b15c23d5f23dde6e2ec2d79c0b7e5c6f1bfd9816d88a831636650ade4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/c1ec17151f9d55e83b4218735e978b16c08e1303e597fe8655b3dd41fa21f19b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/c20460c2fb36ac72bcf956653a07b0f5427e0713e06cf511b1edeac5080ffdd2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/c240302728f59543b936e19f57625a55ec1de9da3e78357716f426aeffc8acad.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/c280073cc665e658e65eb64a3612d05baabe44e5df3cc356d2900dd73b43dca8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/c37bc210f83480424e38f8e6b71718208b359de93e061b5ceceabc58a582d766.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/c41bd00c4e69522fd64b47820198dc18d2ce2f69e0fec2a64f6b794ffdd1001b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/c43dc39f94ad83e7dee61ca1fbf7f13e0500774e47c50c0c06c1cbcfb54d94fe.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/c51707345a41cc6e5986289808d249149a092563ac84b847cbc890c577d4ccb3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/c53ea4f87a83798d510efda173618abadc985856ceee691cc8169abfc9887bee.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/c5f90da197a3a27e141b17280332c274d9e9e14f7d70a469afa4edaad28f9c4a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/c67270b0d2cda268c2c274791947ac4c46b5f50eed591d9df8dbb664a06fd09a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/c68f65916515fdffe51b377ad2343de003e167b6b91437cf5c389b542eb4cabd.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/c6da80277024241008d94d092fc1d0eb1a069b8cdce4e256dd3b985173ac6a83.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/c7b86f3d7879265e497bcc1a42198ad48dd0b7c8fceeee833fabdaa265c0c357.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/c7cb90c22353e86f7a8b7c124d31aabb931e2bde70f0816c94e44f1a4ed8c723.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/c8a6094e92db3d44abeba9b28c3d43d9c483ae95c91ffeaaf6e96d510d2d1935.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/c996d5ad73098cf46e1821d60ffc3816ff956846653d15cd81bfb1dbf088e4e5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/c9d3df59572ea3bce01b379738f73d54400788e0a62bcf287b95796e6b92e4d3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/c9df13fbd534a5b2fd47e084d22aba60c2d19f459cb3cb7036e0b0307854af55.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/cadcf5caf2eab2c2cbff7cddedd6016415dbb2b34b87b27bf8de7945b1213c58.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/cb4183aea6598441c31a72b2b0ec3dd7db45d2f27f86493caaf6ebea681d0048.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/cbc2c234c1140616ed481d1839555b721f5b1cb9ad85ffcd7f9980ee20682683.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/cc2d3d42c84c643d40f0e8dcf3a3ed599978e639caaa76be41db300ee208764f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/cd1f25876f4b8306ba814a170a43fb0f7bf4d8d1a46cffd86f2b92b0d4a490af.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/cd6155bfbd90c034743cbf3dd87c4d6f20d23ad11da06cd74393401e12165664.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/cf57d7bed68ce2b987f037a62ec22a7cd30eb90321b0d4b7ce65ed0bf70776a2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/cfb6a254246b3ad5f7908149fae8516362f4fb144f48b96a95993c960efab391.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/cfd068a46f99a70630cb86bb3d744c6c1be63471efe992c95e056a0490bacac1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/d052d12ab0d04d841965d6783c8f305b4cf2c794abdbd8a75baf8d8b2e026351.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/d10c42825318cfb78cb6dec9442b7239abf026a516b2b47e46668b93ae7fb1ca.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/d1c9a49a69f889483b4fd49da7f50331ec2c7188ae0d793fc1e9da40d3c3bfb6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/d25d813c1693653bc2b86e5997b5ddd8aeca95f8a00df1de75d317fec71b03ea.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/d268d60861ed1ab75ff36cd9dfc5c9354d9df2fdee488d69019a8ad117b4f30e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/d2b8d437116174eaf40f6bc2b598821083f7e089beb6c8d1f67c354ce566f387.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/d30ae6810f40e703f3e7d64db90d26a53d6ed1d5b1df59f9f1bf0967d2c96121.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/d3be5521e91b785ef948a6f20f8932a9bfa00d4144bd96faf38fa207ed7f4565.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/d3c6ec13edf1ba0f2e7fd1f377f43edf3d3255ca812c1a14ee42ca08f0d96658.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/d44f9e77ea3793466eaae4f60af8d14617e9911fcf97a833ca44243aa4b79b20.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/d463616aa95f54d9e567335d66991369184ce4554d85ad0384717586eba05a88.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/d620b0b334ad453a19d9254969ea4979fa8681457e06bf9b82b6779cfb4c09a3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/d65f8f5e9067fb6ec58e511c3046cf434a9b717c00dd66bd574d2cbe4dcb0a34.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/d676b178ec833ce67210c5816835818bc1c42d29b56c1114c543c6d38803a5eb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/d6d8407bf4988a2c6a2c7a271a71817843268b7fd41fd0a784239d5c765e6450.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/d6f0aa7f93b905bd177292825cf0ff94385cac78e5c7f354f7006991d2cee4c9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/d7527c064e91765608f626a9beb86345f054fb17f86c85d5115b5aa585e015dd.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/d7bf6ac3699e247a4bebe54746af26cf91aef9dd9242c03c62918661a20823a7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/d7c0ad4667cbf17c293c9d5552b746e19951dc0cda02e2a69137e055c923023a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/d7de7179c3501bd7d01b4408b42c856ce4a458fc420c9e164828f2383f8863e2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/da26626e30a0d9e183a099508917761b6f912f4310e9956bca08d6dd97d5b01d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/da319ee3b6d8dbf93b947529220ed61b89a5a26926f5e9fd3de2905ccf28830d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/db716889c16fd66e6d792866a2ae39b848b6291206950abeb477f5e3d3f9ae71.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/dc20f65d8b222834a2536eae9d721e5dba173a1c63583f7229e8df45c8359c98.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/dcccb639e03c18ba98f2aa58cd45d6f0f3a75da56d901991cb9937e3e03e024d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/de5aca1ea972d79f7de45e1eab72d3b687de43ecc1aa2e8b2365e8f0b9c515ca.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/de699355e9d1c7fc295b745b56f6c6f8eb1c22359eff6266cc24744d1238aa1b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/df02df12dffb14cc4f5e66b3c88f6a00458ad0e94f868bb3d64fef4eb035b6e7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/df1fa55e9caf582628430f49a3a69042521979dca7495204db4d5b24a8a59637.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e0214bae78407c2f342b83a600dc13d157d7a58a001592071fd3998b6037a549.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e0462a95cd6e186aaaebf018d038102201a46e87ceca08af4bd1f567871feb46.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e1b7b50541bb4f614952794d5c7eb896747418a14160f00eeaf7dcd4b1490d8d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e2766d6ab1195649a543f3a85258e3c3c71f9bc5f1c310fa2205b18cc8b8db47.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e3101dff830fd444d3877496504364b2c52fb10cf8eae04456db1e98d4f95b3e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e31305c4622ef9b08a125289c0e2faeb17752d3066fc98d77e29d95579beabaa.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e3229faf942164a4fc484a6a0ab587ff7d648b92c8242c579eb2c538def0a2c2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e3a6e9504b5e16d7e63ead2e63db1178a93d15f50a1afc226da121aa6cdc51c7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e45e7047d752b07956e53f270f3b311596125da0a57b1c4a5b9f8ac2fdfc8d05.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e4bd3eaf5678770ba011eb1370ffe119a3e347ad442039cc0c1587d6aff79e36.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e507eaa266aa9b73d2f220b7935b8d5caf2c73e5d6007c2c6745fd10d70785fd.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e5198d8dbba7694d7032018f446e93f0f3d0fc182ea7c1cdc4fcaa7a84e01559.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e569299249edab5bc2f2cd0902a7ddaa05164b8319194304dcd0f6b3f56294eb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e59a5dacab160fc12f601418d3c8b64724d20c7005667e1037bef3714621e24c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e5c84ba2466c2244d0b8e163576992666ff04ff72bbbd98460491f25b3124e6a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e60acc8f4f116e079dc7ab0c638eeaade995d3eed35889e24636bdb3796d74d5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e6cfa46d90926d7dae6eac173b3b685bfc19d257f0882c3f3901e34536e622a6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e6e2e99bfd2ea8859a3a2da39c7ac327c29e1ea49703fb416f50d58d94cfe2ba.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e6fc8fddee6d2de40ad354dad768328c343c58eb11acc3ec05708d51fe41b745.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e6fec2a0e718f6e7040adf20dfb0a0ddc71fc33ddf1fb1cf8f68137f7d6d44cc.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e775f32a21ef2449651ba5e21c0606087e51a8e432cb0c0fa9af4b46a9f911a1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e7c05391bce6c9b6a91ac01f495446bd173df1ca62268cc32ae7f2637ae09efb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e8e27278e6ae32501b930bc0a4c66d3b368242d545828333a66bff511500adc3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/e9c6211497a6ed15827a94fab4adb7d1e1d1fb199d162da93f9c87ac13c109c5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/ea4595642e7b0300e18f191398f1d3694417b8c5dc8dec894e4ee3508589b24a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/eaab4455c10135cbaa7a156a5fe0170d216ba9a42483f54fa657b4fe4cff40cb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/ebb8b9524e3cbbb576a7f61884c38dfe2758787955d0769a1f744719c4f652bb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/ebc36adbac66f35b2f74c394250456852089d20a07a7bdc0570d9088af2488a2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/ebf61d657bf8c93e6486842b6a88f54eb8d2c52f082610ce941de93e00aa873d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/ec85cadf88089b5ee5c774160c0f07f398ba17ffd4eb2427ddd8438a504453e8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/ec9e25517b085d1ad431297a65afdc857fa040e9731c6d4c3c037c29e9b13730.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/ed9b2c0092dbb56935c3dbbcbdc3ffba0f4555f5fd452951acf16c4ab250e017.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/eddc2a2d45610727f35ae6dc57f012affc3c53dcbf5892eb9109d80a409754f9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/eeacf14ab44acfcdb515ec124114f8a1f0a73b4eb6713f18d331357be4edf420.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/eeed32c58a3470d20738c9e017de1242c0ba697ddb2fba915af1c1e99c355962.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/ef59bc5acce454e114768457521757a6aa9f99733ee564cb8af4dae5badf384e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/efeb44df0402917ee115c0a09b2701b02918a259c045da1b86cb35c7b3c80673.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f00a418160be0d525216f47f2611b1f85afa41d3601f31316574cec2f76f3002.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f049a53d8225a5bf129f77b250adf1695b1d4eafd0f74beab0808965a9a8fe4c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f0e5eb57b5123125cb3fa25be5ab914cb086b7e37fafc2cd1f68096fd04a2d44.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f11f2e86079c612c101c0d64e28889ca9f129c00f5d361192f5d069041e4195a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f1cdb263ad680ba824221f1d33232bf2797836706e3300763d9bab93d27ae30e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f1e1a4a04417d5c21a54edf79dc6c4ca580abb31785432569af18f88a3ccc014.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f224f2da2e60e73bba9170d590b5f80bcb4e292468bfba731b24e4d8189cd601.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f2d507e47142a288ea1994e645e6f18d6b8b4ca1b992b7b683cf364e7f274970.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f33125f7f95bb6244582d78fc7e6b2333ae47f22e8cea19ab0915b7110e733b2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f33a2c71fdf5b4e593ecf8402f101ea119ea9f190bb64aa702c05934f5746445.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f37e219577441a6517367e5cd5655cfa714b75fa2a9d60f253cba40d1cbc7ce0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f5246224bdc08f81b9cfdc3cc331afe44c9b6075b80f91989fdda5b0f87f4d22.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f53a51d2ae240390d28fbaaf7520f3948f3184c8d9e2caa65afe1ae7ebbd17b6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f5f739781fe471e33de7d2a37e55b751b685bd1861c7ae4139d228eeb78d2f83.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f64c056d78add3730389e1ffe9238cb80b588040c3b3d8bad097c3c79537a5c8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f6aba5a1eae500342375a1db187a72d5b6db32608dde0bc4ccb53da5af9f60ff.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f7203dc02f9b3c08cbc290a705b08d76bd1e0df69e5144b45537dd3e6ecc8296.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f8225a725b76e67d0874106d30c5bf643fc4bf9a3aaefb4df8647b86d5dd9ba0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f85d1a1ebcf9f6edcaea25c6e6adbf137393956172597a4bb80364f445750fe0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f866628b551ce9503a47e1a12531f3ccaa815649b00a23abc6ad400dd50a0787.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f87064cb403ffaac9b4959e458410057c80ae13c62cd205cf49ae0f78e64e1d9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f88c46fd2d6c64d2f30edee7d642c8f2d058e5ef81e7a79d100f49deb0b6e4b7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f91eaaf016ed0c06c9ecf2c0fcaf86421cf47781c11297a33aec71cad091733c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/f92290e4b8457b5bc6b34f5fbd9bb8a715cb9e2cb8648389361d67621e451427.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/fa6e4913823a1ffc6c7418eaa219a2a9eb3acba34db25646e2384919c77df376.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/fa886846e67411eec9b19d0b35e64cf25ba7fa7640fdf7c94a5a4c07a812427a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/fae0f63f02c2cf139e1a30746dcc570edc9d66a7cc1f4d65a7c8e73813dc8e11.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/faf4fec511398609d4e1e5b41c281dfcbaf55628131bcd6aecdd2ac8d9f83f97.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/fc291347c374761ac703b5256915d93025383773f2c44a3f43b3247ceafeae31.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/fd08dbee550c384f229c69b7c869d8ab020af36643579277b1d6586b6540ae53.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/fdd8ac5deab6759aeb32bc4c1d0dce1e036d10e4d671e908dca0459ca2ae0653.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/fed6af863e0633174b9fca3d6f0fda80e8976387d61afcc38f592fa3eb24338a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/fee5e61af367d510752f8c1bef2052df5096e11dbf2e1f8cb8dec743e27f235f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/fee795e4cd90053a93ec3e4a0ad775895f4c985ddcf2616ed5a74c4100a562b3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/ff55754bef5ede1783743073be4556cb7c55da781fc8f7908b5623a5beb97042.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/ast/v0.8.40/ffb1c913a102cd43c157707ce7a1e1790c04f42aa74c6bc08fc6734c32e0b22a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/cache/stat-index.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/graph.html` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/graph.json` | Graphify knowledge-graph artifact for Skills tree. |
| `graphify-out/manifest.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/.DS_Store` | macOS folder metadata (ignore). |
| `hyperframes/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `hyperframes/embedded-captions/.gitignore` | Git ignore / keep placeholder. |
| `hyperframes/embedded-captions/CATALOG.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/embedded-captions/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `hyperframes/embedded-captions/assets/brand/CDPR-fankit-terms.txt` | Skills tree file. |
| `hyperframes/embedded-captions/assets/brand/cyberpunk-widths.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/assets/fonts/char-widths.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/assets/strokefonts/HersheyScript1.svg` | Binary/media asset (font/image/audio) bundled with the skill. |
| `hyperframes/embedded-captions/assets/strokefonts/HersheyScriptMed.svg` | Binary/media asset (font/image/audio) bundled with the skill. |
| `hyperframes/embedded-captions/dna/README.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/embedded-captions/dna/chrome.json` | Caption DNA preset (style tokens). |
| `hyperframes/embedded-captions/dna/cream.json` | Caption DNA preset (style tokens). |
| `hyperframes/embedded-captions/dna/documentary.json` | Caption DNA preset (style tokens). |
| `hyperframes/embedded-captions/dna/editorial.json` | Caption DNA preset (style tokens). |
| `hyperframes/embedded-captions/dna/glitch.json` | Caption DNA preset (style tokens). |
| `hyperframes/embedded-captions/dna/ink.json` | Caption DNA preset (style tokens). |
| `hyperframes/embedded-captions/dna/keynote.json` | Caption DNA preset (style tokens). |
| `hyperframes/embedded-captions/dna/loud.json` | Caption DNA preset (style tokens). |
| `hyperframes/embedded-captions/dna/neon.json` | Caption DNA preset (style tokens). |
| `hyperframes/embedded-captions/dna/velocity.json` | Caption DNA preset (style tokens). |
| `hyperframes/embedded-captions/modes/cinematic/README.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/embedded-captions/modes/cinematic/_archive/champion/spec.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/embedded-captions/modes/cinematic/_archive/champion/template.html` | HTML composition or demo page. |
| `hyperframes/embedded-captions/modes/cinematic/_archive/memory-wall/spec.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/embedded-captions/modes/cinematic/_archive/memory-wall/template.html` | HTML composition or demo page. |
| `hyperframes/embedded-captions/modes/cinematic/_archive/portrait-header/spec.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/embedded-captions/modes/cinematic/_archive/portrait-header/template.html` | HTML composition or demo page. |
| `hyperframes/embedded-captions/modes/cinematic/cinematic-cream/spec.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/embedded-captions/modes/cinematic/cinematic-cream/template.html` | HTML composition or demo page. |
| `hyperframes/embedded-captions/modes/cinematic/engine.html` | HTML composition or demo page. |
| `hyperframes/embedded-captions/modes/standard/_anatomy.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/embedded-captions/modes/standard/_motion.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/embedded-captions/modes/standard/fonts/build-fonts-css.cjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/embedded-captions/references/aesthetic-principles.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/embedded-captions/references/anti-patterns.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/embedded-captions/references/bespoke-vs-presets.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/embedded-captions/references/caption-grouping.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/embedded-captions/references/composition-craft.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/embedded-captions/references/direction-catalog.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/embedded-captions/references/example-renders/champion.html` | HTML composition or demo page. |
| `hyperframes/embedded-captions/references/example-renders/memory-wall.html` | HTML composition or demo page. |
| `hyperframes/embedded-captions/references/failure-modes.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/embedded-captions/references/layout-heuristics.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/embedded-captions/references/motion-vocabulary.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/embedded-captions/references/rail.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/embedded-captions/references/reference-bar.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/embedded-captions/references/scene-types.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/embedded-captions/references/test-set.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/embedded-captions/references/typographic-moves.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/embedded-captions/references/typography-presets.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/embedded-captions/scripts/audio-envelope.cjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/embedded-captions/scripts/check-occlusion.cjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/embedded-captions/scripts/check-overflow.cjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/embedded-captions/scripts/check-rail-climax.cjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/embedded-captions/scripts/check-timing.cjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/embedded-captions/scripts/fill-timings.cjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/embedded-captions/scripts/fit-fonts.cjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/embedded-captions/scripts/gen-stroke-path.py` | Utility script for media/audio processing. |
| `hyperframes/embedded-captions/scripts/inject-fonts.cjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/embedded-captions/scripts/lib-dna.cjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/embedded-captions/scripts/make-cinematic.cjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/embedded-captions/scripts/make-composition.cjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/embedded-captions/scripts/make-theme.cjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/embedded-captions/scripts/matte.cjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/embedded-captions/scripts/measure-layout.cjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/embedded-captions/scripts/prepare.sh` | Utility script for media/audio processing. |
| `hyperframes/embedded-captions/scripts/preview-frames.cjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/embedded-captions/scripts/render-and-composite.sh` | Utility script for media/audio processing. |
| `hyperframes/embedded-captions/scripts/render-theme.sh` | Utility script for media/audio processing. |
| `hyperframes/embedded-captions/scripts/safe-zones.cjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/embedded-captions/scripts/transcribe.cjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/embedded-captions/themes/PORTING.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/embedded-captions/themes/README.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/embedded-captions/themes/anchor.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/arcade.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/aurora.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/biolume.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/brush.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/chalkboard.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/dossier.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/graffiti.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/hologram.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/inkwater.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/laser.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/lastpage.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/neonsign.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/nightcity.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/ordnance.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/papercut.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/popup.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/ransom.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/scoreboard.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/spectrum.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/stardust.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/stomp.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/terminal.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/thunder.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/transit.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/embedded-captions/themes/vhs.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/faceless-explainer/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `hyperframes/faceless-explainer/references/cut-catalog.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/faceless-explainer/references/motion-language.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/faceless-explainer/references/story-design.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/faceless-explainer/references/visual-design.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/faceless-explainer/scripts/assemble-index.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/faceless-explainer/scripts/audio.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/faceless-explainer/scripts/build-frame.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/faceless-explainer/scripts/captions.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/faceless-explainer/scripts/lib/assets.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/faceless-explainer/scripts/lib/dimensions.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/faceless-explainer/scripts/lib/storyboard.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/faceless-explainer/scripts/lib/tokens.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/faceless-explainer/scripts/lib/transition-registry.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/faceless-explainer/scripts/lib/transitions.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/faceless-explainer/scripts/transitions.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/faceless-explainer/sub-agents/frame-worker.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/general-video/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `hyperframes/graphify-out/.graphify_labels.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/.graphify_root` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/GRAPH_REPORT.md` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/00e4c95bbbfa705f0e56db61c37c74d9de7b0bbc2b612432fa2c5b53bae45918.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/016aa801503a738d214f7d613d5cc3fb11c8c688d9a1e7d081727a3d9757eb71.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/01779c6a2d3973bf630c5efde1c3298826dd5f31012b9eb6f131a66323141e85.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0194ef9a1d493f72bff9c0fac9322fcd321e6a791edf5ba7263cb28248455ca1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/023fe0dc728b7685631f0c7ed4e33d6fdf16bc02d05330418c026defbeba1f14.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/02c2694f91fe9a6b7679b3fea9bf8af0938fcbb79a8abafe9e6859330902e358.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0337b3be9881e87db53a183b2de8e61899dcb8ffaaa402823c5519ed2135874c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/035f60293b1ba05ac479b66123da306dc1e8dfc493af590a4ea23295bb6af965.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/036c3fa25d6230424cf9f3dabc78578a7088dedb39695a41c283995095a5c589.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/03aad66e55a4c7685486c0fdfa7291551e73f76fc02536751e71a43e6a76b63a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/03af62b473e02606c2c0a9705175dbc9f75b737c1458fdc53cc6bc4c694b9355.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/044573981161fc76af27dcff59cf77673b5f0cb4e957ff1967d20ae516f14b28.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0461a85c6595bed09a978b29cf77ebd3f424b0460b94cd12ef4dfded158bd3dd.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0577a7e9e334de9a1f1af65fa8530349252ad09a72d81989b5727c3d677ffa99.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/05a257461cdce7cff44720080732f2e0dfcf98a4c9f8a559bb28aef0b37ef378.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/05b90e08062147f66419245ae9c30a2b25cecca04a40a642b0c830e2d75618af.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0613ee0a897af81ca6ab83c529777c1cd2502865c92898a54e30402f66a8ed1c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0649f7db2cc84570b02687e1934da11a5135e06954da74b36053032b5b2a2e52.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/065920f688828d747db5c36c3cfe737244382a08dfa921d09197082cae5386fe.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/066b065aec95f006a63561110adfcb82af8700523a95ad95d273cf7a7197508e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/069a3e00fd9c4780270e48696025098b0969d2549fc2be750e7e42b7a009bc32.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0711175423b6e6753efbecda419e13d19595c3aa96dd6964418f53724582f3be.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/078a5fcb52336abe4fe7a9fcd8dd034334cf78401f533d6c34cefd316fc8222c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/078d815fc2a3ce854239f628543ad626a36aefaed3c7946579d51cfc127fd3fa.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/08e46ff80dc7a158caf90ec0002565a385a8131b238302058b4f09a27e2d69bb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/094450ccb5641983acde0c4ae7ff535f3abc72da2545bc640e22dfc17819eccc.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0971bff5623c98b6dbd8902746edd6f9d8ad66a3acb40a0623026de2769da365.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0a35ecc3a9d39bf3a46137405b15d4973506814a510df7b4e644d456b12f7b0f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0aacba1221861eaf18d226a0f2e26809252bd134d933517ddc23cc167fb4ebcf.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0b197b5c9da4f3ddbc2d7679af275ad59483b512efbb63dea5902e1da410a299.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0c2cb25f3cea11b08ba06546faf8afde1c483985a9305740c7c54634c6fad3f4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0c7b090d4e82c80ff8e97ad1781f8838b8d28a1c6951340b69f141a5472a816f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0cd10cfb38151c6fd98444835b751363f4f347982037022c7e0005d6763eb8f5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0d245d2006d2994c704d95b702246b468e0433201a7fb290657d7ffc92f164ec.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0d2ae54c2b0d012b677858625aae130ba252f859d82b345ab92da013759e56cb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0d595b1492e2009a5d60ae52a61a846eca2b8c51666cb4bc78a2adfa5805c52a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0d621b9945e4f71ac0d77fba6b8c13ae2365c26cab0162526ec17bcaa1302a1b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0d79438f35133cf1e5c666cfe9f06f2c45e4626e79b39e4b85dc0275767887d2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0e10db5c202082a14a1817b266106b638532ce9cdfbd0957e111e23c2af96e41.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0e1d3660f4099f5156fef7493fafb167916ccac4e7e6f1714678bb7aab6a30d8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0e2f241792a4673515a01d2580836241f7269a4bc8cad49407752861df5271cb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0e7345549356823df8be2c1b428bb965127d3ffe5e2a364c2e9110605a5a2cb3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0f3c25bc0428ad82e3d6cc6cf7e0ff6e5affdd3f89b07e07a3ba6053b11fe33e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0f460dfcaeab897e79d79258e9b3852f0d80cd90c86cb0dad88cb9c0e04c15b3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/0f9fdfc45d59cc332c8a937ee89415c0fbf79d8ef83b9d3cb413ea858f6a5858.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/10a353681d0c03da63a75386d5b336cac9086daf068e4b9724064c3f0af3e85d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/10dec933b9ac796935329fcd262aea83bbb7e2eb4fc1f54b3ad86a395bb5faaf.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/111251a9178d61d437641223a1b854b1d2cf252b7e2d41bd8bbde94357aeae15.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/111c1e4a14e686ce8c59dfeaa0eae37ba721b8578f216370ea27f3e64d5c4038.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/11451e4c35ebf2eebd091d1170248b1280edf0d4786a24e8e85d189ab5b2a624.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1207c1dd2c9214128a5fbaf18f8d7d8a385075bda64b9b434c0b38f6a99ba689.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/12339a8a5aef83587574363c4568ee4cea6a6ef69273a440459495f0b10e7473.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/12f536eb51bdea175ecb93e7af043d284ffb8d3e6800b2fed739dcfe95aa3936.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/12fcb3e708ca51afd07198caa2d64e7e076df6386893699e4280ccf85fc80a6e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1353c70ce3d4e76fab4ee267011f0b9fb909f3b85790c700db68e2796e74ff09.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/13673701f9aa4bfc708db51cc2878fdcfef957f180b8b4fafacd0c5aefeafd06.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/143e366ef5b73b8a1dd393d836ba1c4037656e174deea9fdd7910213882f4974.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/144844ad53576d89fbd44b63d5a1b6c99adf9568b38e7b581af2dedbad28b41e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/14a4cdff3fa1deb8b75811bc7702f46869d1468054042b88a19613aed32be974.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1522b9b5f0d2aaf705a676fe5fcf47a4c1ac3da9f73507b6d5cde7b53562d562.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/15502d1a3fa8481c353c6c9b41f18e0f521b4a45f91b5145025a7e0739127a16.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/162163e50167ff54c540f1809c65313d1be895c905175c1ffea2101b64440c84.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1635d6c4eb4d20047b903c30f0be5230c12b75f769c0871e148c24972f474308.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/16c3b67fb12145214e74b26dbc1e13fa5364bac8c06db403f5e6f0924741a224.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/16cc7b7988ffaab05273d0fd067676d700142ce4554648063e71f9258fe3a5d4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/16cdfb07077111fe9a3972c4d4c146c27cb8d615aa44f17dbff8086fe2addb01.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1782bd936fdf1e25b59c5f5b74862eb7dab9f2242a94ce5d73baa53f764c7bed.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/17955f1e487f0939134effd77a37bb5fd6d034c209bb440883228173c617b77e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1818e822db88bc1f4c1bae136215bdb2a0f76fd668db936120697d0db4edf3c6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1910daf329f88460279fb5ce2dd6d637c8228ed20b9040d2ae9568351442f045.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1940dbb77ce69bc09fd307b781528b0875491f6e49c317313e9e0e84f98a50f6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/19512a3f4814325e1b515128a7b753af32c14840a4c35c260a4fbaf4c141a133.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1b0546e2524ec706beb85f7b0ab6966c4589e9519adc9c6a062cdf2c5d1b9291.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1b139d5452a9fd56578d41fb0ec5a763677ef1918810c32a58e16f96cf149333.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1b246d19c181889f005314832200e72a4ab61b758224dfc0273074c2d451c841.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1b29ef13e2dc7041faa7075faa114161b43c58559e98175d573c8356e7dc62f3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1b56da57e266d1b273a0161d86e99201affa1c221635c87c85170e7fdfbbddaf.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1b98ba9323229d0f43cd2d5b8dc371c434f7e1af91cc895be159d2b0c4f58e08.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1ba78793680326574ff3ba37f2d9ad1351044321c7bcc4a27da2717d02876108.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1bda2a2a89a47a1cfe3e1d8ffb10c8543532486979ccbf58eb2b9fde9c544ff7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1c069c5b7074c6289a6152d8d7529e926c5866354f7d4e9089911fc5bc19329f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1c5dc4625220b71eae5933fe6db99e1428a8678fef1384bbc0ebc1b01263900e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1c94406277263d129196ffac339d79798669f25693acb7cde41803371891e18b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1ca94830aae542995741ee5e22e6ed6a73759e17c04db5be80d5be63b146941b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1d4455c44350a322d14b64acdc2123ece9189574d04def891a4b3bff4feffe9d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1d46a6fdb5d808d918fddd5f9569bea73ee19b3e18ec84c1a06cdd7cb6f5a301.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1dad9fd9c38a9cbf7698edefec3520df9b454a07c22d3329f66d10770459a71f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1dd392f95e4e134ff9b2d56e85e3ab540a3fe0ba1da88b6bfabe581a9b02e8b5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1e362ade4548cf2eb58473de55f04e2b70cba0f6a684111a4d92ee6093571078.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1e6016a8609822dfa6e3397d8dc579bc7ab2d0d8dca6841b3f098f89989a85be.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1ea730c075dc88392225717b57f7778977b6e5bc4a796e4a5c268019a00f6003.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1f5dc166c10679ac72cc1d9c184d8993e0bcd1926ede91376d63d5faf2376500.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1fcc38f6b65c8de6db12047fb0cf96f8e6d1c990310e7d15462890664fdebc25.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/1ff7eb5aa4d6f87634e761fbf9cdc8abb527b08a5ed41108253e375355581c23.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/2020a35d63767cec55b3f1c3fcfd033c6f8a00306aa8e771ec00ad075e6ffe1d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/2049421296dc6218d071a6f11a6dfee60f3dbb54260219de404e4b772a40c882.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/2074255d14e838a01cd477ce87a614aee33c4dff71ef87f72e8b0f97c1113655.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/20ea1bcd7961e0efb8af9c5774bf64bc508a747cf4bd780b3ba7f88cd0a08be0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/21b5f85acec37e4af555a3eca42ee1c7e350fbd87f7b7bc341290abbea799858.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/21c8e792344b19378b70d2735182d681f0bb6ab995b928087aaee930cc9acb72.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/2345fa9f216cf7bbf1017de43c47fc798f3d818feee5c5ea7b637ee751ba250e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/236b1569868f35c8ea7daad140e6bbb6a04431a2fb068774204a059e2b9c0fcf.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/246fd077db8f6e247b817692cdf68c8518013fdbb8c91d980c698aae7c838bd1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/248cb60b4d552b89af10e5f4e75dcb55e5e4226cde9d10ee07aefb2b20e5b3ac.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/24b08af1ad892b7f1b26e790e8aeab7031e2826daafa2de3ce8a2242b5d05045.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/24e1d531a61733ae171482b7b7b4b99381b97217bdb190da406b452c6dbbac88.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/252ab98ebf3266cab3b3a977080f90ac14022e3a0af36d8ee791937a509a7190.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/2577229bb22ed8840297c7f5ba8a3e11c4f511db856a13c8cee56bbbdd18e58e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/25d28f33322544057ec838362398d02db34002cfe328d96d585c09971788277b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/2662af7685276aa98fa03169e8068f3be02cf83ee749d4f85435629e164e65c3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/27189fb5ce0e59d0240107717049f6bf2677c963d108d56497a60410e72d3b42.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/27f2ffd040430920866d00b2d4663f1c7ca79c72af2c09640386aba331dde318.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/289242b9d0847394bea7b8ae605373f00bdb57536f0a2637de314e13a2317137.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/291b108084a8b471452c4e4a4b9a5d627b93dd1e94b641f2b9b370a5b93970bc.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/29458591b7755b407e850bf4fb6b3a28ad19129742513bec1ca99a5b369cf218.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/29f966ccb67c3238c19451af33673c3f5532b029614a6aaa3c9e9d9d76b376db.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/2a05c8fb59c3024cee633e67c1f8672e3a3cb3431cb272c0ef46c404f621163f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/2a82446f0465d9f671e5c314aabc84f9a4420de1df6598c9a77ef819305086ca.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/2b75acc1e267a3b4060c123070862afea4fcb8b6d97e5035585935a802f3b967.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/2b8dfc2b53d38dd9aaaf37a6bf695ddc9993518b74b0f7ca8ff3d83c41fe7e11.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/2c11d16b7a4346822e09817dc59147078173476579fe7b6c9e5aa86990338cbf.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/2c5e835f00f81e2a2bb989627cf2418b8b42053348c01b72e1fc153954725f78.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/2e39103c1e3164ffb5ff3931a82775a1934b792ea3c5faa64cbdc38a64767027.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/2ee7e38b3473879435767ebde265bbdc52a717b518131200e9e4ac91a6e61276.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/2eeecbc75ead309acfd55336e14d4a4eec846a15b7fd336764ff7232f86bc420.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/2efb636de9c3866a6a36bb24291a9d165940cd8148509298f818e05206b4520b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/2fb2c0a9cfb0bf094d1e2df6612988444b73b480a44a41836fa2ceaa40e2caa4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/2fca0a57891d4f3081119c93fc790df3c0ae7d46680241cc1accdc4093704457.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3004e9eef12751607fcb31f4b3fc819faf1fed3c3cb94646a3f9a4d787e8637d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3019de3c0fa649ba164e91c192f3c50458cf5701ede218bf664822ca0d23352c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3133bc7580a3ba57bf08b70b62a6557a65399f1f59edb0fca9dc7aff6b27c4f4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/317aa7fce164c01eb45984bb302a24f71a68ff83ac43ca89645dfa12e260e069.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/31be284100cb4b7663400b5181d9332621991f29af8f406e962d9b8f51e59877.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/31c77e1a18fab906188d385cb586918ddd7561286e5e105dc5a6e9f194701653.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/31e8aef0b9ec9ed064a0bccea109848786f7dfbe1a4feb536687faecfee2ec4e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3225552278314576d84e98c7306067b0a4c388f73a384b0f177a0790067b43db.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/32a8f6f5003a7ccfd108a56dfe1faa3a218c9191abc30fc96e08eda4bdb7e2e2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/32c281fc47c5d268689c6567e71761e242a3091ad585f1d6f39fafdeb54fbf6e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/32e86f6580f63524d92d47d205adf1ac15b4c76e63275c8a9bd2c8c016a9559f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/330a2c7b8cbb8bcd26f0b227483e08dbb2adf5cc9d105b920be9906bb19a361f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/330cda8b666f6670a924d701c5e965280ac2a5c491d601cd21793469e700d440.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3335ab6ac48aee2c01e57902dea85c1e3143975c44797a5ba8d1c78f57a975b4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/33440c3483877585c76419863efc0dd0c1a70529ffee0df0ebd156a93bbc67f2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/335b8fc15f163277fe04fc95ee53bedbe44bdc967bbad658777dc1901005e890.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/338213c83879df4e0db758497a20c621fb85b845d075e7d8efe357d883345b4f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/34250c8712b28a1cf02c788330c2cf23a44745f43087a7aa1ed071150fe7fe2c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3436e172436db5584e848b4514ecac2f5de36101f0fa5f3a0ed66589ccbc1ec4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/346915acef07521d05a08cd71f1f6cb1bda81fc87d88aa4aa33b0c5771e95c31.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/34e4d813e1c42841d1d7ba36230d5fc4a056ec3446bf8e300eff36f79688edf3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/34f29fc875c47ed094df08d228aab435f72b8c06d1033e5c36c2e998f380038e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/35cd55b9191e885ca48662d0e25c6b37b024c58713a7ca277acfa140a4af95ba.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/363e9eb96aa691de4232adf655738679eba4ee3f2d14262111cf103638881c1e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/36994ca5d002c4d71bbde5a4c4e83faeb8640906b7d7cb9f1594e004bd49733d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/36d0682ca73bed3c8924f58bac372572d01c06f9a95158d631f1fd359f3b2e69.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/37895113cd84bbaf2f89bcae455e93e2b65008679bb3da95c86a6099734f3779.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/37ed5036af2de6fed68f0bfd39091cb0121badb66f394eed835a89aa99df9d60.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/38d505042e09764631f5c8ea9ece560eba954ba0631f617568fa13f903192cab.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/392d68c9e346cade9019abfb6a27f2d86f7bee4c42c0a0308a14795d5029e5c3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3a1d83cc6c0e26737986d197c1f8b7d17a31ab8c42f1b0af37638f43e5c29d9c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3aab990a04125132f7d1794536bebbad5ee1f0f3cf609024d559751480a63c08.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3acab643e2ad635216c12a481578136860c1845d211aa62c3e4a13445568d5b6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3ad2e921698f7605b877409c96539da852ce8d6b500b234c464cbeabaae99241.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3afe6a4c85bc2c00cc65621e9ad9fd46713cb79bb76d7fe89cf993d57e9bfa79.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3b6583e5466cc81723fe112322c956affe5f35669b12a1edadff8a48a74a8101.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3c629f28465bdcf582472867faa0a3bd6522575847b4c338bb31441ffe0ce023.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3cb025d1db635f5331424fa08dc1ff0a958b4310648b5b89fe815d62069b67b4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3ceeb2e3aa64a569c4fc5d828d987f9467f8c5cb13820190667fca70989505d7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3dc2b258af9a3a7c9743962f87fce8b74c4ad0d7263960ec6f7c36f00c93ea19.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3dd91d74b2f5d7b2ed957c99916460238def68103a9e56f74fe1f24e1b9ff3b7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3e15189b813fb175ea99235907ae18a86f2149e116e6170e627da52b8cf8a8fc.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3e2736f3af0f2ffbfaee7e9f702485eeef409816baf45e1c00ba7034af4a34dc.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3e2bb7d6c5f31a91ebd27d085b78089358c1189129632ed23e3d3824c9201fc9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3eb1279598ef57490c8f30d77c993ce49012ea404d4977afe5a2955e1607da24.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3ed18e03b19a966482d6428c014f3c79a128342d75bbc6e8dd2e9b6ea245e3e8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3f2a37726aa10d71c3b2d6698bef34beb8d22b1b048e8e83fae21cb1226a606d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3fa3e973bfb94b37a6fa9712d18f413d610392dc19857414cff6c139d3ae2aaa.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3fb8476dd0129a38375e70b7b7ab334d2ccd39bf63dcf65b23d45f37f9b3dd2f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/3ff71653ed76288babce4f2b780979396d556cb74ceec49085aa156da4cf22af.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/405c8f64b44e0acb728042c965f1f483f7babdc72f2b27e78d264a2f90e643e1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/413ff835bdadef0eb971446963afbf28e0a8b8659cfad0966acf473e08fed286.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/41532ca9fc80c23347de360fb82b98d381b4fb5b767cc3563578004e0d800b5b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/41751ef0d5a13d355fbc638c9c6ccad83a0bd9062c625bed2126b2aafeddb04b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/41c78a0ef08719e49ad4da234c076f04104557d71d111fe2d925e0da45a55473.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/41d5b980507dc1e9cee3f6b0df9aa063393c444637c5719f3a4a3efe9956d378.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/42f554b2b093b5c7382dd6523a570d6ad433a6ec2f2efdecad9fd8f2fb3fc3ef.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/42ffc7f30bd8543c78d5bca84fa1b4a3b24d987d83369f504c16bc277a7b2b25.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4336a36772d2ae73e8737857b0cd1ae4cd78a8314b7be14c4014ca64671f0109.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/43cef6530cb3fb5ace420c465c8991b7a6660bedabdb09c78a021418f9eb02be.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/44267d93230ea2c0a7ca75c26599657be570c10daab45c60c22684b8d80cd8fb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/457f0bea41030c1d853939988729728f8f6a9e51abec846c138bca797307286d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/458e7706f2fde765f32177763fa01bab9936bd177660a40708b24035fded76f0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/45ebaea7c573f76d2362cc3036f80a0ce8d2060da9eb07fc513ca7e59b7f2ecd.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/46ad2beb9ec0e4eebadaa9a1b371f809eec6f103355aaca4376a9f31f1170fa5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/47a99a2916d080acb7ecb0ce920c50b6794325519a6191d84a744c4a074b0e4c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/485a96f24bb3bd662d42ebdb685e955391dd1283a51f4006df2fb3da385291a0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/48e5f9ae45ba9bef07e6faafb1cc49f769ac64ef4483d11880f5bd313468a457.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4968f8ae9f793ae3fe8b11a65390520debfd22eeaff2f880757d7c8f282c9bf2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/49af4d0281cc3eca98407b3c5f70c24770fe7c77c9cef7256c050d3da0f21268.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4a1c637a7fc0184ba8a5eb8110ec4222888a52ab8d7eb4d4442429bc1891f0d2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4a428567ecfb2df9a8f13d84d104f1beb0b27c90f8a6a5f43644842e9b9cb7f7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4a90512d6ca3cccc10c748ad15d33f89f2f997a286838ab063585cdf1a3793e2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4ab2d35e7baecd91ceca237a1f9420e9e364609c37b13e5e89e2bd820af44dac.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4ad6df8e193d50bb9a8b345e95f86338e5bd12daaf163f9763ecc04f485b5261.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4b0e3b113140f4500a1a8ba25c68f96cdae8da1fe001d4a8fdd3a2981dd78b9a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4b398a6ea1946b4885ffd718953a719bd771148a40f50e8e893b39706a48e68d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4b65baf9c1c9990ab82fd53ded29c0ead725714764ad9892285de73ab5187693.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4bb090e1596e420646ba07dc4b5f1b9be7cb41378470bd6aebb07dc396f99bf8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4c0617d3efec62bbb737e36da89ba9d00c7a19c8eaddc0ace0c2ae6730262b76.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4c1a6506e55e4a6e9b873204a68196b082abe9c5e6719255a5ace277d28cb591.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4ca1794736e17095327eb499ca10460e03f04690e064397b96f82b4943da941f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4d0a46bd775cc913f3bc133022732df10776590e23b022e9719a56bd123d113e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4e425a5fa51d0ccc1f8edb5f9d953e46ee9d63dc4472f132a8921f1f502c0092.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4e4d22e05b0afe5b9eb6b81c0c0d2b44d992369f24f6ca9dbf42d1036d36ff5a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4e9e6c89ca2727c28357d8b3fa1e6c0bb1d87538ceb9fa98ed2acfe6324f9e55.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4ef3b7007978ea3cb71b667f4cdfdb8e9b7d8c32b44d1b76491ae59c708d855b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4f201131fb674309788b4b35a7583cdf7b92cacf861a7f554bdb55101edbd797.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4f7d6196ccf97f50af528c6f670abaa659b89984d7aff87351a7bb9df3c0a845.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/4fb0d032b8e3138fd0fe7f634ee82937667b200ddf1fae0fdd78b6c8d33f1a1f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5043dfddfc670d47457b7a6ac08e2ad43dd2aa90e76bfd67f1560c1e9f5cfeaa.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/50548be1b5a980abffffe195ec4d7de903506aef0e68af37933a1b6d556552c0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/507c924137cba8534ee94d14dd53b001f7d377e46fad5ceca988fe9b50f43934.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/50ab07fa39dde3b687d48a9d3cd53206fe893d2b7f395da081655db2bd55961b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/517919f8e32d3b9639a72c1b2340ce3f6f3fd7c97801e689e38a66ea9999072a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/519f4661602c444894beacafff723396c45f8ad9f23ca5363572a43a5bc3a348.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5204974693786333ba7cb5fd2012e421d85f6fca404ae7556e63820a6e907838.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/52203587fb7ded0ec89b6d45619485ec81dba4dd318b84672a111d5aedc794df.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5253b24cff989fee7dd5fed7f008d71ffe8644cc6d2da5be4c661abce8b1338b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5271e15ab731843e58960195270970f06879f81d959e1159c3184e4d6a671e26.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/52f253ef6d77aa82515c57677be70fe5db460dcc9467bec94e6cb8f2e14b513d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/52f7575c89ee61f3eecb5015b5cdbb5a807ceaed86ee0cfb15d42048b87dd7a7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/531bba9d1710413fb091993bde54a849fc81e599cc631db8d8d1988f07c29b83.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5368df3f92fe5fd66c2af89de68d20abbc37340eafc76fc297f3d731095089c9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5369d4f52fb48b74dc514392bd8ebbe91ee1fab2eaf81acbf60594092209a4f7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/53c2f33f0f1694a955f4d95c5326ef1d4b01b82c1ae608f4ae85c87d9571f64b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/53eb2900f624549450271f424f540f44aa8b1e1c959e115b29a6098924419b31.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/53fab8477b6720fa302f96a21b176a1d52bd90f6a481949373ffdeca1266890a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/55375e11e4b15a672b8388e4eeabcb467969d06f7787a3a620df650f9ab6db63.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5592a57d9fe7f044362c35403ed6551b3d307229511557a00bb1cf966f328aaa.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/55d2d9c93ca3ec6778d60db6800b066d78975fcdc84426ae26ac912a2949f7ec.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5632706e2dffb855028662f6354281f3998a8d7a5fe016ed070f1d71b3a2e9cc.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5658f41e9214d2416f046e3f283ceada338f4fdd8af7ba5819f25fbbf1da1325.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/56948d17ce96bebcaab52e78ad30b6d52b6ab5203ab25c428ef70ac074cfa974.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/57389d28d93dabbaa4f6bf067fa73865c8bd52770306705de47b827ccb4d2114.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/580bd5d31400e2c54df9d6e608624f800c7c7460edb03f0397bc557730e4586c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/582afa3baabf82d3e48da7b293f081d9792b3d5a0da9a36e780c9dff9d651ba4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5847aa3e4cafe5d4149ec11313ac24b72c66701094aa2d63f33320ee84beb9ea.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/58d323cf0a1695a2efb19f0457a1021165682883e09d823e00d38c131be417e4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/593ddd79505ee966342284e4563a6d944eb0b242986e982151c8400bbc953a13.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5952b4c2a893a342fb95d65d44e8ebd7e7accc6c66722fd67d78fc6e3398343d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/596cc71603b1eb5a2425816977f313d163e964f4a1ab94cab0cf5623a9d28c1b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5976c9544fe2e9fbc2eee8b3883a2f1d7a87fb42e989c5e0a34446678626c32e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5984855e746df2e3b9e02260f6941aca30b3c546a89f74b00844575c5b896d08.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/59b2a859e22951361c985d6f0cfecb016897b482cf40a95134eeec2d554aca1d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5a06f1315f99894811e30f48e4e3cef8f518637a6b7d18b9f832d67b4bf5adc5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5a0a788a03fc01d4f2146dd6b338d8b3a77ca95bb02bb05c6b6b1c8b827477a4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5a9c6702ba942a92afd932452c4d90d349fac0256d34a37a20f6510bf7e5ece8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5b0256729e577c523d9c95240393da23e259d16418801165934d7eb82bf7a066.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5b0437a5e89c5563416c60bf89180b2b1f79f565ea1edcabeb9f8061c6f5ee46.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5b7986d6d2c52a306e7698db4bc9e176f9412a93a3c7f26636cebb8e3f65649d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5bc40f2d10ca98167a0fc8d4864d036c584f359784762ce900f5d0fdaf995069.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5c30ba4d3906b8e8febbf2800e2d0f7b5fbaa22515fb49252d022de7fd18c3bd.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5c415648e7ce0984043780ca171b7e2961703b3f2c6c24eeb5f952cbf5c9a2a0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5c6c3530d771cca16323de7e86c8c557268b6941aa009659452018250e5afd79.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5c771aa27041ea41fdf33a1a10eaa9b68a2ce4ca8fe4fdd5058351ab6b0b6786.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5d1de9fcdda0f1e02639e65da8c811c960c0b23511df06e49c4d66ac7b05f259.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5d47527bd8a62015153d55b997c85fae0b5e8733a5b082999a3092151f391e91.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5d4c739ae23c133a5ddfc632f2479d5681a33075353daedb3038330690b46e73.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5d867bb46ed7f90cb6e45b26617098978f0e4ba0717ce06aeaefa8c5f4ff2169.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5ddba20ca32d14e5e0e3245b655a92f752342ba74f16122d6ffd2cf2a83c17ca.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5def8d370e69cb8c92788b47a4765aeb7bfa14ad64c23c0ea9aca2d206c151a9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5e5ecef36302dcd7783226f38c5171cdd59f2e33622c9b421d72a393b1061d77.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5ed06188ce457d6d70a342b10ef28bf017304e61e01eb6032d9efa1d05c61026.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5f3cad530cff42ea31dde75b3a2e8e24d9fa4cd4cc847429d1cfb86b5c12738e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5f65da20600baa70feaa5ec3bdbe80064f2dc7ca50170a4eedbc2ece265b85a1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5f84ae679ed5b4510912f09069a162e00ba3e874d523cca94572cf5195d3e47c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5fc092684f640d23794389609e1122973466f3e248a3064566d8bcb27663de83.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/5fee9b9527490e73d838aba9fc61120dc9baac829e115891e158ebd9333d89aa.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/61d005cc7749c20e65b7ad13fcea66952901ae8c36830be31ab3212524bc9f6c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/620810c0c654991d839ca6867f2a46041d960f58b0b11177a779d12328ac868c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/6267ab1336aafd579bbd273fd31c9295b26bf466250d524ffc1fe0f9a7fb0531.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/630413a3c3413763b5083d06962c6c0c15106b62db1fa419e94866adb7023aeb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/636fdc077a60d50b2b6ddbeb3806a6895ce46c5d73a938c5ffad50292257b250.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/6370b7e6d83128a75d405c48fd4d520ae8e05b2722bdf8051542af81cc78ff9e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/638be5ef90cb7ac086f963e9bca35549da9ec49b2a224cb53ddfb49d7e294cb5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/63ed0804e4b98b1e0e1ff7551371972dbb3fe0a8c66bf2f2de034c088ea3c66b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/6419873dea28853888a7b3c3bfc00b65bc0828d4337d5340dc40de5e9d541b81.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/642e8b0cc7c5612df0a44fc226ba44bb5b0dfa5a2d3bc1967e81df3e63e815e2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/64492425b7f6a9d82f5d534e5747308c12217740fc5c7ecfcd781d67fab96872.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/644a0611f67758cec00b57586b40e09abbb125dc8a7788dbd701d0218c644c69.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/64556a8141c256e55b6870cc9f62f3c27f0efbe2ca217bc13ef08bfc71d6e90e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/6473131c5b8f906f82fa0b83891cdaec83ccd19bb1915420e78fee4a023d4d0e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/64b5d3490731e5835db2d907abef852e1f357fdab7bcf2d650940a89f04792fb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/662c09f8f180ba91d8486ccda57889664bcd7e66c7457b82d7b1ab70d555485e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/66546b812a554c5e6d4f3be6da2a5fd2c8ac0d82fa2f69d4a2fb1b2a7814d0f5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/66be662a03cbf1abe197ca113f6d3aa41c8fea918874595aadabfe812207bb3b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/66e9d33c28e61eb5b4623ebf0d000279adaf01a9aec816e57696a39f512f093e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/67c43b0c65104dfe6b10e64c153b25b7b54ac631c61add15e79a68d7bc65f2c4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/68b55673f734cc1744e9f1f8f1d3e327d928b0fe2f916d17021ed1530385b967.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/68ff941b9d3b7ef7ee7bf7552a148a0b8da12a7dedeff2e6ab085db31ddca2c5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/69200199a64e36e8d248e1907abfc9fc69339d2849920cba76f57c2a3d5fbac7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/694f93349224648912ef8bd5547a8857d7087fb1c7bbbe9e4dd703ee4b60ea0f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/69dad1086c17cf1e76b06627e688c650e1cb69f8331c452588af2184abcb0397.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/6b16fed2ae43dfd39fe77de8ba7c2f28724f861db1963d61cfa768ad6c99ccc0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/6b85cd4485d398094da4267e3d2343cce62cf3b8c78cc733674c02cf2a1cab27.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/6bb4909a11dcf89e34e55141035a8a92513180941076aedfced45e3b886f5f7f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/6c5f0e695a8b2dd8adc0d2fb484e7995149068737e2ab505af51be2bca758fbe.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/6c60f966622ba818efd5abb7666184842abe861acad56fb500a59035ca85fbcf.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/6c8734e4d181afd00507b011c836edb4642fe7947ea9826e3fdd250caf7d9b5e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/6d035e0bfafb9a57ef13d6e10404c086abc729432005c256ff53bb3b600c05fd.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/6e746acedbdf074bde1058b018a82e359f94a794a38171bfeefc140377fc4f3b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/6f55ce3d4d416e9b2c30510a8becc3c02d2115fa9553cf27db10281f61be7e01.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/703e008d91a78604927122a369c65ac588da3389c672dd7d75dc4a147642b1e7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/70546bdf74ce3bf19afc3dc3082a7094f7f2be6221232a881e4ee766dece4cfb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/709f45c625ca60d84eddfe1428932f070707d75ede17553b6809de627357afac.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/70c395166ccf2c80108f6fc2fadc3760dd0ae99ed864a083bc89ee21f0a200dd.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7140ee981917e3eff2a72623f5fb72b4cdab4b49a3d07403e19c411325f21cf2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7184e2fb2fba5107c115cf7467f5c4b77d0e09d3119792ba67b6f8d2d53d0620.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7263daa107d02f129851004692e9a64bafe0ad4d0559fd4ab47f5ef447944959.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7298ca3729a65254aa658d84fc340627d41ce77a0b599acac10e09bcb2d5215b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/731a3c61ab1ca1efc29817b540ab0a4c4844714926b2ce79d523f4976b1b9fcb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/731b5ff7e6c34bea248936f0c71cd4942a975dce1e3ffebb2b0f0641c09d961b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/735980f59c7edccb2dbe4379d20a893bc2bad8fcb063c1dc4dfbed210c711a7a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/73ca847fc87994d0a8a6db27cabbc37f903554121da6cb51ac93667f06648393.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/73f0e4061647f8080971dc9328b7c3d4e7f0cd4858e50c8ceaed7ea56f5c49be.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/74116bfa32e0f5063994f869033bc2d45c6dcf78f66d0f907d099ec3a38cdc2f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/748708357265a9259821e8f38ed97e57b38f0a78d1c3cbd50b1929c678ec8a8e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/74d02665e047c14d30fbb205cc4a9002b4b417eef85f39367bf8286a1304f01f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/74e83b2e2c71b9a2f079dc8d4ad4b81911c89624c0d200e6f55e3a43cc3177cd.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/753b2f17a6b8369b8ad426755929a8ddd574ddd92fecc1af8e71295bfa1411f9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/75420225dfd537b8d1ae041db664262afb7253be2906fbed131060d8acec1756.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/754d45a483ddcaeea1332e60e5b0a0646ec020c72c727da63f4174301b513fa0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/755eba963b8b5912b6be14d10d28812b08c653643b2bdd1bd87f9b09bf98ea9b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/75c249bcf2a883392f52f528071e834ce7f9efdf036bccb935d9116594eabc40.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/75e5009c7a419f9a689d84f8fd8062b238e062805a8ea6bfa0b1d85acd0b5419.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/76032338a324bfd0bb73a17e5aea77ab309cd0e1dfb25e0da1846b025cf1fdf6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/763a47aea26680034b5eb06bd88adf030a0008af792d20a3108700cf1d44dc2c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/768388773ac3fd5383e3400772f45496e9f012675c5302aedeac431b78e1d4cf.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/76bb339568c0d7a66373b0350ee1ec00312c4090e2b89c8718d4f9ad911479ea.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/779c781ea96d7bf28e249fdde19605e148cabdd2b33de698f6bbef32e64f8b79.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/77e68d285dd7ecc1e9d19b5fd563f526251ac17d001ceb4760b8d6ab504c697f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/784b6437799672f2436518394664ad3c8cb17a7dd42e92a8ef643cd1959534fe.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/78b7a803676c3c05a9e56351dcb588923613b03c91eb18585dd4f4ba334dd426.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7919ff3dbaaaad2a687db5727e22780cc748b5c95f62debcc345f4e73f7509e4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/796b534e75aa769a362019732351259031a9b297cec4acf07619c158f2bd5548.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7a61de01f670c78e66e3b74749aa2e81743e4823267b2b22712c696400b01cff.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7aba1a7917e6e1c45f2736cd1d60c3876ef007154984949c99006d1e6f693b4a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7b03c29f663308b9c71660ee849e875d4d54e38f0aadc1591a9ca06203d730bd.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7b16128095b7cb74240d322a4fcb987a6f5eaf96958d6c8e7473c2f1a80a612a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7b4968d58c84dfbceba216e98b77946412ddfaa72153143324af641f486e328d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7bddaf37e49232e86590a8f4f17f353c0a6eb96998ceace669b8616e39c58cf0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7be74cd68310bde29f69147dcd73bd842d9e10156f4ec0885605f23e95035bd8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7d1255e083ed5f0b8175f943ed26084e25512cd03a5a04c23924e4b5519e4fde.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7d25c6d4c3fc4bbe510e3a91b9f5f34de4cfab551812325f7c0e7a06b8814a8e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7d2c3b4308a491f32a60a4df260971bc49d57d3a55908379398b8bf8a8cdaf42.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7df96e59bb7a5edfe9064be2b6313a27dac44020637e4a9747fa9db0d760df7a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7e6c7b91f2ab7fd6cdae6d0cf15b2820a0db79eff671460622624a58594fa974.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7ec1b7078c44b92355d48b95fe52fcadcc36b2bf5a5687940ca40426468c9ece.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7edbf4143f7dd27c0285d2e13d3e0a8efa804ab0e7338d30bd932bcd7a4b505f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7f0217d5e9fcd9c8f4331439b11b9ed2a2d9b5d707d434926471a213fdf3ade0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/7fdf9a27075ad1a52a075a1f454d780d2f4822bf5af9611071d67f7784de1408.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8043a3df6b189994c409674cdac340ef5e46fde6ef7837032a3325526fa0598f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8182a2382dfa02ac48a5b54ee4085d2e3afb6bbc2b030ccc7730462c82846710.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/81f5fe2a83a9fe6841419f4e0b5b82c977795444b5e03ec09b0f1bb9426446bc.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8268fe38976aeb16c643b18c216b06cb2c4d2ccdf60b65261a9dae89f9ce5d43.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/82fd91807ca96ee7cd4c5876a703efd4fbccf50949f9c1cf4e6ebb914d9c9614.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/82fedc5cad4660766f83eb5e9b2dc1bb73d1ff45c507936d87a5fa236af37271.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8305d904ee29992713ce7f22d22eeb82239d1c570c53eea94bf9b6a35d01776a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8385f73ef9063e476f54501c48a835ffc76cfae8b02a6055955f16b2dd1d51dc.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/83b93f2f637604cd67b17dee083782a693a70a05168beff51236604499db07d9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/83eff0ece2a10a5e521a80e6e7393d3be5fdfcb0a4ad0d2a7cc1342bf121b5ba.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/847197c0ff464dfc3114e7cc77b3cc09e5ec54b5afd6901afa9288af58766519.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/84c426a2532925368e0498bbdd67dc3d82080d502c852bae825b80e18a16e046.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/852e7107c456d560884db7360524105a02391c94e2b5504aa0c69c8306918736.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/85b3284a30406861ed0e479da539c346428c2d80b67663647d275e17e9708b3f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/86de84d7fbbecc3958832239127a292d4d510613c8d3b9a47a70ad980b903c79.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8702146daf7bd9182a2327a6b5f4bacd84b0bd3c8c2e021239fed57b01308f32.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/875bc5494477a1fb8c6c72dc31bc98648084574e9e2d2bb751dc9383680124f2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8803ab6aed4c96c099dad8f5641c1d90d30bef69bdacc997ff64a99e38f3ada1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/88092e12eb9cb7b2bf65bc5ad31b204915a0b7d7325e1f7e92b161998af18323.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/88845f405a56e298e53d5b48b4659b0ff7396276cea664f1a6ba367bdb47fa6b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/88dfa35105091054be2e945ba6df690b978ebc210b47aa5a34b846edec537e80.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/890ec0cbbeb22c75d5316798462186992a3bda6b098b6bc2db24f26e9bbb4945.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/89bcdb88f7117ab8f06946696c6b37084de995c0104e265010c60bd0cdeeef3a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8a27540b8b864b7d0a4cbc1bd709cd62787228aa12d4aaf345ad4a19875afbc2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8a4c2c7cc4256bd91847a6c4ae299081c7cf432388f2a4a9d12ff55aef6587f9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8a617324abef8ec94e51a8a8acda711d24a7aa13dc46f36832596cf925e2f0e4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8a729623093702a0711f9134bad0302b170b4a1f7adae98d4acb0602e222d73e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8b65e991491ab8315b166e90819e858b6375ee79c901b6fdf0f119103a04b036.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8b72705e83306165e711acbe034702d8b992852fab7e0ea9b0df26fd645bac90.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8c00412a2decde0a2b09a8b14b363ddb31a27fa1c59b0c4d82404d832f65c859.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8c045c068e0d75d4e3a287f0d86f64d9481f937b929f50f9354b8a9a37d0e662.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8c8f6928a57f1db8266ed8b700645f2ec6b780ba72e6248dd78bf8311a8b1441.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8d071cb96a4319410e5a2056a0b37fc8c094bb9a2c37174af56e856ae2fe604b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8d436b971d421f7f564f52d90884c3409f2c60d4195a53431f972536401a2427.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8da86aa4cbe8e862c38d91598cda907bf4547c6db793d21f2fb2720a9fa5720f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8f1c171d01a4835f637014896e5102a52678c8a6bef2dad5a4b9ab0a6703a46a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8fd159ba3eba9b458ba1d88d0843cb8f887d21f2ded379de1dd8ac9a918be085.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/8ff93c6a86c0bbeaf85537db3f6874b0eedb0950f66840802438ac7dd16cbe97.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/90726982e18c60d2c97686ee58e31821722148873b35f6379ed7ee58e2199244.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/90937582e74241358da20c1bbbe3cec2260cd7773b3d3f82052a9cc0375326e0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/909e0ad99fbb60ddda9169a539f904be96c2b31d37a2d3e81beccd063820afd3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/90a0e2cbfbf72853d97747a16d1a54c4ebe66ffa3723b9a01e5378718476bbc6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/90dedf26a5196ad4c9dbcb0bc42b164f8c5e3b399a7880fbb3a9eb53187823d8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/90f1f52ccfaff1852b8d1166abb515d4006ee2aa508d86e2f2c5ad26ad94153f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/91202b5b3c88e3f0e33c4c8c77f32734bed0d0d95600b4e7fb30b4434436d44a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/916958b214cf47b51a3b670cc37bea520e81a8685fde8a62c1e0839b1210494a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/91d6c5ee1c600fc29257b4a39770090fa4be91a6dbc8ce01ad01a5e279846bde.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/92c49aaa6bda7985a24f46f9fbb49b3ea61934e34118483e9d29e0713efa8d63.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9318de578aef18816bb051e206fd6ee4f98476c6434d53f1eee323b0cd12581d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/932bfb6b88c60266b284538c2ba7b70f23e6acbba8986d0f19c5773b7e9ed675.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/93583466baefd314e489c6526855d73d1142e014c31949e2577994cda20eeced.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/944d0389cf01027be5a4d49562fc29b4205cc7c290f2db5f20582d45944d9b20.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/947be6e1fdd114802fa2700d2b73c7b127d1dfb8734f2f8531bb6c7a1928ef37.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/94fd81e282407dc148393bfcdc7a5927126c7bc60d522f9d87a577271b6e6083.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/956ea396ec6c13ea97ed011c1fa35dab986f8d869927235a368934a8d7c32891.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/95bdc72608ff7ac779ff40a56de9fcb17b85014686715573470b15d904852f10.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/96b6e79f93f5a9e5860dba7db4dd1b98e853bf36f625afb4785cd7de204ef947.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/970244087bd2dd4c0b9ef2005cca55ef097b11111d5d764b912e47415a3608fd.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/97065cadc68e1f9db468ed5642e4e15a08434ad575922f463314023412880e55.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/97528d21cd8491f6d2d50ce52a2f3683c2ce61cfd16bf0934a51ef6fe121faf3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9758b1b4b9d014da6782abf3238bfe68c25cbb47b8513c5dccc28ef6cc356c1f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9785f98c227c6f06063f1b567b6cd37b9fe6d681768035e81140d6be5a4661ed.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/97c113a73b9e40352f15d9a8a656ecf9fd0b37390e9d097295fecb8ca8804243.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/984ec80fa04ee8f3af165b721156c8940a485a776be1d25431d60f4a9b78cb3e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/98695bef47ffd010b13a0aefbeb59fc14e04ae81a7b1f3201d47479267a68d9a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/99003d75fd8c3c22a0181d6a84cbe83ed94cee163b154cd4f01e56d9aebe37a2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/993ea425022046423b4ca0e93ef9671cedee8e9ec65bd2d9921376fd0d492fd8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/99536fcd90705416ad28eef802d74f968c70b0112cbda3d0caa9406d0377d0cd.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/99f53193cc1ce34405e4373cb7c2ae188bab7bda6681d5dfc557191e8c9c65ce.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9a3c7920723fcbeebb6a92c2f959e419e877948619c475d0903cd36738ad6596.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9abdb7a829554f8b1eea59ba8dfb01f024430f850a493ca5a17936b11d7b17ea.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9ada7fe3e0469ec4664e78407bd7986220075f5b3655caaaca389eb1a423eb47.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9af27dcdb8452545e4ba2e19eabc5abbadac36e296e9766368371a2d9e5cd536.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9b28767d17dc43acb6cd0d6b35daf143ca6b44b97ed13f7778e090ca65b7eca7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9bb7e672ddd37bf6ea4b2801edde32547b35324defb08d60768277a05dd3f867.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9bd6abbe81873dd51546aabd9183b2120440f5c226757994b2b884228cc4eba4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9bf3c4606226345a447be183a7734174b47d1bbef1008b9e87ae0409855b6225.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9c33a0997a87f10482455f479653f04202638fe6e661a51a62165a45b6aeab80.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9cdc45a086c11d7db480306bebe303193201b44e538cb3c2c417c623a62eb38a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9d1584cfbb865e994672ce087396b0981d70a35a52e846aada71a408789f75a2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9d448031a6615bb88d65494e9030fa115f711c580fe27386e278e88313399c20.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9d81c4bab62be67929b6f1298e9ac642f03f04d6fe6aa25929dd3206a6117dcb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9dc1741b3391f7371ab2621cf82214620dcc24df2073c712e5d0e6cd26ef6d8a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9de6b4180677ff60a19c432b31fd1a3157beae4f1bf5c26e3318c6109b2b51d5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9dfd813d1a2abf61fc8a01d2989788200ee50fdef8e3a12dbcf423a570d05f86.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9e5516d86795af901f8246b72fe450167cab22681c7ceaa867e2c698ff82dd2b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9ec325253ef5ede63627cc47f196c6c6341a5d0f713f3cea6157b41d76d6ce32.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9ef89c66b2401c66fcf2296cb84647009e8bdef7ebdb64913484b50346befdbc.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9f1942e90d39188e680dc287049041818f0182fdb2631eb09ac83f70407993ea.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9fcf95fe87aed8acd87c424687025d7594bc25c21ab7d9f5c06993e5d8861e29.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/9fe1b4c92ea6794a27a9c31f2d7b786f94233db3feed914b8b54fe8a6d9f70f1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a08152df7e560c047f4feb15fa443deb90da9dd762e990ab8c8a5fa08b12e0cd.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a1daed63f02dbf6a8d1684432ec5bf91db1c91b3c241cce12b7a4ef47fc2b71c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a2366249ff8c94196615b4a2c494d4ac2e5c60f1ae0a3d2f6f24d01b43b7cd11.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a23680cc43fe565fa95afaf5b4b281d9b3f477dad46a4db137c104db5ef2a012.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a2958b1a84014da9c26af2f06024f27a1dab2ec2b224a7a0f702c5d32f23b6ad.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a3b6857391637409345665f1b4f529f0fa9a300a4a9c8427a199e7fa137c5c9b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a44e1cb0aa466e52a8120eed46bfe49ef6c765a06668deb9a10db2154e176e45.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a4a8e48ab6f0cab0c0e01926cf29959ff2ea3b05a240ee4d5c62f386cdce9196.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a535248780592826ae47144d0999166799c4369b88d26397142c0007edc2187f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a56c19ad34ae27a0fa539aacd48241e1f9ebde76a2732bb3355eceaa45f1b387.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a5892d7e56b2b76c7567357a6b4a2e63078bf183e8a46333b41b04ce7d352636.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a5fad4c10962f875570edd28e8bf07dd8e1d7569f8838c14c85885cb261b8d26.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a61944ef7e5251276212bddc897c741dfb072b181f7f54a780857e5db27beffc.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a61cae1c7171adf8e29539f67a3ed780703689f911e9499ca350a77e449d480d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a61ed8352b3f435c63d6c15b19f2d0e18345bbf89dd29a504d79beb145fabe81.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a623407d9a43c43628f17d2305e9f6fdbdc1065e8fcb884ec1bc767339da3151.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a67d40c84e0b32a7afed286e64bb9fcec37a3896796f11a90f3a119e30191e2f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a6d7e3fc4ee40273f92ad89cce1970dc8030fdee6a571df6c05e77e15f26e844.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a6ed10aca6dd4b6a1fd5b4b4c0912b4e7dae7cdf43ee6ca1ac9f148e0cfefdc8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a719c64930405e6c42e302e0b82334ef61aafc4248fb8a674bf3594e7fbabd6f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a72952cd1affa714f52015351d2a82bd27b07671d2c4749603460d70878d59ae.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a7c3963a13af015b9e64c0133b06d3489872495373ba80a6d63da9bede4e5608.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a80dcb26e11cfba0515662b9e29a8c6f898efbfea304485f32981351bbd23536.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a82c32ec1fc9c7855a036920669643e41f037294ae0b20b309e62cfcf6be12d0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a9103d3d4a9e62eb2b2748c4af004fc0ffed62f224c1ad836b47a1447a50dbfc.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a99d1d3512649ddd7d76fd3db8d1e2d41e02a8b4d0ae7ea54b9fd059e1ab7b52.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/a99f251f6cd8a65ab74527d1a375de3ec9a8b71173fd757a7693962d3b078f7b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/ab40c8e0e9fc249dd9764e4f203ac51f5c05db7a24f15b1a8b31eb2a3fb7f4f2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/ac1e2b85c4b64d18b59c3fb28c61fee100c617e50e3fd8ce9dea2de6ba388338.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/ac399d10dc65c209d39b289432c4c4baeee194174ba8bff4fd44b0ac98ff1668.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/ace21acbae32caa85e56fe30df9e38369a90aee3763b63e42d1cf7ec26a4fc77.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/acfc61ee474440bec8fb3771648f2fdf0f13b9fa9fee24eed55952c5337a58ff.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/ad0933b88107e967ec169862a094dd4207dcd3dd16f0e69eb21f8427a4fb158f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/ad21c2d01175a19226a6373f5e4c48df1291db4c6e2cf1e7c7bf7295d9a7aefe.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/adb92f620f6c11a2cbfe2c6ee53118d462f55bf61234c0fe3b7e55662e44bb96.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/ae66ea059c9a4f3339533ff32ce31f58a2ff7ace5dfc9092284230248533cd56.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/aed7d5cbf476b76b922925af61685e54d5aebef6f882099b59166877378fa396.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/b0bbf2e167176cb9bf90689121bed60867a061ff82e7826eb521e12decb6c3f1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/b0c472cfc2829247446db51e65013364d18bcda5ab7e51b3f3df64500159b171.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/b12afa7862d90838b68a04d116bb235316c01468cf5e0e6d17d20fa0019a225e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/b12e40991bbbe787538f95e1bc8bd7ba8be9cd5251fde84673e8dad9e5353dca.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/b12e6f221faa8cbd88e627be38dfcd79832ab36fa16b45eb9db497f3bb591000.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/b18699a77aeb1a7474157cd681af6a0cddadac50cc16052b834c4325f5e76fc1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/b2090bdccd2200db84b79eef9179bef2e508f187fb6aa14a64ae9cc16fba512a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/b2a8bfaa6e87ffeeb4d055f2949ddf755578da779aad4025d5998347ce32f73f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/b3b4d2b0d3f0f24d9fcdd4c160ae90beb1b2eaf6466510f43b145fe58873d67a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/b3c24b48321b7bc34e88a709c2e9197bcaacda6156e451bc298f8a9f1695bee7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/b43070b8e7c0037d35ab48bc7d23238d0a58ad381bed8586a689f2f90a69b55b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/b45811c9ce53695cf08803348aff2e062f04cb5b2a013b36e78e5da969fad338.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/b475d53ef7d0c7b982b5f1201e61edbf3019c0b7acd1c4e72eb84279d8fd40a4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/b4a971fab0f6b2cb07e0a887ef9a84d2b63e486394de5836ffcc8ed52bab9eb0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/b4e0e60a2aaf4a13f6ccfcfd0a64fd4eb5022d4e6aaaae0678912296d3fa87cf.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/b66905319873c530e1c6276120f3659c45ab6677e095a34ee2010baf581698ca.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/b714eaee98c8d712f84ac0c532c39a28cc34416c33c17d43c5ff2b8b4ec44bde.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/b887efa2510a55ba227f7097cda8379109840c38bedd1a49838022b4b4f6ce0f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/b8daf388b4144d2b09c02dbf483ff142c4fb297bf5ccf9dff0e58a17f8e9c77f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/b9fab83453feb3d1c7aab9d66c548e0b9e08d18e58d2a6c4473e4496d4c2a105.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/ba16e65de0b94903490f3bc68cba2e6bc5d61072ca995731fd0532f938caeb77.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/baf36bdd4387b11e86b0847ef262fb251bbb8778bc69896ade4b32015019944a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/bb44da6aafa79faa6a985e6d115587e68a280832654290d1729db91006ea7686.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/bb65cee6f2c5c06515c039cd4e9b78795d46c5c9f04800ab5f6b113dcf96ad80.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/bb74119feb0536c218c019d462cbb316a7c779aca7ae309ed6b5c4d920b09b02.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/bb84afa7444c27b35e833309752ed978161f7201f26e953863f5dd0937e8c2b9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/bbc445b3dba82d062dc3fc8de5701816df8bc38ddd0790ee294af15214b5c65b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/bc43a1de969e34c2e8607a1986311deb9fc80d0613ccace59f9df55a2cc5f3f0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/bcade69f7cb15946d34b21317d54082d3696a518bd479d6469d5b4efffe5a287.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/bd75c0cf6e99fce53a323a24ce9d374800d2b9755e83722c1557d923bea7870b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/bd94b1fc200d8d435205c3dc1f1f1f23acc8b7b285e97e78226fb46a1872aa93.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/bdeaa12bd9b96fd7baa57824fc035ec682afe560abcd724594f3e1e8f52546ad.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/be0fee57c43b6e88618cb417bc9d68bd2531d081dfb6f4f8c87a9fec93b450cd.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/bf05ec09669ee62551cf03339995f5abc47f813483e9dbbc9cb87bfa16f68d4e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/bf8ad92b4e72b17c23d2c1e4a32bda54b06cfb42751d558eeb1be41ce090b3d0.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/bf9364fb9b1a3eb53541848408122180889277b59eb68541972fd50f6b801e70.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/bfe614ae81a43450bcd0899de296a9a2288203f3e6dbf34060d61f3e34d9a980.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c010acb2d881213236f0f02e02b0a666fc580bd2f584c745a94803ef8de28ae4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c0cc6ba04197081a48680c8ae1146ddb024988a89777cd669bb163f98c846533.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c34bed51e5da47c8ebb25b7bac109f34e35cc4db1eff5012bc8461361d4a95dc.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c3a77ab76676f19debec95e08ce1696951dfd90ff9fc2d45e5125be3cd3deb16.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c483c3a91408f480492c81ef1a3afc766462058f717fd4d9d43fe713540289eb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c4b3c3ee8a8d036fc57dcafe7aec77ea715764d3c51d4be45362658300a8bbd6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c4de486a5b8cf200977871d4061d5616e5a3e8731353b1adb7cfd095c25ef44d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c50d456d9eca6dce9af6db788993d2eb9f48985e74eafefe936edd42291d1cbf.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c50db09f4a0f5f981c4d024f044cef900b593a53413ce84bcc7ce2d835b351e2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c52d04a1a9457743fb4572179967b67ac83c581ab580ceec68fc983ff5ef5a74.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c6337bfcf2539a225495b5becb9440d59b7b02cb384b093944967666422e1fab.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c648098188e485e12c97ea426bdabe9b7ec9a726a0005380090286e7fee4d39b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c648e3f6e667fc022bb94ce283b5f8d068321c5ef4197c7cc3dc909f323e7885.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c7c22ecb7c8bd28cc07d7acb504f130cfd19253d90f4f081ad4e6433ddf2b39f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c8119b12b3839fcedc5ee33287f13f478b5878c1708a5746774c01f3b60c53f8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c8140a28d003b86551b0c6ab5742c49a6a002a8e23c91b0fa81f0549a23268eb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c831de2e722db00e582f6ac20b64a8becabe681a3dd317ea4415946a285d9491.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c855c0808a6764bcb1258cecfdcf9baafc10656183ba09a0aaac7247505283dd.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c89075a808e79fc377cbc01f2141faa0d2b5a1b106531fb36ea7b14220d3285b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c8aa6651428c59619fbd52422e9fd6c09c48e90560d68ed3457174fe14541b48.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c9b8833cf9269273223e1a5d636719b118b06a71d771396411a1ccf6b680ae8f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c9d15d41b12f356fb41322cc50481ed59b399a859b8368935151db859819acd3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/c9f5354dde2a7bfc8fb2d27e7b9b5b4309c3f7467b1452c71e301abf1a6714a2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/ca2d045c000fec4c42be13ffe585b076cfba12ed744ddb7523e66d6cf8fec6f7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/cb1641b127cd3f65d508f4efc3b4a06aeccf82e5cd1ee77e0ec5c222b6f5c1be.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/cb1e4f47351b4bc38a6fb45a1fc88879d7ba65b91f0e2fbbed6abaa0f6369a44.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/cb8f39873116f5ebcee10229fdf3d0503fd01da49e14da67b93e9c1a92470590.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/cbf6a831d1423c7a46a4539bc3c213b4be3c15a851cfbadcd402e2467dc10a80.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/cc05b1f74fc479b06684232ed83518af1ccff6d9a6484b54ba8fdf3174598477.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/cc6b4df9c460480a90d97222a197d9194a9c3ed1b3f07facbdfe49bae976c9a3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/cccb8ea101864cf0547a0d43bd8c63864d32656fed70a9c2f48461baba025ede.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/cce1170154ed47ddd6cbe182543f7e5f93b86f2a154009bc42d3ef91cbc0c0a7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/cce539b179665615380d6ba209b086560150a3f8c932184e3aff0c671f6ffb60.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/cd249f84aab496dbe74e761f1de1b3cad60b85f405f062fc657dfe89069791a8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/cd55c9d9edd3ecd378656ae77323d1deb0f31d4a15c85950c5b81bf8ca89eea6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/cd5d4fa556ec97f79fe687612a52fac2ae73d45cf9f676940589e9ca893031df.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/cdc97b8ccc5614976fba0c1ecea69d3eec7bcc6010daf5955a0ebd3eb25e6479.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/cdccc6513e30fc5e7bd3d59c35cf407d131ce58b7d67eb4bcbb80f98437a167c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/ce6d2fbd0d5f71fdb7377d88640443b99da910aff416c56f94c3d2f4cf3c19c6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/cfcd6d663836405051f91502adc1ae12dd6507d71c36efdd0e3d657daefde212.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/cff6fcc88fbc7d6e2375c9080da8a52ebdc57c2dbd64d09c5410d970c83c66f2.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/d19ab8b57bc935847d3b08bad87288ee9a06e45d84725d882ca028d8fd6219b1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/d1b570e35abbcc20ce69aa94825ec0ffcfdf69123ad8344c48ebacc37d597880.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/d225aa13eac0a7fd53e8e6cab13f978728e4a7cc6a35a0a92ca93d9b5f3fdee7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/d32d1fe0424a2ad37ed8b413dfb69fcc5c0743bb78f8f417d92832518fb9c112.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/d34ec41a31aefbc87e75d834b63c99321511b0e44c1b8d23b3bcf3073d5a6613.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/d39bfdc86ebbe4edc116394dec228376a1fcad0ba3024134d4591a6384f7fb52.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/d4471f0b4b224a2c5299762572f3db2eb8947ced9c6e383c5ea9cf5310c43a76.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/d48291fc3ccdea8025b3d64869a69a9c661c44fcc2ed60d4fcb6d5b258bf4f09.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/d5a72307e1d7747ffa61607fe78e8cec8cc9cf983757518a8eec9759ec41f2a5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/d616f07f74755f5b26935b73c99afac07f22a87d0dbe479b54371014f689b439.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/d7753d488a0488ab08370b797b27b14aac507f170bbc7e197b71a69af47dd385.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/d7c8b34b77037ca5550f8842f3cdae7eb834449655b57d49ced9bc9c93a59e8f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/d8d3db586b30b835f6ae1461d667101e33b67ca737ff66c2b76b0e9b4cc1b6de.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/d906445f9fbfe77738c3d95f25f12282e3f5f309f6385e2295c9bf4010174dc6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/d91fa69b1e334cb787fa242058eebccb90ec8ad9040b98d6f7c074e2cdbf2f84.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/d9933193744f4a17664acaeda0d869564653e8b39de35fd47263538f4032d527.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/d9bb23a1fa260b326daab89db5febd9a55528d4c3b1a2f38db38d24bb9e664af.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/d9d450318131a45d94dc7a1fdd62b94419f823206fb869de4e57a5295d237570.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/d9de0c364b4d8edf8c16499491d9259e7d0698b13b62466420be9ae4f34b2bd8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/dae1f60b4b3fd27ae662bf5c6120782d38b982f334b32c81abd8111d872645f8.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/db12f8aca59d6e7d5b3cb1e0b883319a2a281cb9d99c02075380fd11ba0207ca.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/dbdb7688a4a8ecf7411b3621953a2da9da4df7919a034340570da556009c7adc.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/dc441bc5b6ed5a96dc547d6c605de1a7bb4dfd1adf9ff30e879563ab4f969eca.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/dc78b459d6b03cea125a920035c36be0d8b233aa1ceb41a1cc83763bb0279af7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/dd08e0c1521463c77bd27adf933a7658915edd7259ed3efde3fe30e087c8e1b5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/dd10998dfddec51bca751e72f1a720351bf4d152765f4cd35550ea6ec06df6ff.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/de0c44f2c74038c772d98af4ee0a33cdd823afe8902e58252962b820f9b9757c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/de7c84c9033da6e481d23d0ce2ebe57e961dfef249ead955115f2f0902920f22.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/dec31b46e11a9f81194610f56f6a7f4652a3c136b822557aeb5ef01936b55a30.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/df16ec83fb9eb0e85b50d14871396cecb09cf53e9f94a8e4826a8090dc990c9a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/df1d37f495aa2f6c4c2527e7ca4b7fd33c287dd4a09f57721b6b07ee5e72a660.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/df222aed329f10d20ab6f983f171f9833c6867f6c967286cf3863bfd502ecbf9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/df33e41cc25298e3138896f673c13ffb360f6254097b6bcbe31c12a9a38aefc4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/df4db1dde5ab6f1e3a262fe851ecd40a1f4aa6a93085e5c882ea3cba40cd1896.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/dfb04dadc45c6048c6b8f7e75c59ebf05cc24f10c4090327549a4020d174a2aa.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e03d556f386a1f594881dcad1115faf6d6e06838c8cd54c6b5b9702a2b49ea33.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e0447f1463ba210637225bde0264ddb7ebc18f94cdb313c18ef6dd9842b1a14d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e0e1835014035eecaf4d121d38f2144102e9411baf424d0025c5a9d3582104c5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e174e5fb935250a13756f68760d25652cbeaf7afbe7707ec76c7b8a0dfbc9d48.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e18ad5087675d4be0dc8e8937c4024ef8f90ac9ff089f5f802b8ca30392db996.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e1b86fad82f996fca5b9d5706ba9add209aa1f1ddca245da87477987de718775.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e26b003546916927e42dc730d4c114768b6878151fbc2144bb5ece71170981d7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e2a8db21faf2726f78ea5249e6a539f70d3905e00c3997208603f93cbea506df.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e2beac5d4a2b4bff494f2cd75c9ba59805d011a41e7733828d5035132178f856.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e2e1adab58e3c7f0d03cde27e6edfac95f6d92e4d36c5b50819a4906ca7d1c99.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e2ead293e751d780944791d1e08f66b82b7c0342d3e473ac24f5e745cb6d803b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e3738f240a30cf19fb3e8d057c66c6d1f2a74a8abb52aa784666d53f1ed9ce75.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e3920b0216b0f1e57544696f42f0170229ec34179c368ec3eb266c856d5c72cb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e3cc6443669217d57512a2762d43edf044034b09c7d3120ccf1d296a9db4713d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e4f3f27b60d9c2be6806dca136b3995aaeedd14763f740d480467791ec01c52e.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e5a327d02f790875fedf1a875c1f78912ac319bd6b81e33bce63fc2790111df1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e6003be2d81f08d882f3481ead985cb97b893ba6412ae2ccdbc9bddd7eacb9cb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e600f8c83e6d7cb4bb9b0f72be9c4338c52889889ba833ffa3a17b1226863d57.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e60889bb52d250a0572cc40de109558275be6038f6d9ae6ae95df2a8a1872aa9.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e64827743ff69b950448c1e8707145a19f3c92fffb1c2bed475d8199e274d043.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e69f178b853201b55a78e09199f367f0db8483e855bd382ab0f6ea4bfa844732.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e78849d6e9d04ce8158775767d8a87a534ed0fc513900476767e3c74496a3f6d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e80d594191ac1136eceb7a3590b451cf410bac0616194ffb5f49c75be9aebc3d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/e9c46c72d9c64d756ac91f0fa8cfad9c547e16a3737791c26683b377259a2f0f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/eac6cfe0b885683f387930a18ca85db8e55c3bcef83178e255955ab60a90d237.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/eaf7a9bd0f032829e8b5d1054d34bac19c9ec0303d6439f68c80ffda20ece997.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/eb288e0bed6dcf63413762e3ac0f4632800297ba3958fddd53f49c8dd29f99d1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/eb2a0f049e9c4f5f0e71d19093f289d328e9a575ea93e7b63efab7f0c0b6e367.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/ec8af3e32106325d839cbcb893989ef32179587d27e206e436783a8e9a692197.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/eca0a97efe2a61fde372b1d3d506b3b7f86678693174d2765ac61d671813e843.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/ecb0664517ff2d56dceb6b1fee3716566f0f8ca675c850d66d826a3f2c7cf764.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/ed555503112b65c7f2c0c11d0ac25559d2f8dc491d4db4cf49f70410d96b0e81.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/ed64db594e4b32ad643a1af1dcb67a010c49bbb1443933dd361e4a34098466a3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/ed8247d8525349551accacaf24dc74c42c582063108a517ceeae951f7aea26d7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/edabdb3f5267f4760df58e9386d7cf0eeaf42ff8dd2a089a84595a00daa52fd3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/ee7090beeb1ede7a8c0ebc65fc3a78f7f7f47195deb767cc6b17539a7bd73a2d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/eeaf9c82efd9905c7922aa0a08f3fac6d7d746443038797b99608d0f3bb3b9e7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/eeb8492142c16532df758c06143a7450f078b549077c62cc1e56b46aa1746fe3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/eed55d42eddb6c2758e9b5d8da54e391a5ccd3277169063c2481f4a6157d8fe6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/eee62e6d230aa7c2c7b5bd71fe2c674448f42ea8e9d13760c751902bbb9281eb.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/ef926c25687999dc73557dde7a0971067b5dab16bb21d9e49e4c6c5e3e2677ec.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f057106da98b6e306b4ffa33cf4be0eba70de57d76e5ef1ec6235a80913c88b6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f1d45ef421d02823551490094f5256f488855783e4ae4788155e829de5ac49ca.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f1d7eed81b3b8abed9e5715f5686126d8c1e48bb4da2d18ea93af16b5bfd0cb6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f1f1c0017cc5e7b8196a70b489ad0f8e4c81c52d221fbad9c7e502230f4e0946.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f221a3ed7d458d78373e74e4262df835ccf88b440e36ab16a45191725a65a450.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f29594d62ae82032fd3910163c275dfa0a92c37921b29b0eb285f5fe5a037fe5.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f2b2d0ec05dda3ba3a2e7056439dea4ce7e5b012adc19e927ace5283b5bc8e90.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f335435ba9d71a7d7fd13c7b41cdcdfba9574dd5879dfa0234005ccfac7a2d5d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f34688217bb21ec69c568a52bd59181c4b9d07b91ab35ddfdcaf65c881cb47f6.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f38c82a0dad6e1325557fa709ee3276a8decca2f936ac9ca228872dc9a0b3b7a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f3ecc99986a4a32b0c2a2bb84049a3d5cc02158f8b561c1cd46458e0c8500b2b.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f4460e0dae66d74ef359783cf42aec1eb9a6bfc24eebfaaab3bff5e871ef7384.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f4a47df5a8006454e9a5adbefaa80f69859f15bb0a902dce546e8388c073fabe.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f4fece1f5a2289b26fb418c3b76d0556f7800e795d1007f429be96ad5753bc65.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f5196530a90509edc79375d9c9750353f00b6742a6829a1d7ba0eaec8d50164d.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f56fdc76593905e95e0449ad0d22f2d7bb0d144ef8b7f6dba0681c4731f2bb27.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f594d6dbc64b9ac2949990b76f2de342e1e57f9bd49f28bdb2347deccb322d47.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f5d8699e5bcbd2af79d8874cb83da5e0d99b9826544ec5e1f3a8c6bb74d3f258.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f6a59e893fc00f3b65946d4a041ca8d801c82da3be9da2122b66417efe572c75.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f6e725766a210e0b0b0c960c10ff3223cd173674ef9dec926dfe96b32145ab71.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f6ee5a386999cd0d13c93b5515c5ad7ddef95bd39f17268effba456f165bf27c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f711edaef9c428c0527b078333356230a07043e7b1f02270225cd35efed106d7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f7430f80b0d98490522f5bb4b3b6e217f08743cfe2998072d33b895e81ec92b3.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f75497352dd657524380207b9324c33dff5835dac633cea8a38366b2203e5dd7.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f7a7bf06366c539f0b169de72c4dbc29ba6f36d1cb05363909a075a83a6b019c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f7cdbc47ea6bc80382c0288c4ccd997c15039108be17ad7fa080ee5bf2e1cf83.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f84288f67e54a4a1474be17a7a87d3cb3904f11d729970abedc1f073f22dbf6a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f873ddddbba040542010959fac2f036fe15cc83359137aa02814a4c42e516f69.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f8fef2cfe2c272b068373cea67d8aeb3be1355c30f1000522036c38aa3bd94bf.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f9597a78e5578bd04f633d829e0ed7bef261e8f975b33c906c887eb5d0148318.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/f9a1af2cf2fca5fbc9a82b0cdc91e47f1597085fa43ea40633f3f853ff54950c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/fa0de7682996eeece6dfb2a29eb3100d9cb4f81461b749ca485880fb9e6b5bb1.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/fa706219d7bff83b1008b6511f5a22abca488ba378291fdeb27e8d2861f8c368.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/faa65bf813e0d4e52063d5e46fec00df3c8e3afc1950dcb76760cdfd21dc9c71.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/fadc6bbbd4d3726b7ca3cbccb1b10a4ca8e8a93215363eaebcef36697c09fcbe.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/fb1ea75b4f2ad694010a064ae9e9531888f658032c5480ac65251d441bd3e64c.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/fb43b85f77a4eae554ae137fbef8848fa527e28676211070ba91c65038c12168.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/fca1a91abf9ec234eaaa8af2ad119ead6553ca37baac0750d04b0c688385238f.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/fdbd16d258f1c7b29972485d677b800d476ee8a6a637bc4b46c29829713f3272.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/fe043120ed75a0da6f02ddeb1e6f39cbe7b67d5ddea6daae4a7f51833de591e4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/fe27445a8bd9c4d04402cf40e320c47d01f362bae1e3b75d6eef0cc4752307f4.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/fea8e7283c860ee5cc6725883e09aa2be4c0cf02e828f479e9f5794692f18370.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/fee39aeec8955652b961269926e88946df3f9c916d42e05324148100db4d2e61.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/ff2248a39d24b7b7d130f30d75b1ece0ce6fe6472b5351dd2fad294e031b7525.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/ast/v0.8.40/ffa041a085d8eceaae39e061bc7ed0ebd4a031a5ccd0de0ecbd9f103f48e867a.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/cache/stat-index.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/graph.html` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/graphify-out/graph.json` | Graphify knowledge-graph artifact for Skills tree. |
| `hyperframes/hyperframes-animation/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `hyperframes/hyperframes-animation/adapters/animate-text.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/adapters/animejs.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/adapters/css-animations.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/adapters/gsap-easing-and-stagger.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/adapters/gsap-timeline-and-labels.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/adapters/gsap-transforms-and-perf.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/adapters/gsap.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/adapters/html-in-canvas-patterns.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/adapters/lottie.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/adapters/three.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/adapters/typegpu.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/adapters/waapi.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/blueprints-index.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/blueprints/comparison-split.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/blueprints/constellation-hub.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/blueprints/cta-morph-press.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/blueprints/cursor-ui-demo.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/blueprints/dataviz-countup.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/blueprints/device-surface-showcase.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/blueprints/grid-card-assemble.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/blueprints/kinetic-type-beats.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/blueprints/logo-assemble-lockup.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/blueprints/overwhelm-surround.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/blueprints/spatial-pan-stations.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/blueprints/ticker-takeover.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/blueprints/titlecard-reveal.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/blueprints/typewriter-reveal.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/blueprints/video-text-pivot.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/examples/assets/avatars/02.avif` | Binary/media asset (font/image/audio) bundled with the skill. |
| `hyperframes/hyperframes-animation/examples/assets/brands/github.avif` | Binary/media asset (font/image/audio) bundled with the skill. |
| `hyperframes/hyperframes-animation/examples/assets/brands/nvidia.avif` | Binary/media asset (font/image/audio) bundled with the skill. |
| `hyperframes/hyperframes-animation/examples/assets/brands/visa.avif` | Binary/media asset (font/image/audio) bundled with the skill. |
| `hyperframes/hyperframes-animation/examples/assets/brands/zoominfo.avif` | Binary/media asset (font/image/audio) bundled with the skill. |
| `hyperframes/hyperframes-animation/examples/brand-reveal-assemble-zoom.html` | HTML composition or demo page. |
| `hyperframes/hyperframes-animation/examples/comparison-split-cards.html` | HTML composition or demo page. |
| `hyperframes/hyperframes-animation/examples/concept-demo-decode-pan.html` | HTML composition or demo page. |
| `hyperframes/hyperframes-animation/examples/cta-morph-press.html` | HTML composition or demo page. |
| `hyperframes/hyperframes-animation/examples/cta-orbit-collapse.html` | HTML composition or demo page. |
| `hyperframes/hyperframes-animation/examples/demo-page-scroll-spotlight.html` | HTML composition or demo page. |
| `hyperframes/hyperframes-animation/examples/hook-counter-burst.html` | HTML composition or demo page. |
| `hyperframes/hyperframes-animation/examples/messaging-multi-phrase.html` | HTML composition or demo page. |
| `hyperframes/hyperframes-animation/examples/metric-video-text-pivot.html` | HTML composition or demo page. |
| `hyperframes/hyperframes-animation/examples/problem-mockup-overwhelm.html` | HTML composition or demo page. |
| `hyperframes/hyperframes-animation/examples/proof-logo-chain.html` | HTML composition or demo page. |
| `hyperframes/hyperframes-animation/examples/takeover-ticker-displace.html` | HTML composition or demo page. |
| `hyperframes/hyperframes-animation/examples/workflow-approve-press.html` | HTML composition or demo page. |
| `hyperframes/hyperframes-animation/rules-index.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/rules/3d-page-scroll.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/3d-text-depth-layers.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/ai-tracking-box.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/ambient-glow-bloom.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/asr-keyword-glow.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/avatar-cloud-network.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/camera-cursor-tracking.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/card-morph-anchor.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/center-outward-expansion.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/context-sensitive-cursor.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/coordinate-target-zoom.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/counting-dynamic-scale.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/css-marker-patterns.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/cursor-click-ripple.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/depth-of-field-blur.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/depth-scatter-assemble.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/discrete-text-sequence.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/dynamic-content-sequencing.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/gsap-effects.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/hacker-flip-3d.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/kinetic-beat-slam.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/motion-blur-streak.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/multi-phase-camera.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/orbit-3d-entry.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/physics-press-reaction.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/press-release-spring.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/reactive-displacement.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/scale-swap-transition.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/sine-wave-loop.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/split-tilt-cards.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/spring-pop-entrance.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/stat-bars-and-fills.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/svg-icon-enrichment.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/svg-path-draw.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/vertical-spring-ticker.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/rules/viewport-change.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/scripts/animation-map.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/hyperframes-animation/scripts/package-loader.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/hyperframes-animation/techniques.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-animation/transitions/TRANSITION-REGISTRY.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/transitions/catalog.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/transitions/css-3d.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/transitions/css-blur.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/transitions/css-cover.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/transitions/css-destruction.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/transitions/css-dissolve.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/transitions/css-distortion.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/transitions/css-grid.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/transitions/css-light.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/transitions/css-mechanical.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/transitions/css-other.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/transitions/css-push.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/transitions/css-radial.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/transitions/css-scale.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-animation/transitions/overview.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-cli/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `hyperframes/hyperframes-cli/references/doctor-browser.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-cli/references/init-and-scaffold.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-cli/references/lambda.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-cli/references/lint-validate-inspect.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-cli/references/preview-render.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-cli/references/upgrade-info-misc.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-core/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `hyperframes/hyperframes-core/references/composition-patterns.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-core/references/data-attributes.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-core/references/determinism-rules.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-core/references/full-screen-motion.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-core/references/minimal-composition.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-core/references/script-format.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-core/references/storyboard-format.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-core/references/sub-compositions.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-core/references/subagent-dispatch.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-core/references/tailwind.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-core/references/tracks-and-clips.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-core/references/variables-and-media.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-creative/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `hyperframes/hyperframes-creative/frame-presets/biennale-yellow/FRAME.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/frame-presets/biennale-yellow/caption-skin.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/biennale-yellow/frame-showcase.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/blockframe/FRAME.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/frame-presets/blockframe/caption-skin.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/blockframe/frame-showcase.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/blue-professional/FRAME.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/frame-presets/blue-professional/caption-skin.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/blue-professional/frame-showcase.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/bold-poster/FRAME.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/frame-presets/bold-poster/caption-skin.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/bold-poster/frame-showcase.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/broadside/FRAME.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/frame-presets/broadside/caption-skin.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/broadside/frame-showcase.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/capsule/FRAME.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/frame-presets/capsule/caption-skin.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/capsule/frame-showcase.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/cartesian/FRAME.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/frame-presets/cartesian/caption-skin.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/cartesian/frame-showcase.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/claude/FRAME.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/frame-presets/claude/caption-skin.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/claude/frame-showcase.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/cobalt-grid/FRAME.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/frame-presets/cobalt-grid/caption-skin.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/cobalt-grid/frame-showcase.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/coral/FRAME.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/frame-presets/coral/caption-skin.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/coral/frame-showcase.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/creative-mode/FRAME.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/frame-presets/creative-mode/caption-skin.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/creative-mode/frame-showcase.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/daisy-days/FRAME.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/frame-presets/daisy-days/caption-skin.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/daisy-days/frame-showcase.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/editorial-forest/FRAME.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/frame-presets/editorial-forest/caption-skin.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/frame-presets/editorial-forest/frame-showcase.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-creative/palettes/bold-energetic.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/palettes/clean-corporate.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/palettes/dark-premium.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/palettes/jewel-rich.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/palettes/monochrome.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/palettes/nature-earth.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/palettes/neon-electric.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/palettes/pastel-soft.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/palettes/warm-editorial.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-creative/references/audio-reactive.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-creative/references/beat-direction.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-creative/references/composition-patterns.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-creative/references/data-in-motion.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-creative/references/design-adherence.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-creative/references/design-picker.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-creative/references/design-spec.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-creative/references/house-style.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-creative/references/motion-principles.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-creative/references/narration.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-creative/references/prompt-expansion.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-creative/references/typography.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-creative/references/video-composition.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-creative/references/visual-styles.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-creative/scripts/contrast-report.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/hyperframes-creative/scripts/extract-audio-data.py` | Utility script for media/audio processing. |
| `hyperframes/hyperframes-creative/scripts/package-loader.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/hyperframes-creative/templates/design-picker.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/hyperframes-media/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `hyperframes/hyperframes-media/assets/sfx/CREDITS.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-media/assets/sfx/manifest.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/hyperframes-media/references/bgm.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-media/references/captions/authoring.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-media/references/captions/motion.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-media/references/captions/transcript-handling.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-media/references/remove-background.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-media/references/requirements.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-media/references/sfx.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-media/references/transcribe.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-media/references/tts-to-captions.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-media/references/tts.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-media/scripts/audio.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/hyperframes-media/scripts/heygen-tts.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/hyperframes-media/scripts/lib/bgm.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/hyperframes-media/scripts/lib/heygen.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/hyperframes-media/scripts/lib/sfx.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/hyperframes-media/scripts/lib/tts.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/hyperframes-media/scripts/lyria-recipe.py` | Utility script for media/audio processing. |
| `hyperframes/hyperframes-media/scripts/wait-bgm.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/hyperframes-registry/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `hyperframes/hyperframes-registry/examples/add-block.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-registry/examples/add-component.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/hyperframes-registry/references/contributing.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-registry/references/demo-html-pattern.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-registry/references/discovery.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-registry/references/install-locations.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-registry/references/templates.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-registry/references/wiring-blocks.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/hyperframes-registry/references/wiring-components.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/media-use/.gitignore` | Git ignore / keep placeholder. |
| `hyperframes/media-use/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `hyperframes/media-use/scripts/eval.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/media-use/scripts/lib/adopt.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/media-use/scripts/lib/bgm-provider.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/media-use/scripts/lib/brand-provider.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/media-use/scripts/lib/cache.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/media-use/scripts/lib/freeze.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/media-use/scripts/lib/heygen-search.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/media-use/scripts/lib/image-provider.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/media-use/scripts/lib/index-gen.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/media-use/scripts/lib/manifest.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/media-use/scripts/lib/manifest.test.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/media-use/scripts/lib/probe.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/media-use/scripts/lib/probe.test.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/media-use/scripts/lib/providers.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/media-use/scripts/lib/sfx-provider.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/media-use/scripts/resolve.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/media-use/scripts/resolve.test.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/motion-graphics/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `hyperframes/motion-graphics/agents/builder.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/motion-graphics/agents/director.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/motion-graphics/agents/finalize.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/motion-graphics/catalog-map.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/motion-graphics/categories/asset-fusion/module.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/motion-graphics/categories/charts/module.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/motion-graphics/categories/kinetic-type/module.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/motion-graphics/categories/logo-reveal/module.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/motion-graphics/categories/lower-thirds/module.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/motion-graphics/categories/maps/bake-basemap.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/motion-graphics/categories/maps/module.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/motion-graphics/categories/news/module.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/motion-graphics/categories/stat/module.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/motion-graphics/categories/tweet/module.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/motion-graphics/categories/webpage/module.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/motion-graphics/grounding/PROTOCOL.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/motion-graphics/grounding/locate.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/motion-graphics/phases/source/guide.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/motion-graphics/references/builder-contract.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/motion-graphics/references/motion-vocabulary.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/motion-graphics/references/shot-plan-ir.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/motion-graphics/samples/asset-fusion/_ref-circle-highlight.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `hyperframes/music-to-video/references/frame-skeleton.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/music-to-video/references/montage.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/music-to-video/references/motion-primitive-catalog.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/music-to-video/references/motion-primitives/3d-card-flip/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/assets/gsap.min.js` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/music-to-video/references/motion-primitives/bg-flow-field/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/binary-decrypt/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/blur-resolve/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/braam-punch/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/chromatic-split/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/chrome-sweep/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/counting-punch/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/crash-zoom-in/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/datamosh-smear/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/directional-fill/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/dolly-zoom/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/electric-arc/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/flash-cut/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/gooey-metaball/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/hard-cut/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/hypercut-whip/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/iris-open/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/kinetic-letter-in/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/liquid-morph/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/mask-reveal/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/mosaic-pack/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/neon-flicker/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/outline-to-fill/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/palette-flip/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/particle-burst/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/pixel-dissolve/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/radial-burst-lines/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/screen-shake/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/slot-machine-reveal/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/spotlight-sweep/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/staggered-exit/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/text-spectral-rays/USAGE.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/music-to-video/references/motion-primitives/text-spectral-rays/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/text-wave-distort/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/tile-mosaic/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/typewriter-reveal/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/motion-primitives/word-grid-burst/index.html` | HTML composition or demo page. |
| `hyperframes/music-to-video/references/planning.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/music-to-video/references/storyboard-format.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/music-to-video/references/template-catalog.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/music-to-video/references/templates/card-flyby/index.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/music-to-video/references/templates/card-flyby/program.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/music-to-video/references/templates/held-message-living-field/index.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/music-to-video/references/templates/held-text-strobe-burst/index.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/music-to-video/references/templates/intro-kinetic-cascade/index.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/music-to-video/references/templates/intro-kinetic-cascade/program.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/music-to-video/references/templates/logo-split-lockup-pulse/index.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/music-to-video/references/templates/poster-tile-mosaic/index.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/music-to-video/references/templates/poster-tile-mosaic/program.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/music-to-video/references/templates/roll-flipbook-word-cycle/index.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/music-to-video/references/templates/split-anchor-word-slot/index.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/music-to-video/references/templates/split-anchor-word-slot/program.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/music-to-video/references/templates/typewriter-phrase-keyword-shuffle/index.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/music-to-video/scripts/analyze-beatgrid.py` | Utility script for media/audio processing. |
| `hyperframes/music-to-video/scripts/assemble-index.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/music-to-video/scripts/lib/storyboard.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/music-to-video/scripts/stage-assets.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/music-to-video/scripts/validate-plan.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/music-to-video/sub-agents/frame-worker.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/pr-to-video/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `hyperframes/pr-to-video/references/code-vocabulary.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/pr-to-video/references/cut-catalog.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/pr-to-video/references/motion-language.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/pr-to-video/references/story-design.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/pr-to-video/references/visual-design.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/pr-to-video/scripts/assemble-index.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/pr-to-video/scripts/audio.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/pr-to-video/scripts/build-frame.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/pr-to-video/scripts/captions.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/pr-to-video/scripts/fetch-people-avatars.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/pr-to-video/scripts/fetch-pr.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/pr-to-video/scripts/ingest.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/pr-to-video/scripts/lib/assets.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/pr-to-video/scripts/lib/dimensions.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/pr-to-video/scripts/lib/storyboard.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/pr-to-video/scripts/lib/tokens.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/pr-to-video/scripts/lib/transition-registry.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/pr-to-video/scripts/lib/transitions.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/pr-to-video/scripts/transitions.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/pr-to-video/sub-agents/frame-worker.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/product-launch-video/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `hyperframes/product-launch-video/references/cut-catalog.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/product-launch-video/references/motion-language.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/product-launch-video/references/story-design.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/product-launch-video/references/visual-design.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/product-launch-video/scripts/assemble-index.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/product-launch-video/scripts/audio.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/product-launch-video/scripts/build-frame.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/product-launch-video/scripts/captions.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/product-launch-video/scripts/lib/assets.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/product-launch-video/scripts/lib/dimensions.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/product-launch-video/scripts/lib/storyboard.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/product-launch-video/scripts/lib/tokens.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/product-launch-video/scripts/lib/transition-registry.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/product-launch-video/scripts/lib/transitions.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/product-launch-video/scripts/stage-assets.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/product-launch-video/scripts/transitions.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/product-launch-video/sub-agents/frame-worker.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/remotion-to-hyperframes/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `hyperframes/remotion-to-hyperframes/assets/.gitkeep` | Git ignore / keep placeholder. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/.gitignore` | Git ignore / keep placeholder. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/run.sh` | Utility script for media/audio processing. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-1-title-card/.gitignore` | Git ignore / keep placeholder. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-1-title-card/README.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-1-title-card/expected.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-1-title-card/hf-src/index.html` | HTML composition or demo page. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-1-title-card/remotion-src/package.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-1-title-card/remotion-src/remotion.config.ts` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-1-title-card/remotion-src/src/Root.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-1-title-card/remotion-src/src/TitleCard.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-1-title-card/remotion-src/src/index.ts` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-1-title-card/remotion-src/tsconfig.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-2-multi-scene/.gitignore` | Git ignore / keep placeholder. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-2-multi-scene/README.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-2-multi-scene/expected.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-2-multi-scene/hf-src/index.html` | HTML composition or demo page. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-2-multi-scene/remotion-src/package.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-2-multi-scene/remotion-src/remotion.config.ts` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-2-multi-scene/remotion-src/src/MultiScene.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-2-multi-scene/remotion-src/src/Root.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-2-multi-scene/remotion-src/src/index.ts` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-2-multi-scene/remotion-src/tsconfig.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-2-multi-scene/setup.sh` | Utility script for media/audio processing. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/.gitignore` | Git ignore / keep placeholder. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/README.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/expected.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/hf-src/index.html` | HTML composition or demo page. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/remotion-src/package.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/remotion-src/remotion.config.ts` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/remotion-src/src/Root.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/remotion-src/src/Stargazed.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/remotion-src/src/components/AnimatedNumber.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/remotion-src/src/components/StatCard.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/remotion-src/src/components/UnderlinedText.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/remotion-src/src/index.ts` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/remotion-src/src/scenes/OutroScene.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/remotion-src/src/scenes/StatsScene.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/remotion-src/src/scenes/TitleScene.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-3-data-driven/remotion-src/tsconfig.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-4-escape-hatch/README.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-4-escape-hatch/cases/01-use-state.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-4-escape-hatch/cases/02-use-effect-deps.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-4-escape-hatch/cases/03-async-metadata.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-4-escape-hatch/cases/04-third-party-react.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-4-escape-hatch/cases/05-lambda-config.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-4-escape-hatch/cases/06-warnings-only.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-4-escape-hatch/cases/07-custom-hook.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-4-escape-hatch/cases/08-mixed.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-4-escape-hatch/expected.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/remotion-to-hyperframes/assets/test-corpus/tier-4-escape-hatch/validate.sh` | Utility script for media/audio processing. |
| `hyperframes/remotion-to-hyperframes/references/api-map.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/remotion-to-hyperframes/references/escape-hatch.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/remotion-to-hyperframes/references/eval.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/remotion-to-hyperframes/references/fonts.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/remotion-to-hyperframes/references/limitations.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/remotion-to-hyperframes/references/lottie.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/remotion-to-hyperframes/references/media.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/remotion-to-hyperframes/references/parameters.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/remotion-to-hyperframes/references/sequencing.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/remotion-to-hyperframes/references/timing.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/remotion-to-hyperframes/references/transitions.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/remotion-to-hyperframes/scripts/.gitkeep` | Git ignore / keep placeholder. |
| `hyperframes/remotion-to-hyperframes/scripts/frame_strip.sh` | Utility script for media/audio processing. |
| `hyperframes/remotion-to-hyperframes/scripts/lint_source.py` | Utility script for media/audio processing. |
| `hyperframes/remotion-to-hyperframes/scripts/render_diff.sh` | Utility script for media/audio processing. |
| `hyperframes/remotion-to-hyperframes/scripts/tests/fixtures/blocker.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/scripts/tests/fixtures/clean.tsx` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/remotion-to-hyperframes/scripts/tests/smoke.sh` | Utility script for media/audio processing. |
| `hyperframes/skill.json` | Manifest: tools, baseTools, hooks, phases for the harness loader. |
| `hyperframes/skills-lock.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/slideshow/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `hyperframes/slideshow/references/standalone-harness.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/talking-head-recut/NOTICE.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/talking-head-recut/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `hyperframes/talking-head-recut/assets/vendor/gsap.min.js` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `hyperframes/talking-head-recut/references/DESIGN_INDEX.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/talking-head-recut/references/frames/clean.html` | HTML composition or demo page. |
| `hyperframes/talking-head-recut/references/frames/hairline.html` | HTML composition or demo page. |
| `hyperframes/talking-head-recut/references/frames/polaroid.html` | HTML composition or demo page. |
| `hyperframes/talking-head-recut/references/layouts/overlay.html` | HTML composition or demo page. |
| `hyperframes/talking-head-recut/references/layouts/pip.html` | HTML composition or demo page. |
| `hyperframes/talking-head-recut/references/layouts/split.html` | HTML composition or demo page. |
| `hyperframes/talking-head-recut/references/layouts/stack.html` | HTML composition or demo page. |
| `hyperframes/talking-head-recut/references/styles/academic.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/talking-head-recut/references/styles/audit.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/talking-head-recut/references/styles/editorial.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/talking-head-recut/references/styles/geom.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/talking-head-recut/references/styles/minimal.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/talking-head-recut/references/styles/spotlight.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/talking-head-recut/references/styles/swiss.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/talking-head-recut/references/styles/terminal.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/talking-head-recut/references/styles/whiteboard.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/talking-head-recut/references/styles/xhs.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `hyperframes/website-to-video/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `hyperframes/website-to-video/assets/sfx/CREDITS.md` | Markdown documentation / catalog / skill prose. |
| `hyperframes/website-to-video/assets/sfx/manifest.json` | JSON config, catalog entry, or sample data. |
| `hyperframes/website-to-video/references/beat-builder-guide.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/website-to-video/references/capabilities.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/website-to-video/references/step-0-capture.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/website-to-video/references/step-1-design.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/website-to-video/references/step-2-brief.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/website-to-video/references/step-3-storyboard.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/website-to-video/references/step-4-vo.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/website-to-video/references/step-5-build.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/website-to-video/references/step-6-validate.md` | Reference/rule doc for agents (progressive disclosure). |
| `hyperframes/website-to-video/scripts/w2h-verify.mjs` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `manim-video/MANIM-VIDEO-FULL-INVENTORY.md` | Markdown documentation / catalog / skill prose. |
| `manim-video/README.md` | Markdown documentation / catalog / skill prose. |
| `manim-video/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `manim-video/references/animation-design-thinking.md` | Reference/rule doc for agents (progressive disclosure). |
| `manim-video/references/animations.md` | Reference/rule doc for agents (progressive disclosure). |
| `manim-video/references/camera-and-3d.md` | Reference/rule doc for agents (progressive disclosure). |
| `manim-video/references/decorations.md` | Reference/rule doc for agents (progressive disclosure). |
| `manim-video/references/equations.md` | Reference/rule doc for agents (progressive disclosure). |
| `manim-video/references/graphs-and-data.md` | Reference/rule doc for agents (progressive disclosure). |
| `manim-video/references/mobjects.md` | Reference/rule doc for agents (progressive disclosure). |
| `manim-video/references/paper-explainer.md` | Reference/rule doc for agents (progressive disclosure). |
| `manim-video/references/production-quality.md` | Reference/rule doc for agents (progressive disclosure). |
| `manim-video/references/rendering.md` | Reference/rule doc for agents (progressive disclosure). |
| `manim-video/references/scene-planning.md` | Reference/rule doc for agents (progressive disclosure). |
| `manim-video/references/troubleshooting.md` | Reference/rule doc for agents (progressive disclosure). |
| `manim-video/references/updaters-and-trackers.md` | Reference/rule doc for agents (progressive disclosure). |
| `manim-video/references/visual-design.md` | Reference/rule doc for agents (progressive disclosure). |
| `manim-video/scripts/setup.sh` | Utility script for media/audio processing. |
| `manim-video/skill.json` | Manifest: tools, baseTools, hooks, phases for the harness loader. |
| `talking-head/NOTICE.md` | Markdown documentation / catalog / skill prose. |
| `talking-head/SKILL.md` | Skill/agent markdown instructions loaded into the system prompt. |
| `talking-head/assets/vendor/gsap.min.js` | Script or TypeScript helper used by the skill (CLI/eval/loader). |
| `talking-head/references/DESIGN_INDEX.md` | Reference/rule doc for agents (progressive disclosure). |
| `talking-head/references/layouts.json` | Layout/composition config JSON. |
| `talking-head/references/styles/academic.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `talking-head/references/styles/corporate.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `talking-head/references/styles/editorial.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `talking-head/references/styles/minimal.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `talking-head/references/styles/social.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `talking-head/references/styles/technical.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `talking-head/references/styles/whiteboard.html` | HTML template/preset/style seed for HyperFrames or talking-head cards. |
| `talking-head/skill.json` | Manifest: tools, baseTools, hooks, phases for the harness loader. |

---

# Part 3 — Cross-tree similarities

| Pattern | In agent | In Skills | Relationship |
|---|---|---|---|
| Skill identity | `src/catalog/manifest.ts` loads | `*/skill.json` | Manifest is source of tools/hooks/phases |
| Prompt text | `systemPromptCache.ts` | `*/SKILL.md`, `AGENT.md` | Markdown injected as system prompt |
| Talking-head | `src/tools/pipeline/talkingHead.ts`, `skills/talkingHead/` | `talking-head/` styles & layouts | Code executes; Skills hold design seeds |
| Edu-video | `skills/eduVideo/`, pipeline tools | `edu-video/` templates & SKILL | Same |
| HyperFrames | `tools/pipeline/hyperframes.ts` | `hyperframes/**` | Runtime tool + huge skill knowledge pack |
| Graphify | `graphify-out/`, nested | `Skills/graphify-out/` | Parallel knowledge graphs |
| Selfchecks | `*.selfcheck.ts`, `checks/` | (few) scripts under hyperframes | Agent owns harness asserts |

## Notes on completeness

- Every **non-`node_modules`** path under both trees is listed.
- Under `services/agent/node_modules`, each **top-level package name** is listed; expanding every transitive file would duplicate npm’s install tree (~20k files) without adding product meaning.
- Binary assets are listed by path; contents are not dumped.

