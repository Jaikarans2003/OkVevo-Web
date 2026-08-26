# Deploying the OkVevo Agent to Bedrock AgentCore

One repeatable command builds an arm64 image, pushes it to ECR with a git-SHA
tag, updates the AgentCore runtime **without wiping its secrets**, and smoke-tests
the result.

## When to run

Any change under `services/agent/src` (or the Dockerfile / Skills). The runtime
serves a prebuilt container, so source changes only go live after a redeploy.

## The one command

```bash
cd services/agent
npm run deploy:agentcore
```

This runs `scripts/deploy-agentcore.sh` (build → push → update → poll) then
`scripts/verify-agentcore-deploy.sh` (warmup then ping). Requires: Docker with `buildx`, the
AWS CLI v2, and AWS credentials (auto-loaded from the repo-root `.env` `AWS_*`
vars, or the default AWS chain).

## What success looks like

- Image pushed to ECR as `…/okvevo-agent:<git-sha>` (and `:latest`).
- Preserved-field block prints a non-empty `environmentVariables` (~16 keys).
- Runtime reaches `status: READY` (poll times out at 300s otherwise).
- Verify step prints `OK. Runtime replied: …`.

## Adding or rotating an env var

The deploy script is **preserve-only**: it re-supplies whatever is already on
the live runtime. To introduce a **new** key (or rotate an existing one), use
`--add-env KEY` (repeatable). Values are read from `services/agent/.env` and
merged into the preserved map before `update-agent-runtime`:

```bash
cd services/agent
bash scripts/deploy-agentcore.sh --use-existing-tag <sha> --add-env HEYGEN_CALLBACK_SECRET
# or with a normal rebuild:
bash scripts/deploy-agentcore.sh --add-env SOME_NEW_KEY --add-env ANOTHER_KEY
```

Aborts if the key is missing/empty in `services/agent/.env`, or if live
`environmentVariables` is empty (wipe-guard — never create env from scratch).

### Two HeyGen secrets (do not conflate)

| Env var | Role |
|---|---|
| `HEYGEN_CALLBACK_SECRET` | HMAC signs/verifies OkVevo's callback token (agent **signs**, Next receiver **verifies**) |
| `HEYGEN_WEBHOOK_SECRET` | Verifies HeyGen's own webhook signature |

`HEYGEN_CALLBACK_SECRET` must exist on **both** AgentCore and the Next.js
webhook receiver — local root `.env` (ngrok path) **and** Firebase App Hosting
(production). Same value everywhere; mismatch → agent dispatches fine, then
receiver returns 401.

`FAL_CALLBACK_URL` (public HTTPS → Next `/api/webhooks/fal`) is required for
`image_generate` / `video_generate` queue+webhook. Add with
`--add-env FAL_CALLBACK_URL` on first rollout; reuses `HEYGEN_CALLBACK_SECRET`
for the signed `?token=`.

## How secret preservation works

`update-agent-runtime` creates a **new version** and does **not** carry over
omitted optional fields. The script re-reads the live `environmentVariables`,
`protocolConfiguration`, `lifecycleConfiguration`, and `metadataConfiguration`
via `get-agent-runtime` and re-supplies them, changing only `containerUri`. The
~16 secrets therefore live in AWS only — never in the committed
`agentcore.config.json` or in git. The script **aborts** if the live
`environmentVariables` reads empty, rather than proceeding and wiping secrets.
The sanity-check echo prints **key names and value lengths only** (never
secret values).

## First-run canary check (manual, do this once)

The secret-preservation design relies on an *inferred* behavior — that
`update-agent-runtime` drops omitted optional fields — that has not been directly
observed. Prove it on your first deploy:

1. **Before** deploying, capture the baseline key list:

```bash
aws bedrock-agentcore-control get-agent-runtime \
  --agent-runtime-id okvevo_agent-HMRsX57MzN --query 'environmentVariables' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(Object.keys(JSON.parse(s)).sort().join("\n")))'
```

1. Run the deploy and wait for `READY`.
2. **Re-run the exact same command** and diff the two key lists (count + names).

Interpretation:

- **Identical** → assumption holds, the script is safe.
- **Keys present without the script supplying them** → AWS preserves them
automatically; the precaution was unnecessary but harmless.
- **Keys missing or reshaped** → **stop, roll back, do not trust the script.**

This catches a lost secret (e.g. Firebase creds) on a controlled run instead of
weeks later in production.

## Rollback

Rollback reuses the **same script and code path** (get-agent-runtime →
sanity-check → update → poll), so it keeps full secret preservation — no
hand-typed `update-agent-runtime`.

Find a previous tag:

```bash
aws ecr describe-images --repository-name okvevo-agent \
  --query 'sort_by(imageDetails,&imagePushedAt)[].imageTags'
```

Redeploy that tag (skips build/push):

```bash
cd services/agent
bash scripts/deploy-agentcore.sh --use-existing-tag <previous-sha>
```

