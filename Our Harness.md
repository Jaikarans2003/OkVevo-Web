Investigation only — no implementation. Several “gaps” in the prompt are already handled; one “fix” (AI Gateway as a model router) is a misread of the API.

---

# Full harness audit

## What this pass actually found

The last stretch of work *was* harness work (manifests, hooks, `requiresConfirmedFields`, run isolation, asset carry-forward, `run_command` policy). What was missing is a single pass against a complete primitive list. That pass is below.

**Three unknowns are now evidence, not guesses.** Two prompt claims need correction before any ADR is acted on:

1. **Vercel AI Gateway `sort: 'cost'` is not a model router.** It picks *which provider serves the same model* (Bedrock vs Anthropic vs Vertex). It does not send easy steps to MiniMax and hard steps to Sonnet.
2. **Talking-head card HTML is not a separate generative tool.** It is the orchestrator calling `write_file`. You cannot “route generative steps to Sonnet” without either raising the orchestrator model or splitting card authoring into its own `callOpenRouter` tool (the Manim pattern).

This repo is on **`ai@^6.0.206`**, OpenRouter (`@openrouter/ai-sdk-provider`), not AI SDK 7 and not Vercel AI Gateway.

---

## The five unknowns (reported first)

### 1. Context compression — **partial, not missing**

Two mechanisms exist. Neither is conversation summarization.

**A. Tool-result pruning** (`services/agent/src/messagePruning.ts`)

- Runs twice per turn: once on history + new user message before `streamText`, again in `prepareStep` on every step.
- Keeps the **last 4** assistant↔tool exchanges intact (`KEEP_EXCHANGES = 4`).
- Older tool results are replaced with a one-line summary **only** for: `transcribe_video`, `generate_manim_script`, `render_manim_clip`, `run_command`, `read_file`, `search_files`, `scaffold_hf_project`.
- Everything else (`write_file`, `extract_concepts`, `scaffold_talking_head_project`, `ask_clarification`, `str_replace`, image/video generate, …) is **left full-size** even in old exchanges.
- User/assistant prose is **never** compressed.

**B. Session token gate** (`services/agent/src/sessionTokenGate.ts`)

- Estimate: `JSON.stringify(messages).length / 4`.
- Soft warn at **80,000** tokens (stream continues; UI banner).
- Hard stop at **130,000** tokens: throws `SessionLimitReachedError`, **does not persist** the new user message, **does not** call `streamText`. Client maps this to 413 / “start a new chat.”

There is **no** rolling summary, no MEMORY.md, no Mem0 in the agent loop, no compaction of SKILL.md (the whole skill is concatenated into the system prompt via `systemPromptCache`). Long talking-head sessions hit the hard gate, not a compressor.

Thresholds are token *estimates*, not real tokenizer counts.

---

### 2. Eval / selfcheck coverage — **manual, scattered, not CI**

**No `.github/` workflows exist.** Nothing in this repo auto-runs selfchecks on commit or PR.

**How they run today**

| Mechanism | What it does |
|---|---|
| `npx tsx path/to/foo.selfcheck.ts` | Default. Header comment is the runbook. |
| `services/agent/package.json` `check-*` scripts | 15 named scripts (`check-tool-registry`, `check-soft-ask`, `check-render-idempotency`, …). No `test` or `check:all`. |
| Root `npm run check:env` / `check:fal-webhook` | Two Next-side checks only. |
| Next `tsconfig.json` | **Excludes** `src/**/*.selfcheck.ts` from typecheck. |

**Every `*.selfcheck.ts` found (43)**

Harness (`services/agent/checks/`):

- `askMePolicy.selfcheck.ts`
- `catalog.selfcheck.ts`
- `detectAndApplyStyleSeed.selfcheck.ts`
- `hooks.selfcheck.ts`
- `resolveOrCarryAsset.selfcheck.ts`
- `talkingHead.selfcheck.ts`

Agent src:

- `checkpointKind.selfcheck.ts`
- `editTargets.selfcheck.ts`
- `falQueue.selfcheck.ts`
- `finalVideoBasename.selfcheck.ts`
- `manimClipBasename.selfcheck.ts`
- `storageContentDisposition.selfcheck.ts`
- `taggedAssets.selfcheck.ts`
- `tools/lib/{cloudRenderFlags,ensureFullAudio,hfProjectSync,manimGuard,manimOrientation,manimScriptPath,normalizeElevenLabsTranscript,normalizeTokens,orientationGuard,ownedEditFiles,parseBrandColorsFromText,remuxMp4Faststart,renderSnapshot,resolveCompositionDuration,scaffoldInputDiff,sessionManimClips,strReplaceDecode,strReplaceNotFound,transcriptSanitize,transcriptStitch,transcriptionRouting}.selfcheck.ts`
- `tools/pipeline/transcriptionLanguage.selfcheck.ts`

