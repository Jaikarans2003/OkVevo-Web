# App Hosting + GitHub Actions (OkVevo-Web)

Do **not** connect this repo to Firebase App Hosting GitHub auto-rollout. Actions runs the same CLI deploy the agent uses locally.

## Branches

| Branch | Firebase project | GitHub Environment | When it deploys |
|--------|------------------|--------------------|-----------------|
| `staging` | `okvevo-testing` | `staging` | Every push |
| `production` | `text2video-16cbf` (OkVevo-Production) | `production` (required reviewer) | Push, then Karan approves the Environment gate |

Keep GitHub default as `main` until the first green staging deploy, then rename default → `staging`.

## Required GitHub setup (once)

Repo: [Jaikarans2003/OkVevo-Web](https://github.com/Jaikarans2003/OkVevo-Web). This repo stays **public** so Environments work on the Free plan.

### Environments

1. Settings → Environments → **New environment** → name exactly `staging` → Configure environment. Do **not** add required reviewers (staging auto-deploys).
2. **New environment** → name exactly `production`.
3. On `production`: **Required reviewers** → add Karan (`Jaikarans2003`). Wait timer 0. Do not skip this — it is the customer-portal ship gate.
4. Each environment → **Environment secrets** → `FIREBASE_SERVICE_ACCOUNT` = the Firebase CI service-account JSON for that project (testing SA on staging, `text2video-16cbf` SA on production).
5. Public Firebase web keys for production live in `apphosting.production.yaml`. Remaining `CHANGE_ME` there are **live Razorpay** `NEXT_PUBLIC_RAZORPAY_KEY_ID` + the 12 `RAZORPAY_*_PLAN_ID` keys. You can paste those into that file (preferred) or set them as GitHub Environment **variables** on `production` (same names).

Create these Environments **before** the first push to `production`. If Actions references a missing Environment, GitHub creates an unprotected one.

### Branch ruleset on `production`

Settings → Rules → Rulesets → **New branch ruleset**:

- Name: `production`
- Enforcement: Active
- Target branches: include `production`
- Block force pushes; restrict deletions
- Require a pull request before merging
- Required approvals: **0** until a second reviewer exists (solo founder must be able to merge). The Environment required-reviewer is the real production approval.

Do **not** add GitHub Environments on OkVevo-Nia.

IAM for the CI service account (each Firebase project): Service Usage Consumer, Firebase App Hosting Admin, Cloud Run Admin, Service Account User, Firebase Rules Admin, Storage Admin, Artifact Registry Writer (Cloud Build’s runtime). Without Service Usage Consumer, `firebase deploy` dies with 403 on `serviceusage.googleapis.com` while checking Storage.

## Workflow

`.github/workflows/deploy.yml` copies `apphosting.{staging|production}.yaml` → `apphosting.yaml` (with env overlays), then:

```text
firebase deploy --only apphosting,firestore:rules,firestore:indexes,storage --project <alias> --force --non-interactive
```

Cloud Build still runs `npm run build`. This workflow does **not** run `next build` first.

## Local / agent deploys

Default stays **testing**. From `OkVevo-Web/`:

```bash
firebase deploy --only apphosting --project okvevo-testing --force --non-interactive
```

`apphosting.yaml` is the staging copy for those deploys. Production is Actions-only.

## Ops billing (Cloud Scheduler)

```bash
./scripts/ops-billing-finish.sh --project okvevo-testing --origin https://okvevo-web--okvevo-testing.us-central1.hosted.app
./scripts/ops-billing-finish.sh --project text2video-16cbf --origin https://www.okvevo.com
```

Requires `.ops-billing-secrets.env` on the machine that runs it (never commit). Production cron must exist before yearly INR/USD subscribers go live.

## Download buttons

`/nia` uses `NEXT_PUBLIC_NIA_RELEASES_BASE` (staging yaml → `/staging`, production → bucket root) plus the stable names `Nia-mac-arm64.dmg` / `Nia-win-x64.exe`. Those objects are written only by OkVevo-Nia `desktop-promote.yml`.
