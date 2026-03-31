# OKVEVO AI Influencer — Log & Message Overhaul
## Deep-Dive Documentation: Before vs After + Debug Reference

File: src/app/workspace/ai-influencer/page.tsx

---

## OKVEVO Voice Guide (Rules Applied)

- Tone: Cocky, hyper-confident, unhinged creative genius
- Pattern: "OKVEVO is [verb]-ing", "OKVEVO [quirky word]"
- Banned: "Processing", "Protocol", "Neural", "Synthesis"
- Allowed flair: "OKVEVING", "Conjuring", "Cookin", "OKVEVO Kiss", "the lab"
- Error prefix: [X] -> [skull] (personality only, logic unchanged)
- Console logs: NOT changed - technical strings stay for debugging

---

## Category A: Initial / Reset State Messages

#1 | Line ~82 | useState chatMessages init
BEFORE: "Hi! I'm VEVO your creative Assistant. Let's create a professional explainer video. Start by uploading or pasting your script below."
AFTER:  "Yo! OKVEVO here. Drop your script and watch the magic unfold. We don't do boring — we do OKVEVO. Paste it below or upload the file. Let's get weird."
DEBUG: If old message shows on first load, check useState init for chatMessages.

#2 | Line ~289 | resetFlow() function
BEFORE: "Hi! I'm VEVO Let's create a new explainer video. Upload or paste your script below to get started."
AFTER:  "OKVEVO is back and hungry. New video, new vibes. Drop that script and let's cook something OKVEVO-worthy."
DEBUG: Fires when user clicks Purge & Reset button via resetFlow() -> setChatMessages.

---

## Category B: Chat Flow Messages (addAssistant calls)

#3 | Line ~405 | handleScriptSubmit
BEFORE: 'Great! Now select how long your explainer video should be.'
AFTER:  '🔥 Script locked in! Now tell OKVEVO — how long are we cookin this masterpiece?'

#4 | Line ~420 | handleDurationSelect
BEFORE: 'Great! Now select the pacing style for the AI voiceover.'
AFTER:  'Duration? LOCKED. Now pick the vibe — how do you want OKVEVO to talk?'

#5 | Line ~430 | handlePacingSelect (start)
BEFORE: 'Analyzing your script and generating a X-script'
AFTER:  'OKVEVO is thinking... conjuring a Xs script from your raw material. This hits different.'
DEBUG:  isGenerating=true here. If spinner won't stop, check catch block resets isGenerating.

#6 | Line ~467 | handlePacingSelect (success)
BEFORE: 'Script generated! (~N words) ... Review and edit your script below...'
AFTER:  'OKVEVO cooked! N words of pure OKVEVO energy. ... Read it. Live it. Edit it if you dare.'
DEBUG:  chatStep moves to edit-script. If textarea empty, check setEditableScript(data.script).

#7 | Line ~471 | handlePacingSelect (error)
BEFORE: 'Failed to generate script: [msg]'
AFTER:  'OKVEVO tripped up: [msg] — but we don't give up. Try again.'
GREP:   "OKVEVO tripped up" -> check /api/ai-influencer/generate-script endpoint

#8 | Line ~494 | handleConfirmScript
BEFORE: 'Perfect! Your script is ready.'
AFTER:  'Script? DONE. OKVEVO stamped it APPROVED.'

#9 | Line ~495 | handleConfirmScript
BEFORE: 'Now, please upload the avatar video that will present your explainer. MP4, MOV, or WebM supported.'
AFTER:  'Now gimme the face. Upload your avatar video — MP4, MOV, or WebM. This is who OKVEVO speaks through.'
DEBUG:  Both messages fire in handleConfirmScript. If only 1 shows, check both addAssistant calls exist.

#10 | Line ~519 | handleConfirmScript (error)
BEFORE: 'Failed to save script: [msg]'
AFTER:  'OKVEVO couldn't stash the script: [msg] — Firestore playing games.'
GREP:   "OKVEVO couldn't stash" -> Firestore write fail at aiInfluencerJobs/{jobId}

#11 | Line ~530 | handleAvatarUpload
BEFORE: 'Uploading avatar video to storage…'
AFTER:  'OKVEVO is beaming up your avatar... Firebase is doing its thing 🚀'

#12 | Line ~548 | handleAvatarUpload (success msg 1)
BEFORE: 'Avatar uploaded! Now choose the voice for your narration.'
AFTER:  'Avatar received! OKVEVO sees your face. Now let's give it a voice.'