Next:

- `src/config/env.selfcheck.ts`
- `src/lib/agent/{cleanNarrativeText,mentionBoundary,parseStatusMarker,sessionAssets,sessionBundle,sessionsPage,uploadAssetLabel}.selfcheck.ts`

**Inline selfchecks (not `*.selfcheck.ts`)**

- `falSttIdempotency.selfcheck()` — argv-gated (safe in the server bundle)
- `deliverEvent.selfcheck()` — not called at boot; `check-webhook-delivery` invokes it
- `mediaModelRegistry` — argv-gated
- `heygenWebhook` / `callbackToken` / `deliverEventParse` — via `check-heygen-webhook` / `check-webhook-delivery`

**Stale / drift (not necessarily failing)**

- `falQueue.selfcheck.ts` header still says “stated prefs”; the file no longer asserts stated-pref parsers (those were deleted). Comment drift.
- `HARNESS_INVENTORY.md` still points at deleted `src/tools/catalog.ts` (now `catalog/manifest.ts`) and counts 32 selfchecks; the tree has 43.
- Git status shows `src/tools/pipeline/talkingHead.selfcheck.ts` **deleted**; live replacement is `checks/talkingHead.selfcheck.ts`.
- `transcriptSanitize.selfcheck.ts` **skips** if a real transcript fixture is missing — a silent pass.
- I did not execute the 43 files in this pass, so I cannot certify every assert still matches current behavior. The inventory lag and the stated-prefs comment are the confirmed stale bits.

---

### 3. Observability — **skill.dispatch is not universal**

`emitSkillDispatch` logs one JSON line: `[agent] skill.dispatch {…}`.

**Actual call sites (only two):**

1. `buildTools()` — once per `runAgent`, when the tool set is assembled. Source: `new-turn` or `gate-stamp`. **No `toolName`.**
2. `dispatchHook()` — once per job-stamp hook (today: `on_transcript_ready` after Fal STT). Source: `job-stamp`. Has `hookName`, not a per-tool name.

There is **no** dispatch log on tool `execute`. A 40-step Manim loop is invisible except as AI SDK stream parts in the UI.

Also absent: `experimental_telemetry` on `streamText`, OpenTelemetry, a trace id that follows Fal/HeyGen webhooks (hook dispatch gets a new `traceId`; it is not correlated to the original chat turn).

UI-side `AgentActivityTrace` summarizes tool parts for the user; that is not harness observability.

---

### 4. Rate limiting — **does not gate Nia**

**`RateLimitService.ts` does not exist.** Repo-wide grep is empty.

What exists:

- `src/lib/api-utils.ts`: in-memory `checkRateLimit` / `checkGlobalRateLimit` inside `apiHandler`.
- **`apiHandler` is never imported.** Zero Next routes use it. Dead wrapper.
- `src/app/api/agent/route.ts`: Firebase auth + CORS + AgentCore proxy. **No rate limit.**
- Agent Express (`services/agent/src/server.ts`): `express-rate-limit` is in the lockfile as a transitive dep; the agent package does not use it.

Nia’s tool calls, Fal submits, and HeyGen renders are **ungated** at the application layer. Provider 429s are handled only as upstream errors (Groq→OpenRouter fallback on STT; Fal/HeyGen fail the job).

The session token gate is a **context** limit, not a QPS limit.

---

### 5. Current model configuration — **from code, not assumption**

