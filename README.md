OkVevo

OkVevo is an AI video platform for educators and creators. Teachers upload lecture recordings; the platform turns them into polished educational videos with animations, HyperFrames compositions, and narration. V2 adds a dedicated AI Studio with a streaming agent, skill-driven workflows, and separate render services.

Repository: https://github.com/Jaikarans2003/OKVEVO-V2



What’s in this codebase

The repo is organized around five major areas (from the project knowledge graph — ~4,000 OkVevo nodes across Skills/, src/, services/, infrastructure/, and AI-Influencer/):







Area



Role





src/



Next.js 15 app — workspace UI, API routes, Firebase client, billing





services/agent/



Node.js agent microservice — chat, tools, OpenRouter, Firestore sessions





Skills/



Agent instructions (AGENT.md, edu-video, hyperframes, manim-video)





services/hyperframes-renderer/



HyperFrames HTML → video render API





services/manim-renderer/



Manim Python animation render API





AI-Influencer/



AWS Lambdas + Step Functions for influencer video pipelines





infrastructure/



AWS CDK / deployment assets





functions/



Firebase Cloud Functions



Workspace products (src/app/workspace/)





AI Studio — chat-first edu-video creation (agent + skills)



AI Influencer — scripted avatar / lipsync pipelines via SQS + Step Functions



Director — photo/video generation workflows



Product — product placement and shoots



Avatar profiles, Social, User manual — supporting flows





Architecture



AI Studio chat flow

The graph centers on Community 353 (AI Studio UI) talking to Community 2665 (agent core) and Community 407 (agent tools).

graph TD
    subgraph Frontend ["Next.js — Community 353"]
        UI[AiStudioShell]
        Transport[DefaultChatTransport]
        Proxy["/api/agent"]
    end

    subgraph Agent ["services/agent — Community 2665"]
        Server[server.ts POST /chat]
        Run[runAgent]
        Skills[skills.ts + systemPromptCache]
        Session[session.ts Firestore]
        Tools[createTools — Community 407]
    end

    subgraph External
        OR[OpenRouter LLM]
        FS[(Firebase Firestore + Storage)]
        Groq[Groq transcription]
    end

    UI --> Transport --> Proxy --> Server --> Run
    Run --> Skills
    Run --> Session
    Run --> Tools
    Run --> OR
    Session --> FS
    Tools --> FS
    Tools --> Groq
    Tools --> Manim[Manim CLI in container]
    Tools --> HF[HyperFrames CLI]

Request path: AiStudioShell → useChat → POST /api/agent (edge proxy) → services/agent POST /chat → runAgent() → streamText() → streamed UI response. The Next.js route only proxies; it does not call the model.

Agent internals (runAgent): ensure Firestore session → load history → resolve skill → build system prompt from Skills/AGENT.md + skill SKILL.md → register tools → stream from OpenRouter (default anthropic/claude-sonnet-4-5, UI often uses Haiku).

Edu-video pipeline (agent tools)

When the edu-video skill is active, the agent runs this pipeline autonomously:

transcribe_video → extract_concepts → generate_manim_script → render_manim_clips
  → plan_hf_segments → scaffold_hf_project → render_hyperframes

Supporting tools: read_file, write_file, search_files, run_command (Manim, HyperFrames, ffmpeg inside the agent container).

Outputs are uploaded to Firebase Storage; the agent returns public URLs, not local paths.

Legacy / parallel pipelines (Community 324)

Director and older chat flows still use SQS, Lambda stitch services, and Gemini narration (useDirectorFlow, SQSStitchService, LambdaStitchService). These coexist with AI Studio; they are separate subgraphs in the codebase.





Directory structure

OKVEVO V2/
├── src/                          # Next.js app
│   ├── app/workspace/ai-studio/  # AI Studio pages
│   ├── app/api/agent/            # Agent proxy + session APIs
│   ├── components/workspace/     # AiStudioShell, timeline, chat bar
│   ├── hooks/                    # useAuth, usePipelineState, useChatFlow, …
│   └── services/                 # Firebase, SQS, Razorpay, generation helpers
├── services/
│   ├── agent/                    # Express agent (src/agent.ts, tools.ts, …)
│   ├── hyperframes-renderer/
│   └── manim-renderer/
├── Skills/
│   ├── AGENT.md                  # Base agent identity (Nia)
│   ├── edu-video/                # Edu-video skill + HTML templates
│   ├── hyperframes/
│   └── manim-video/
├── AI-Influencer/                # Lambdas, state machines
├── infrastructure/               # CDK
├── functions/                    # Firebase functions
├── docker-compose.yml            # Local agent service
├── .env.example                  # Root env template (safe to commit)
└── services/agent/.env.example   # Agent env template





Prerequisites





Node.js 20+



npm



Firebase project (Auth, Firestore, Storage)



OpenRouter API key (agent LLM)



Groq API key (video transcription in agent tools)



Docker (optional, for agent + Manim + HyperFrames in one image)

For full platform features you may also need: AWS (SQS, Lambda, Step Functions), Razorpay, Fal.ai, Gemini — see .env.example.





Setup



1. Clone and install

git clone https://github.com/Jaikarans2003/OKVEVO-V2.git
cd OKVEVO-V2
npm install



2. Environment files

Copy templates and fill in credentials. Never commit real .env files.

cp .env.example .env
cp services/agent/.env.example services/agent/.env

Key variables:







Variable



Where



Purpose





OPENROUTER_API_KEY



root + agent



LLM for app and agent





AGENT_URL



root .env



Agent service URL (http://localhost:3001)





GROQ_API_KEY



agent .env



Lecture transcription





FIREBASE_* / FB_*



root + agent



Firebase client + Admin SDK





NEXT_PUBLIC_FIREBASE_*



root



Browser Firebase config



3. Run locally

Next.js (frontend + API proxy):

npm run dev

Agent service (required for AI Studio chat):

cd services/agent
npm install
npm run dev

Or with Docker (includes Manim, Chromium, HyperFrames CLI):

docker compose up agent

Open AI Studio at /workspace/ai-studio. A simple “hi” still goes through the agent service — the Next.js /api/agent route only proxies to services/agent.

4. Optional render services

cd services/manim-renderer && npm install && npm start
cd services/hyperframes-renderer && npm install && npm start

Point MANIM_RENDERER_URL in services/agent/.env if using external renderers instead of in-container CLI.





Agent skills

Skills live under Skills/ as SKILL.md files. The agent loads AGENT.md for every session and appends a skill file when:





The user selects a skill in AI Studio, or



The message matches triggers (e.g. “edu video”, /edu-video)







Skill



Purpose





edu-video



Full lecture → edu video pipeline





hyperframes



HyperFrames HTML compositions





manim-video



Manim animation scripts





Deployment





Frontend: npm run build → Firebase Hosting (firebase deploy --only hosting)



Agent: services/agent/Dockerfile — Node 22 + Python 3.11 + Manim + Chromium + HyperFrames



AWS / Influencer: see infrastructure/ and AI-Influencer/





Development notes





Secrets: .env and services/agent/.env are gitignored. Example files (.env.example, .Env File Example) are committed as templates.



Excluded from git: Refference/, .cursor/, graphify-out/, .firebase/, node_modules/



Knowledge graph: Run .venv/bin/graphify update . after code changes to refresh graphify-out/ for architecture queries (graphify explain runAgent, etc.)





License

MIT License
