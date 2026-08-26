# Skills — authoring and import

This folder is the skill package root. Each product skill is a subdirectory
with `SKILL.md` (required) and optional `skill.json` (OkVevo workflow
extension). `README.md`, `AGENT.md`, and `SOUL.md` at this root never go to
the model as a skill body: `SOUL.md` is persona, `AGENT.md` is operating
rules, this file is the developer contract.

The harness knows the skill protocol. It does not know any skill's behavior.
A new skill ships by dropping a folder here and rebuilding the agent image —
zero harness TypeScript edits.

## Package layout

```
Skills/<id>/
  SKILL.md          # agentskills.io: YAML frontmatter + procedure
  skill.json        # optional OkVevo workflow: phases, hooks, permissions, UI
  references/       # on-demand docs the model may read_file
  templates/        # skill-owned assets
  scripts/          # skill-owned check-* or helpers
```

### SKILL.md frontmatter (required)

```yaml
---
name: my-skill          # must match the folder name
description: >          # when to use this skill (model-facing)
  One or two sentences. The skills index shows this when no skill is active.
allowed-tools:          # tool visibility for this skill
  - read_file
  - write_file
  - run_command
  - transcribe_video    # tier-2; omit tools this skill must not see
---
```

`name` and `description` are spec-required. `allowed-tools` is the canonical
visibility list. A `skill.json`-only package may use `permissions.allow`
instead; both derive the same `baseTools` / `tools` shape.

### Edit config (frontmatter first)

A SKILL.md-only package declares revision behavior on nested `metadata`:

```yaml
metadata:
  editGuidance: ../shared/hyperframes-prompting-vocabulary.md
  editTargets: references/edit-requests.md
```

`skill.json` may override `editGuidance` or `editTargets.playbook` per key.
Product skills (edu-video, talking-head) declare these paths **only** in
frontmatter — not on skill.json. The harness injects those paths on a
revision; it does not keep per-skill playbook strings in TypeScript.

### skill.json (optional workflow)

Without it the skill runs open-ended on its allowed tools. With it you may
declare phases, JobCompleted hooks, resume force-tools, permissions, and UI:

| Field | Role |
| --- | --- |
| `triggers` | Substring match to activate the skill |
| `phases` | HITL gates: `kind` approval / selection / elicitation / tool_approval |
| `phases.*.resume.forceToolName` | Next tool on checkpoint resume |
| `phases.*.resume.gateIfMissing` | Follow-up gate when a confirmed field is absent |
| `phases.*.resume.injectFiles` | Session file heads injected on resume |
| `hooks.<event>` | JobCompleted: `continuePrompt`, optional `askPhaseKey` |
| `permissions` | `allow` / `deny` / `ask` with `run_command(binary:*)` matchers |
| `confirmedFields` | Session fields this skill's tools may require |
| `resumeArtifacts` | Restored session artifacts (`transcript`, `hf_project`, …) |
| `visibility` | `listed` (popup) or `internal` (building block) |
| `requiresUpload` | UI upload gate before start |
| `readyMessage` | Shown when the final video lands |

Folder names starting with `__` are fixtures. They load in tests and are
omitted from `Skills/index.json` and the product popup.

## Tool tiers

1. **Base** — filesystem, web, vision, clarify, image/video generate. Any skill.
2. **Domain** — `transcribe_video`, `render_hyperframes`. Any skill that lists them.
3. **Skill-owned** — `extract_concepts`, Manim tools, both scaffolds. Owned by
   the skill that lists them. Internals may stay skill-specific; the harness
   must not branch on skill id.

A marketplace skill that needs a **new** first-class tool ships a TypeScript
factory in `services/agent/src/tools` and rebuilds. That is intentional and
the same path the in-house tier-3 tools already use.

## Stamp trio

| Event | Stamp | Resume uses |
| --- | --- | --- |
| New user turn | `session.skillId` | Active skill for this conversation |
| Async job submit | `job.skillId` | JobCompleted hook, even if the session later switched |
| HITL gate write | `gate.skillId` | Checkpoint resume, even if the session later switched |

Never invent a fourth owner. The stamped job/gate wins over the current
session skill (async ownership). The drop-in fixture selfcheck locks this.

## Permissions

Declared on the skill, enforced at one PreToolUse gate:

```json
"permissions": {
  "allow": ["read_file", "run_command(ffmpeg:*)", "transcribe_video"],
  "deny": ["run_command(curl:*)"],
  "ask": ["render_hyperframes"]
}
```

- `allow` with `run_command(prefix:*)` is the binary allowlist.
- `deny` beats allow. Floor denies (`/proc/environ`, owned paths) are
  harness-global and not overridable.
- `ask` writes a `tool_approval` checkpoint in Ask-Me mode; Auto-Run never
  pauses (preference questions, permission `ask`, and any future
  `tool_approval` included). It applies `defaults` from skill.json, or the
  model picks from declared choices. No exceptions today: nothing in the
  current skill set is destructive or high-stakes enough to need a pause.
  Revisit when a skill can spend significant money, delete user data, or
  publish externally.
- Omitting a base tool from `allowed-tools` hides it. That is visibility,
  not a substitute for `deny`.

## Marketplace import (developer workflow)

Not an automated pipeline. OkVevo's harness differs from Claude Code (async
jobs, checkpoints, media tools), so every imported skill is adapted by a
developer. The adaptation should be small and mechanical:

1. **Refactor the package** — real YAML frontmatter (`name`, `description`,
   `allowed-tools`); map foreign tool names to ours (`Bash` → `run_command`);
   rewrite instructions that assume another product's tools; optionally add
   `skill.json` for workflow gates.
2. **Human security review** (explicit, distinct from `check:all`) — read
   `SKILL.md` and every `scripts/` file for prompt injection, data
   exfiltration, and destructive commands; confirm `permissions` is minimal
   (deny-by-default posture); record sign-off in frontmatter `metadata`.
3. **`npm run check:all`** — structural validation only (manifest schema,
   tools in universe, fixture invariants, no harness skill literals). It
   does **not** replace step 2.
4. **Rebuild the agent image** — Skills are baked with `COPY Skills ./Skills`.
   Listed skills then appear in the UI from `Skills/index.json`. Zero
   harness code edits.

## Stack notes

- Skills live in the AgentCore Docker image. Drop folder → rebuild → live.
- Webhook re-entry (Fal, render completion) must honor `job.skillId`.
- Checkpoints survive the 15-minute AgentCore timeout: interrupt → Firestore
  → resume on the next turn with `gate.skillId`.
- Model calls go through OpenRouter via the Vercel AI SDK. Skills do not
  choose models.

## Verification

`checks/dropInSkill.selfcheck.ts` loads `Skills/__drop-in__/`, asserts exact
tool visibility, JobCompleted dispatch, resume `forceToolName`, permission
verdicts, and async ownership — with no TypeScript changes to the harness.
If a new skill cannot pass that shape, the package is wrong, not the
harness.