| Layer | Who decides | Model |
|---|---|---|
| **Orchestrator** (tool-call decisions, storyboard, **card HTML via `write_file`**, planning prose) | UI picker → `params.model` → `streamText` | UI default state: `anthropic/claude-haiku-4-5`. Agent fallback if omitted: `anthropic/claude-sonnet-4-5`. Picker “OkVevo Auto”: `minimax/minimax-m3`. Also listed: Sonnet 4.6, Opus 4.7/4.8, GPT-5.3 Codex / 5.4 / 5.5, Gemini 3.5 Flash, `x-ai/grok-build-0.1`, `moonshotai/kimi-k2.7-code`. |
| **`extract_concepts`** | Hardcoded | `anthropic/claude-haiku-4-5` via OpenRouter |
| **`generate_manim_script`** | `AGENT_TOOL_MODEL` env, else | `anthropic/claude-sonnet-4-5` |
| **`vision_analyze`** | `VISION_MODEL` env, else | `google/gemini-2.5-flash` |
| **`transcribe_video`** | Language choice | Auto: Fal `fal-ai/elevenlabs/speech-to-text/scribe-v2`. English: Groq `whisper-large-v3-turbo` → OpenRouter `openai/whisper-large-v3-turbo` |
| **`image_generate` / `video_generate`** | Agent-picked Fal enum | Flux Klein / Nano Banana / GPT Image 2 / Seedance 2.0 |
| **Scaffold / render / plan_segments** | None | Templates, ffmpeg, Manim, HeyGen Cloud |

