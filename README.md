# OkVevo

**OkVevo** is an AI video platform that helps educators, creators, brands, and businesses turn ideas and raw footage into polished, publish-ready videos — without traditional shoots, heavy editing, or production delays.

Upload a lecture recording and get an educational video with animations and narration. Create reels and ads with AI avatars, voice, and lip-sync. Generate product shoots, director-style photo/video workflows, and social content — all from one workspace.

**Repository:** [https://github.com/Jaikarans2003/OKVEVO-V2](https://github.com/Jaikarans2003/OKVEVO-V2)

For full installation on a new machine (macOS and Windows), see **[INSTALLATION.md](./INSTALLATION.md)**.

---



## Who it's for


| Audience                     | What OkVevo gives them                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| **Teachers & educators**     | Turn lecture recordings into structured educational videos with animations, captions, and narration |
| **Content creators**         | Produce reels, shorts, and social videos quickly — including faceless and avatar-driven content     |
| **Brands & marketers**       | Product placement, branded shoots, and consistent visual identity across campaigns                  |
| **Businesses & enterprises** | Scalable video creation with billing, teams, and subscription plans                                 |


---



## What you can do

OkVevo V2 is organized around a **workspace** — the logged-in area where users create and manage video projects.

### AI Studio

The flagship V2 experience. A chat-first interface where users describe what they want, upload a lecture video, and work with **Nia** — OkVevo's AI assistant — to produce educational videos end to end.

Nia transcribes the lecture, identifies key concepts, generates Manim math animations, builds HyperFrames HTML compositions, and delivers finished video assets stored in Firebase.

### AI Influencer

Create scripted avatar videos with realistic voice and lip-sync. Jobs run through AWS (SQS queues and Step Functions) with Lambdas handling prep, rendering, branding, and recovery.

### Supporting workspace areas

- **Avatar profiles** — manage digital avatar identity
- **Social** — social-studio content flows
- **User manual** — in-app guidance for creators



### Public-facing site

Marketing pages (about, features, pricing, blogs, showcase), authentication, billing, affiliate dashboard, admin tools, and onboarding — all served by the Next.js app outside the workspace.

---



## How it works (high level)

1. **Users** sign in via Firebase Auth and work inside the Next.js workspace UI.
2. **AI Studio** sends chat messages to a dedicated **agent service** (`services/agent/`), which streams responses from an LLM (OpenRouter) and runs tools — transcription, script generation, rendering, file upload.
3. **Skills** (`Skills/`) are instruction files that tell the agent how to behave for each workflow (edu-video, HyperFrames, Manim).
4. **Render services** turn scripts and HTML compositions into MP4 video — either inside the agent Docker container or via standalone microservices.
5. **Firebase** stores sessions, user data, and finished assets. **AWS** powers influencer and legacy generation pipelines. **Razorpay** handles subscriptions.

The Next.js app does not call the LLM directly for AI Studio — it proxies chat to the agent service at `AGENT_URL`.

---



## Tech stack


| Layer           | Technology                                           |
| --------------- | ---------------------------------------------------- |
| Frontend        | Next.js 15, React 19, Tailwind CSS, Framer Motion    |
| Agent           | Node.js, Express, Vercel AI SDK, OpenRouter          |
| Auth & data     | Firebase (Auth, Firestore, Storage, Cloud Functions) |
| Video rendering | Manim CE, HyperFrames CLI, FFmpeg, Chromium          |
| Cloud pipelines | AWS (Lambda, SQS, Step Functions, S3), CDK           |
| Payments        | Razorpay                                             |
| Generation APIs | Groq, Gemini, Fal.ai                                 |


---



## Directory structure

Complete layout of the repository (excluding `node_modules/`, `.next/`, `.git/`, build artifacts, and local-only folders like `Refference/`).

```text
OKVEVO-V2/
├── README.md                         # This file — project overview
├── INSTALLATION.md                   # Full install & run guide (macOS / Windows)
├── package.json                      # Next.js app dependencies and scripts
├── package-lock.json
├── tsconfig.json
├── next.config.ts
├── next-env.d.ts
├── tailwind.config.js
├── postcss.config.js
├── components.json                   # shadcn/ui config
├── docker-compose.yml                # Local agent service (Docker)
├── firebase.json                     # Firebase Hosting, Functions, rules
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── .env.example                      # Root environment template
├── .Env File Example                 # Extended env variable reference
├── generate-key.cjs                  # Encode Firebase service account to base64
├── skills-lock.json                  # Installed agent skills lockfile
├── font.woff2
│
├── src/                              # Next.js 15 application
│   ├── app/                          # App Router pages and API routes
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Landing page
│   │   ├── about/                    # About OkVevo
│   │   ├── features/                 # Features page
│   │   ├── pricing/                  # Subscription plans
│   │   ├── login/                    # Authentication
│   │   ├── onboarding/               # New-user onboarding
│   │   ├── billing/                  # Billing management
│   │   ├── profile/                  # User profile
│   │   ├── history/                  # Generation history
│   │   ├── blogs/                    # Blog content
│   │   ├── legal/                    # Legal pages
│   │   ├── demo/                     # Demo flows
│   │   ├── booth/                    # "Your AI Adda" booth experience
│   │   ├── Showcase/                 # Content showcase
│   │   ├── admin/                    # Admin dashboard
│   │   ├── affiliate-dashboard/      # Affiliate portal
│   │   ├── organisation/             # Organisation management
│   │   ├── pro-dashboard/            # Pro user dashboard
│   │   ├── pro-prompt/               # Pro prompt tools
│   │   ├── okvevo-masiv/             # Masiv campaign pages
│   │   │
│   │   ├── workspace/                # Logged-in creator workspace
│   │   │   ├── ai-studio/            # AI Studio — chat-first edu-video
│   │   │   │   └── files/            # Project file browser
│   │   │   ├── ai-influencer/        # AI Influencer workflows
│   │   │   ├── director/             # Director photo/video generation
│   │   │   ├── product/              # Product placement & shoots
│   │   │   ├── avatar-profiles/      # Avatar identity management
│   │   │   ├── social/               # Social studio
│   │   │   └── user-manual/          # In-app user guide
│   │   │
│   │   └── api/                      # Next.js API routes (server-side)
│   │       ├── agent/                # Proxy to agent service + sessions
│   │       ├── ai-influencer/        # Influencer script & brand video APIs
│   │       ├── sqs/                  # SQS job submission (stitch, photos, influencer)
│   │       ├── razorpay/             # Subscriptions, webhooks, upgrades
│   │       ├── fal/                  # Fal.ai webhook handler
│   │       ├── upload/               # File uploads (avatars, etc.)
│   │       ├── download-video/       # Video download endpoint
│   │       ├── affiliates/           # Affiliate creation & stats
│   │       ├── coupons/              # Coupon validation
│   │       └── admin/                # Admin audit, users, credits
│   │
│   ├── components/                   # React components
│   │   ├── workspace/                # Workspace shell and product UIs
│   │   │   └── ai-studio/            # AiStudioShell, chat bar, timeline, sidebar
│   │   ├── ai-influencer/            # Influencer UI components
│   │   ├── social-studio/            # Social studio components
│   │   ├── chat/                     # Shared chat components
│   │   ├── payment/                  # Razorpay / billing UI
│   │   ├── admin/                    # Admin UI
│   │   ├── layout/                   # Navigation, headers, footers
│   │   ├── layouts/                  # Page layout wrappers
│   │   ├── ui/                       # shadcn/ui primitives
│   │   ├── blog/                     # Blog components
│   │   ├── booth/                    # Booth experience
│   │   ├── masiv/                    # Masiv campaign UI
│   │   └── ook/                      # Marketing / features components
│   │
│   ├── hooks/                        # React hooks
│   │   ├── useAuth.ts
│   │   ├── useChatFlow.ts
│   │   ├── useDirectorFlow.ts
│   │   ├── usePipelineState.ts
│   │   ├── usePipelineApproval.ts
│   │   ├── useVideoGeneration.ts
│   │   └── useWorkspaceSession.ts
│   │
│   ├── services/                     # Client and server service modules
│   │   ├── ChatService.ts
│   │   ├── AIService.ts
│   │   ├── AIInfluencerService.ts
│   │   ├── SubscriptionService.ts
│   │   ├── CreditsService.ts
│   │   ├── StorageService.ts
│   │   ├── SQSStitchService.ts
│   │   ├── SQSPhotoService.ts
│   │   ├── LambdaStitchService.ts
│   │   ├── ProductPlacementService.ts
│   │   ├── ProductShootsService.ts
│   │   ├── TrendGenerationService.ts
│   │   ├── NarrationService.ts
│   │   ├── TTSService.ts
│   │   ├── VisionOrchestratorService.ts
│   │   ├── VideoStitcherService.ts
│   │   ├── AvatarProfileService.ts
│   │   ├── GenerationStorageService.ts
│   │   ├── GenerationMetadataService.ts
│   │   ├── WorkspaceSessionService.ts
│   │   ├── HistoryService.ts
│   │   ├── AdminService.ts
│   │   ├── RateLimitService.ts
│   │   └── userService.ts
│   │
│   ├── lib/                          # Shared utilities
│   │   ├── firebase-admin.ts         # Server-side Firebase Admin
│   │   ├── api-utils.ts
│   │   ├── utils.ts
│   │   ├── blogUtils.ts
│   │   ├── boothSession.ts
│   │   ├── r2.ts
│   │   ├── agent/                    # Agent client helpers
│   │   └── server/                   # Server-only utilities
│   │
│   ├── contexts/                     # React context providers
│   ├── config/                       # App configuration
│   ├── data/                         # Static data
│   ├── types/                        # TypeScript types
│   ├── utils/                        # General utilities
│   ├── middleware/                   # Next.js middleware
│   └── assets/                       # Static assets used in code
│
├── services/                         # Backend microservices
│   │
│   ├── agent/                        # AI Studio agent (Express + LLM + tools)
│   │   ├── package.json
│   │   ├── Dockerfile                # Node + Python + Manim + Chromium + HyperFrames
│   │   ├── .env.example
│   │   ├── AGENT.md                  # Agent identity copy (canonical: Skills/AGENT.md)
│   │   ├── tsconfig.json
│   │   ├── scripts/
│   │   │   └── build.mjs
│   │   └── src/
│   │       ├── server.ts             # HTTP server (GET /health, POST /chat)
│   │       ├── agent.ts              # runAgent, streamText orchestration
│   │       ├── tools.ts              # Agent tools (transcribe, manim, hyperframes, …)
│   │       ├── skills.ts             # Skill loading and resolution
│   │       ├── session.ts            # Firestore session management
│   │       ├── storage.ts            # Firebase Storage uploads
│   │       ├── firebase.ts           # Firebase Admin initialization
│   │       ├── messagePruning.ts     # Context window management
│   │       └── systemPromptCache.ts  # System prompt caching
│   │
│   ├── hyperframes-renderer/         # HyperFrames HTML → MP4 render API
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── .env.example
│   │   ├── src/
│   │   │   ├── index.ts              # Service entry
│   │   │   ├── app.ts                # Express app
│   │   │   ├── config.ts
│   │   │   ├── diagnostics.ts
│   │   │   ├── logger.ts
│   │   │   ├── legacyRender.ts
│   │   │   ├── server.js             # Legacy JS server (reference)
│   │   │   ├── lib/                  # CLI paths, safe paths, render runner
│   │   │   ├── render/               # Render pipeline, validation, bundle
│   │   │   ├── upload/               # Multipart project upload
│   │   │   └── zip/                  # Secure ZIP extraction
│   │   ├── examples/
│   │   │   ├── simple-solid/         # Minimal composition example
│   │   │   ├── logo-reveal/          # Composition with assets
│   │   │   └── project-zip-workflow/ # ZIP upload workflow
│   │   ├── deploy/                   # ECS deployment templates
│   │   ├── docker/                   # Docker build files
│   │   ├── docs/                     # API curl tests
│   │   ├── scripts/                  # docker-build, clean-tmp
│   │   ├── output/                   # Rendered MP4s (git-ignored)
│   │   └── tmp/                      # Job staging (git-ignored)
│   │
│   └── manim-renderer/               # Manim Python script → MP4 render API
│       ├── package.json
│       ├── README.md
│       ├── .env.example
│       └── src/
│           ├── index.js              # Service entry
│           ├── app.js                # Express routes
│           └── lib/
│               ├── checkDeps.js        # Dependency health checks
│               ├── detectScenes.js   # Scene class detection
│               ├── runManim.js       # Manim subprocess runner
│               └── stitchScenes.js   # Multi-scene ffmpeg stitch
│
├── Skills/                           # Agent skill instructions (loaded by agent)
│   ├── AGENT.md                      # Base agent identity — Nia
│   ├── edu-video/                    # Lecture → educational video pipeline
│   │   ├── SKILL.md
│   │   └── templates/                # HTML composition templates
│   ├── manim-video/                  # Manim animation script generation
│   │   ├── SKILL.md
│   │   ├── references/
│   │   └── scripts/
│   └── hyperframes/                  # HyperFrames composition skills
│       ├── SKILL.md                  # Router skill
│       ├── hyperframes-cli/
│       ├── hyperframes-core/
│       ├── hyperframes-animation/
│       ├── hyperframes-creative/
│       ├── hyperframes-media/
│       ├── hyperframes-registry/
│       ├── embedded-captions/
│       ├── faceless-explainer/
│       ├── general-video/
│       ├── media-use/
│       ├── motion-graphics/
│       ├── music-to-video/
│       ├── pr-to-video/
│       ├── product-launch-video/
│       ├── remotion-to-hyperframes/
│       ├── slideshow/
│       ├── talking-head-recut/
│       └── website-to-video/
│
├── AI-Influencer/                    # AWS serverless influencer pipelines
│   ├── Lambdas/
│   │   ├── okvevo-ai-prep/           # Job preparation
│   │   ├── okvevo-branding/          # Brand overlay
│   │   ├── okvevo-fal-recovery/      # Fal.ai failure recovery
│   │   ├── okvevo-lipsync-submit/    # Lipsync job submission
│   │   ├── okvevo-lipsync-recovery/  # Lipsync failure recovery
│   │   ├── okvevo-renderer/          # Video rendering
│   │   └── okvevo-noop/              # No-op / passthrough
│   └── State-Machine/
│       └── state-machine.json        # Step Functions definition
│
├── infrastructure/                   # AWS CDK infrastructure
│   ├── package.json
│   ├── bin/
│   │   └── app.ts                    # CDK app entry
│   ├── lib/
│   │   └── stacks/
│   │       └── ai-influencer-stack.ts
│   └── config/
│       ├── dev.json
│       └── prod.json
│
├── functions/                        # Firebase Cloud Functions
│   ├── package.json
│   └── index.js
│
├── public/                           # Static assets served by Next.js
│   ├── images/
│   ├── videos/
│   ├── okvevoimg/
│   ├── masiv/                        # Masiv campaign assets
│   ├── instructions/                 # User instruction assets
│   ├── OKVEVO Logos With BackGrounds/
│   └── OKVEVO Logos WithOut BackGrounds/
│
└── Legal/                            # Legal documents
```



---



## Prerequisites

- **Node.js** 20+
- **npm**
- **Firebase** project (Auth, Firestore, Storage)
- **OpenRouter** API key (agent LLM)
- **Groq** API key (video transcription in agent tools)
- **Docker** (optional — recommended for agent with Manim + HyperFrames bundled)

For full platform features you may also need AWS (SQS, Lambda, Step Functions), Razorpay, Fal.ai, and Gemini — see `.env.example`.

---



## Setup



### 1. Clone and install

```bash
git clone https://github.com/Jaikarans2003/OKVEVO-V2.git
cd OKVEVO-V2
npm install
```



### 2. Environment files

Copy templates and fill in credentials. **Never commit real** `.env` **files.**

```bash
cp .env.example .env
cp services/agent/.env.example services/agent/.env
```


| Variable                 | Where        | Purpose                                     |
| ------------------------ | ------------ | ------------------------------------------- |
| `OPENROUTER_API_KEY`     | root + agent | LLM for app and agent                       |
| `AGENT_URL`              | root `.env`  | Agent service URL (`http://localhost:3001`) |
| `GROQ_API_KEY`           | agent `.env` | Lecture transcription                       |
| `FIREBASE_*` / `FB_*`    | root + agent | Firebase client + Admin SDK                 |
| `NEXT_PUBLIC_FIREBASE_*` | root         | Browser Firebase config                     |


Encode your Firebase service account for `FB_SERVICE_ACCOUNT_KEY`:

```bash
node generate-key.cjs /path/to/service-account.json
```

See **[INSTALLATION.md](./INSTALLATION.md)** for the complete variable list, Windows-specific steps, and HyperFrames CLI setup.

### 3. Run locally

**Next.js (frontend + API proxy):**

```bash
npm run dev
```

**Agent service (required for AI Studio chat):**

```bash
cd services/agent
npm install
npm run dev
```

Or with Docker (includes Manim, Chromium, HyperFrames CLI):

```bash
cd services/agent && npm run build && cd ../..
docker compose up agent
```

Open **AI Studio** at [http://localhost:3000/workspace/ai-studio](http://localhost:3000/workspace/ai-studio).

### 4. Optional render services

```bash
cd services/manim-renderer && npm install && npm start
cd services/hyperframes-renderer && npm install && npm start
```

Point `MANIM_RENDERER_URL` in `services/agent/.env` if using external renderers instead of the in-container CLI.

---



## Agent skills

Skills live under `Skills/` as `SKILL.md` files. The agent loads `AGENT.md` for every session and appends a skill when the user selects one in AI Studio or triggers it in chat.


| Skill           | Purpose                                           |
| --------------- | ------------------------------------------------- |
| **edu-video**   | Full lecture → educational video pipeline         |
| **hyperframes** | HyperFrames HTML compositions and motion graphics |
| **manim-video** | Manim Python animation scripts                    |


---



## Deployment


| Component            | How                                                |
| -------------------- | -------------------------------------------------- |
| **Frontend**         | `npm run build` → `firebase deploy --only hosting` |
| **Agent**            | Docker image from `services/agent/Dockerfile`      |
| **Cloud Functions**  | `cd functions && npm run deploy`                   |
| **AWS / Influencer** | `infrastructure/` CDK + `AI-Influencer/` Lambdas   |


---



## License

MIT License