#13 | Line ~549 | handleAvatarUpload (success msg 2)
BEFORE: 'You can either select a preset voice (Male/Female) or upload your own voice sample for cloning.'
AFTER:  'Pick Richard or Aurora — or upload a voice sample for OKVEVO to clone. We go full method here.'

#14 | Line ~553 | handleAvatarUpload (error)
BEFORE: 'Failed to upload avatar: [msg]'
AFTER:  'Avatar upload fumbled: [msg] — Check file format or size. OKVEVO only takes quality.'
GREP:   "Avatar upload fumbled" -> Firebase Storage upload issue

#15 | Line ~979 | audio onChange handler
BEFORE: 'Uploading voice sample to storage…'
AFTER:  'OKVEVO is sampling your voice DNA... uploading to the lab 🧬'

#16 | Line ~994 | audio onChange (success)
BEFORE: 'Voice sample uploaded! Click "Generate Voice-Over" to start.'
AFTER:  'Voice DNA locked in! Hit Commit Audio Layer and OKVEVO will clone that voice.'

#17 | Line ~998 | audio onChange (error)
BEFORE: 'Failed to upload voice sample: [msg]'
AFTER:  'Voice clone failed at upload: [msg] — the lab is shook.'
GREP:   "Voice clone failed at upload" -> Firebase Storage audio upload

#18 | Line ~587 | handleGenerateTTS (msg 1)
BEFORE: 'Starting AI Influencer Pipeline...'
AFTER:  'OKVEVO is OKVEVING. Pipeline ignited. Sit tight.'

#19 | Line ~588 | handleGenerateTTS (msg 2)
BEFORE: 'This will generate images, audio, and create your final video. This may take 2-5 minutes.'
AFTER:  'Images cooking, audio baking, final video assembling — OKVEVO is in the kitchen. ETA: 2–5 mins. Go grab a coffee.'

#20 | Line ~616 | handleGenerateTTS (success)
BEFORE: 'Pipeline started! Generating your AI Influencer video...'
AFTER:  'OKVEVO has entered the building. Your video is being born right now. Watch the monitor.'

#21 | Line ~621 | handleGenerateTTS (error)
BEFORE: 'Failed to start pipeline: [msg]'
AFTER:  'Pipeline choked at launch: [msg] — SQS or Step Function issue. Try again.'
GREP:   "Pipeline choked at launch" -> check /api/sqs/ai-influencer endpoint

#22 | Line ~197 | handleResumePipeline
BEFORE: 'Preparation complete! Moving to Lip-Sync stage...'
AFTER:  'Avatar locked and loaded! OKVEVO is lip-syncing your masterpiece now. Hold tight.'

#23 | Line ~632 | handleGenerateLipSync (data URL guard)
BEFORE: 'Audio URL is not a remote URL. Please re-generate the voice-over.'
AFTER:  'Audio is a local blob — OKVEVO cannot use that. Regenerate the voice-over for a proper URL.'

#24 | Line ~639 | handleGenerateLipSync (auth guard)
BEFORE: 'Authentication required. Please sign in to generate AI influencer videos.'
AFTER:  'OKVEVO does not work for strangers. Sign in first, then we party.'

#25 | Line ~645 | handleGenerateLipSync
BEFORE: 'Generating lip-synced video with Fal AI… This can take 2–5 minutes. Sit tight!'
AFTER:  'OKVEVO is lip-syncing your avatar with Fal AI... we call this the OKVEVO Kiss. Give it 2–5 mins.'

#26 | Line ~668 | handleGenerateLipSync (success)
BEFORE: 'Pipeline resumed with your avatar video! Monitoring progress… (usually 1–3 min)'
AFTER:  'Avatar delivered! OKVEVO is monitoring the render... usually 1–3 mins. Don't touch anything.'

#27 | Line ~670 | handleGenerateLipSync (error)
BEFORE: 'Failed to progress: [msg]. You might need to wait a few seconds...'
AFTER:  'OKVEVO hit a snag: [msg]. The pipeline might need a few more seconds — wait and retry.'
GREP:   "OKVEVO hit a snag" -> Step Function resume issue

#28 | Line ~364 | handleApplyBranding (error)
BEFORE: 'Post-processing failed: [msg]'
AFTER:  'Branding pipeline choked: [msg] — logo or marquee Lambda issue.'
GREP:   "Branding pipeline choked" -> brand-video Lambda / /api/ai-influencer/brand-video