**Quality implication (finding #5, answered):** talking-head card quality is the **orchestrator** model. Manim already uses Sonnet. Concepts already use Haiku. There is no “scaffolding model” split. The UI default is Haiku 4.5 **even though that slug is not in `MODEL_GROUPS`** — a leftover default. Users who never touch the picker get Haiku for card HTML; users who pick OkVevo Auto already get MiniMax M3 for the whole loop.

`.env` has no `AGENT_TOOL_MODEL` / `VISION_MODEL` overrides in the names we grepped, so code defaults apply.

---

## Primitive table (re-scored against this tree)

| Primitive | Status | Evidence |
|---|---|---|
| Agent/Runtime | **Built** | `runAgent` + AI SDK 6 `streamText`, stop at 50 steps or `haltTurn` |
| Model/Router | **Partial, not empty** | User picker + three hardcoded tool models. No per-step router. Gateway is unused. |
| Tools | **Built** | `SAFE_TOOL_UNIVERSE` + `tool-meta.json` |
| Skills/Instructions | **Built** | `skill.json` + `SKILL.md` concatenated into system prompt |
| Context Engineering | **Partial** | Prune last-4 tool results + 80k/130k gate. No summarizer |
| Memory/State | **Built** | Firestore session, `scaffoldRunId`, asset docs |
| Sessions | **Built** | Run-scoped storage paths, gates |
| Artifacts/Workspace | **Built** | hf-project trees, carry-forward |
| Planning/Task Mgmt | **Gap for open-ended** | `plan_segments` is edu-video deterministic only |
| Permissions/Policies | **Built, underused** | `commandPolicy` schema exists; **no skill.json sets it**. talking-head omits `run_command` instead. Prefix allowlist is dead code until a skill fills the field. |
| Hooks/Middleware | **Built** | `dispatchHook`, phase `forceToolName` |
| Sandbox | **Gap** | Docker process + string guards; `run_command` does **not** even set `cwd` to the session workdir |
| Approvals/HITL | **Built** | `ask_clarification` + phase_gate |
| Guardrails | **Partial** | 43 selfchecks, not a suite; owned-edit shell block; proc-environ block |
| Observability | **Thin** | skill.dispatch on skill load + hooks only |
| Evals | **Manual** | No CI |
| Retries/Recovery | **Partial** | Fal/HeyGen/STT paths yes; `run_command` / `write_file` no |
| Idempotency | **Built for Fal STT + HeyGen zip** — not deferred | See below |
| Concurrency/Rate limits | **Not on Nia** | Dead `apiHandler`; no RateLimitService |
| Provider adapters | **Built, multi-stack** | OpenRouter + Fal + Groq + HeyGen + Tavily. AI SDK abstracts only the orchestrator |
| Config | **Built** | manifests + env |
| Skill Registry | **Built** | `loadSkillManifest` |

---

## ADR: Model routing

**Status:** Proposed. Do not implement until reviewed.  
**Context:** Talking-head cards are authored in the same `streamText` loop as tool routing. Manim scripts already pay for Sonnet. The UI already exposes MiniMax M3, Kimi K2.7 Code, and Grok Build.

### Options

**A. Raise / split generative work onto Sonnet already in the repo**

- Cheapest *code* change: point `AiStudioShell` default at a picker value that exists (`anthropic/claude-sonnet-4-6` or `minimax/minimax-m3`). Zero new provider.
- Does **not** by itself “route only card HTML to Sonnet” — cards are `write_file` on the orchestrator.
- To actually split: add a `generate_cards` (or similar) tool that calls `callOpenRouter(TOOL_MODEL)` the way `generate_manim_script` does. That *is* a new tool, not a router. Integration cost: one tool + SKILL.md sequence change. Tool-calling format stays Anthropic-via-OpenRouter. Reliability characteristics stay the same.

**B. Vercel AI Gateway cost-aware routing to Kimi / MiniMax / Grok**

- **Integration cost is not zero.** Today: `createOpenRouter({ apiKey })`. Gateway needs `@ai-sdk/gateway` (or `model: 'x/y'` on Vercel’s gateway), billing, and leaving OpenRouter — or dual-running both.
- `providerOptions.gateway.sort: 'cost'` / `order: ['bedrock','anthropic']` = **same model, different hosts**. It will not send step 3 to Kimi and step 12 to Sonnet.
- True multi-model routing on AI SDK is `prepareStep` returning a different `model`, or a dedicated tool. That works on OpenRouter today without Gateway.
- New providers (Kimi/MiniMax/Grok) are **already in the picker** as OpenRouter slugs. Adding Gateway to *reach* them is redundant.

**C. Status quo**

- Orchestrator = whatever the user picked (or leftover Haiku default).
- Concepts = Haiku. Manim = Sonnet. Vision = Gemini Flash. Media = Fal enums.

### Decision factors

| Factor | A | B | C |
|---|---|---|---|
| New vendor surface | None (or one new tool) | High (Gateway + possibly leaving OpenRouter) | None |
| Tool-calling format | Unchanged | New provider stack | Unchanged |
| Fixes card quality | Default bump: yes, globally. Dedicated tool: yes, locally | Only if you *also* change which model the orchestrator is | No, unless user picks a stronger model |
| Matches “easy vs hard” | Dedicated tool or `prepareStep` | **No** — Gateway sort is not that | No |

**Recommendation for review (not implementation):** **C plus a one-line default fix, then A only if cards still fail.** Change the UI default off the orphaned Haiku 4.5 slug onto a listed model. Do not add Gateway to get MiniMax/Kimi — they are already selectable. Do not build a router until a dedicated generative tool exists; otherwise there is nothing to route *to*. New providers only after a Sonnet-default (or MiniMax-default) run still fails card quality.

---

## Sandbox investigation (AI SDK 7)

**Repo today:** `ai@^6.0.206`. `Experimental_SandboxSession` and `WorkflowAgent` are AI SDK **7**. Adopting them is a major version bump, not a flag.

### What `Experimental_SandboxSession` actually is

A TypeScript contract: `{ description, run({ command, workingDirectory, env, abortSignal }) }`. Docs are explicit:

- Passing `experimental_sandbox` **does not sandbox the tool**. Tool JS still runs in the Node process unless the tool *delegates* to `experimental_sandbox.run`.
- A local `child_process` implementation is **not a security boundary**.
- Isolation comes from the **provider** (Vercel Sandbox, or something you write).

That interface is slightly cleaner than today’s `execCommand`, which:

- Does not pass `cwd` (so shell starts in process cwd, `/app` in Docker — the tool *description* claims session workdir; the code does not).
- Uses `sanitizedShellEnv()` (PATH/HOME/… only — good).
- Blocks `/proc/…/environ` and owned-edit paths via **string match**.
- Allows **absolute** `write_file` paths.
- Relies on Docker as the only real isolation (shared agent container: Manim, ffmpeg, HyperFrames CLI, secrets in the image env).

**Does SandboxSession substantially cover a future coding skill?**  
**The interface, yes. The isolation, no.** You would still need a real sandbox backend:

| Need | SandboxSession | Still custom |
|---|---|---|
| Portable `run()` signature | Yes | — |
| Swap Vercel Sandbox in local/CI/prod | Yes, if you pay for that product | — |
| Untrusted code, network egress, secret stripping | Provider-dependent | Almost certainly |
| GPU / Manim / TeX / long ffmpeg in *this* image | No — wrong shape | Keep current Docker agent |
| Per-session uid, seccomp, disk quota | No | ECS Fargate / Firecracker / gVisor / Vercel Sandbox config |
| Survive AgentCore 15-min timeouts | No (live handle; docs: do not persist it) | Already webhook + Firestore |

**`WorkflowAgent` (`@ai-sdk/workflow`)** is durable suspend/resume across process restarts. You already have a homegrown version: checkpoints, Fal/HeyGen webhooks, `pendingFalJob`, `haltTurn`. Replacing that with WorkflowAgent is a rewrite of the durability layer, not a drop-in for “coding skill sandbox.” It also wants Vercel Workflow runtime, which AgentCore/Express is not.

**Report for the coding-skill plan:** treat SDK 7 SandboxSession as a **tool-API adapter** to adopt *after* (or with) the SDK 7 upgrade. Do **not** treat it as a substitute for ECS Fargate (or equivalent) if the coding skill executes untrusted user-directed shell. Manim/edu-video can stay in the current fat Docker image; a coding skill should not.

---

## Planning / task-management gap

**Confirmed:** there is no generic todo/task tool. Skills encode sequence in `SKILL.md` + `phases` + `forceToolName`. `plan_segments` is a deterministic Mode A/C planner for edu-video, not a task list.

That is adequate for the three scripted skills. It is insufficient the moment a skill has a variable number of open-ended edits (coding, multi-file HyperFrames authoring, “fix whatever lint fails”).

**Proposed shape (review only, do not implement):**

`todo_write` — harness-owned, skill-agnostic.

- Input: replace-the-list, not patch-one-item (same pattern as Cursor’s list: fewer merge bugs).
- Item: `{ id, content, status: pending|in_progress|completed|cancelled }`.
- Persistence: session doc or a small JSON file in the workdir — so resume after webhook still sees the list. Do **not** put todo semantics in `skill.json`.
- Visibility: optional UI chip; not required for v1.
- Skills mention it in SKILL.md as “use the harness todo tool for multi-step work” or not at all.

YAGNI until a skill actually has non-linear work. Edu-video and talking-head do not need this to ship.

---

## Idempotency reconsideration

**The “deliberately deferred HeyGen idempotency” is no longer the live state.**

What exists now:

**HeyGen / HyperFrames**

- Key: `renderIdempotencyKeyFromZip` = `sessionId` + first 16 hex of SHA-256 of the **zip bytes**.
- Comment in `hyperframes.ts` documents the incident: tree-walk hash omitted `COMPOSITION_MANIFEST.json` while the zip included it → **same Idempotency-Key, different `size_bytes`** → HeyGen replayed a stale presigned URL.
- Fix shipped: hash the zip, not the tree. `check-render-idempotency` locks URL cap 32 MiB / asset_id cap 200 MiB and key charset.
- Upload path retries once with `key.r1` on `SignatureDoesNotMatch`.

**`runId`** is used for **storage isolation** (`users/…/runs/{skillId}-{runId}/hf-project`), not as the HeyGen key. Using `runId` as the HeyGen key would make every scaffold a *new* HeyGen job even when the zip is identical — the opposite of idempotency. Keep zip-hash as the HeyGen key; keep `runId` as the storage key. That split is correct.

**Fal STT**

- `falSttDeliveryAction`: noop / resume_only / wake_only / full.
- Wake claim is transactional (`falSttWakeClaimed`).
- Duplicate webhooks are handled. This is not deferred.

**Still not idempotent**

- Arbitrary `run_command`.
- Re-calling `render_hyperframes` after a successful submit with a *changed* zip (new key — intended).
- Re-calling it after HeyGen *lost* a job but the zip is unchanged (same key — HeyGen should reuse; if their store dropped it, you need a new key, which is what `.r1` is for on signature mismatch only).

**Call:** stay deferred on “use runId as HeyGen idempotency key.” That time has **not** come; the zip-hash key is the better design and already absorbs the incident that prompted the work. Do not reopen unless a new incident shows HeyGen dropping jobs that still have a live key.

---

## Disproved gaps (so they do not spawn work)

- Context compression: exists (partial).
- HeyGen idempotency: exists (zip-hash).
- Fal webhook idempotency: exists.
- MiniMax / Kimi / Grok: already in the OpenRouter picker.
- `commandPolicy`: implemented in code; unused in manifests (talking-head uses tool omission instead).
- RateLimitService: never existed; do not “wire it up.”

---

## Out of scope (untouched, as requested)

Sub-agents, supervisor, coding-skill *implementation*, bounded cross-session memory (MEMORY.md / USER.md). `eve` is not in this repo; reading it as reference is still reasonable, not a migration.

---

**Bottom line for review:** the harness is further along than a wall of red. The real holes are (1) no CI on selfchecks, (2) skill.dispatch not on tool executes, (3) no app-level rate limit on `/api/agent`, (4) `run_command` not session-cwd and not a real sandbox, (5) leftover Haiku default for the orchestrator that authors talking-head cards. Model routing and HeyGen-idempotency-via-runId are the wrong next builds.