---

## Category C: Firestore Polling Messages (onSnapshot)

#29 | Line ~216 | data.script arrives
BEFORE: 'Script generated (~Xs). Review and edit it below, then click Continue.'
AFTER:  'OKVEVO brain just delivered a fresh ~Xs script. Edit it below, then keep it moving.'

#30 | Line ~260 | data.status === 'complete'
BEFORE: 'Your video is ready! Watch it in the monitor on the right.'
AFTER:  'OKVEVO DROP! Your video just landed. Watch the monitor — you are about to be iconic.'

#31 | Line ~263 | data.status === 'error'
BEFORE: 'Error: [msg or default]'
AFTER:  'OKVEVO system fault: [msg or default fallback]'
GREP:   "OKVEVO system fault" -> Firestore error status branch in onSnapshot

---

## Category D: JSX Static UI Labels

#32 | Line ~1377 | Assistant message badge
BEFORE: Intelligence Synthesis
AFTER:  OKVEVO SPEAKING

#33 | Line ~1398 | isGenerating typing bubble badge
BEFORE: Processing Protocol
AFTER:  OKVEVO IS OKVEVING

#34 | Line ~1412 | Typing bubble animated span
BEFORE: Executing...
AFTER:  Conjuring...

#35 | Line ~1091 | generating-lipsync panel header
BEFORE: Media Synthesis Active
AFTER:  OKVEVO is Lip-Syncing

#36 | Line ~1092 | generating-lipsync panel sub-label
BEFORE: Fal AI Neural Mapping · 2-5 Min Transit
AFTER:  Fal AI is doing the OKVEVO Kiss · 2–5 Min

#37 | Line ~1109 | complete step title
BEFORE: Generation Successful
AFTER:  OKVEVO Delivered 🔥

#38 | Line ~1110 | complete step subtitle
BEFORE: Protocol terminated with exit code 0
AFTER:  exit code: OKVEVO_CLEAN · no errors · pure fire

#39 | Line ~1326 | Branding button (loading state)
BEFORE: Processing…
AFTER:  OKVEVO Branding…

#40 | Line ~1327 | Branding button (idle state)
BEFORE: Apply Processing
AFTER:  OKVEVO-fy This Video

#41 | Line ~1522 | Right monitor loading main text
BEFORE: Neural Synthesis
AFTER:  OKVEVO is Cooking

#42 | Line ~1529 | Right monitor loading sub-text
BEFORE: 'Phase: Lipschitz Mapping…' / 'Phase: Lighting Protocol…'
AFTER:  'OKVEVO is syncing lips… almost there' / 'OKVEVO is conjuring frames… hang tight'

#43 | Line ~1546 | Empty monitor title
BEFORE: Studio Downlink
AFTER:  OKVEVO Monitor

#44 | Line ~1550 | Empty monitor subtitle
BEFORE: Standby Protocol
AFTER:  Waiting for your drop...

---

## Production Debug Grep Reference

| Grep String               | Meaning                              | Code Location                  |
|---------------------------|--------------------------------------|-------------------------------|
| OKVEVO tripped up         | Script gen API failed                | handlePacingSelect catch       |
| OKVEVO is OKVEVING        | Pipeline start message fired         | handleGenerateTTS              |
| OKVEVO system fault       | Firestore detected error status      | onSnapshot error branch        |
| OKVEVO hit a snag         | LipSync Step Function resume failed  | handleGenerateLipSync catch    |
| OKVEVO couldn't stash     | Firestore write fail on confirm step | handleConfirmScript catch      |
| Branding pipeline choked  | Brand-video Lambda error             | handleApplyBranding catch      |
| OKVEVO does not work for strangers | Auth check failed            | handleGenerateLipSync auth     |
| Avatar upload fumbled     | Firebase Storage upload failure      | handleAvatarUpload catch       |
| Pipeline choked at launch | SQS/Step Function start failure      | handleGenerateTTS catch        |
| Voice clone failed at upload | Audio sample Storage upload fail  | audio onChange catch           |
| OKVEVO brain just delivered | Script arrived via Firestore poll  | onSnapshot script branch       |
| OKVEVO DROP!              | Final video complete                 | onSnapshot complete branch     |

---

NOTE: console.log and console.error calls are intentionally NOT changed.
Only addAssistant() calls (chat bubbles) and JSX labels are updated.
Error logic, routing, and state management are completely untouched.
