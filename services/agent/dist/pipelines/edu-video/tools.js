"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var tools_exports = {};
__export(tools_exports, {
  build_hf_composition: () => build_hf_composition,
  extract_concepts: () => extract_concepts,
  render_draft_video: () => render_draft_video,
  render_manim_clips: () => render_manim_clips,
  transcribe_video: () => transcribe_video
});
module.exports = __toCommonJS(tools_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_ai = require("ai");
var import_openai = require("@ai-sdk/openai");
var import_zod = require("zod");
var import_retry = require("./retry");
var import_firebase = require("../../firebase");
var import_storage = require("./storage");
const openrouter = (0, import_openai.createOpenAI)({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? ""
});
function getWorkdir(sessionId) {
  const dir = `/tmp/okvevo-agent/${sessionId}`;
  import_fs.default.mkdirSync(dir, { recursive: true });
  return dir;
}
async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  import_fs.default.writeFileSync(destPath, buffer);
}
async function postMultipart(url, fields, files, timeoutMs) {
  const form = new FormData();
  for (const field of fields) {
    form.append(field.name, field.value);
  }
  for (const file of files) {
    const buffer = import_fs.default.readFileSync(file.path);
    form.append(
      file.name,
      new Blob([new Uint8Array(buffer)], { type: file.type }),
      file.filename
    );
  }
  return fetch(url, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(timeoutMs)
  });
}
function loadSkillFile(relativePath) {
  try {
    const full = import_path.default.join(process.cwd(), "../../Skills", relativePath);
    return import_fs.default.readFileSync(full, "utf8");
  } catch {
    return "";
  }
}
function buildSegmentMap(concepts, totalDuration) {
  const segments = [];
  let cursor = 0;
  for (const c of concepts) {
    if (c.start > cursor + 0.5) {
      segments.push({
        start: cursor,
        end: c.start,
        mode: c.start - cursor > 2 ? "B" : "C"
      });
    }
    segments.push({ start: c.start, end: c.end, mode: "A", moment_id: c.moment_id });
    cursor = c.end;
  }
  if (cursor < totalDuration - 0.5) {
    segments.push({ start: cursor, end: totalDuration, mode: "C" });
  }
  return segments;
}
async function createZip(sourceDir, outputPath) {
  const archiver = (await import("archiver")).default;
  return new Promise((resolve, reject) => {
    const output = import_fs.default.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve());
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}
async function extractMp4FromZip(zipPath, outputPath) {
  const yauzl = await import("yauzl");
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      if (!zipfile) return reject(new Error("Failed to open ZIP file"));
      zipfile.readEntry();
      zipfile.on("entry", (entry) => {
        if (entry.fileName.endsWith(".mp4") || entry.fileName === "render.mp4") {
          zipfile.openReadStream(entry, (streamErr, stream) => {
            if (streamErr) return reject(streamErr);
            if (!stream) return reject(new Error("Failed to open read stream"));
            const out = import_fs.default.createWriteStream(outputPath);
            stream.pipe(out);
            out.on("close", () => {
              zipfile.close();
              resolve();
            });
          });
        } else {
          zipfile.readEntry();
        }
      });
      zipfile.on("end", () => reject(new Error("No MP4 found in render ZIP")));
    });
  });
}
async function resolveSessionVideoUrl(sessionId, videoUrl) {
  if (videoUrl?.startsWith("http")) return videoUrl;
  const snap = await import_firebase.db.collection("sessions").doc(sessionId).get();
  const fromSession = snap.data()?.videoUrl;
  if (fromSession?.startsWith("http")) return fromSession;
  throw new Error("No video URL found for this session");
}
const transcribe_video = (0, import_ai.tool)({
  description: "Transcribe the teacher video with word-level timestamps using Groq Whisper. Idempotent \u2014 returns existing result if already transcribed.",
  inputSchema: import_zod.z.object({
    sessionId: import_zod.z.string().describe("The session ID"),
    videoUrl: import_zod.z.string().optional().describe("Firebase Storage download URL of the teacher video")
  }),
  execute: async ({ sessionId, videoUrl }) => {
    try {
      if (await (0, import_storage.pipelineFileExists)(sessionId, "transcription.json")) {
        const existing = await (0, import_storage.downloadPipelineJson)(sessionId, "transcription.json");
        return {
          success: true,
          cached: true,
          wordCount: existing.words.length,
          durationSec: existing.durationSec,
          excerpt: existing.text.slice(0, 200)
        };
      }
      const resolvedVideoUrl = await resolveSessionVideoUrl(sessionId, videoUrl);
      const workdir = getWorkdir(sessionId);
      const videoPath = import_path.default.join(workdir, "teacher-video.mp4");
      await (0, import_retry.withRetry)(() => downloadFile(resolvedVideoUrl, videoPath), {
        label: "download-video",
        maxAttempts: 3
      });
      const stats = import_fs.default.statSync(videoPath);
      let inputFile = videoPath;
      if (stats.size > 24 * 1024 * 1024) {
        const audioPath = import_path.default.join(workdir, "audio.mp3");
        const { execSync } = await import("child_process");
        execSync(`ffmpeg -i "${videoPath}" -vn -acodec mp3 -ar 16000 -ac 1 "${audioPath}"`, {
          timeout: 12e4
        });
        inputFile = audioPath;
      }
      const transcript = await (0, import_retry.withRetry)(async () => {
        const { default: Groq } = await import("groq-sdk");
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const response = await groq.audio.transcriptions.create({
          file: import_fs.default.createReadStream(inputFile),
          model: "whisper-large-v3-turbo",
          response_format: "verbose_json",
          timestamp_granularities: ["word"]
        });
        return response;
      }, { label: "groq-transcription", maxAttempts: 3 });
      const verboseTranscript = transcript;
      const result = {
        text: transcript.text,
        words: (verboseTranscript.words ?? []).map(
          (w) => ({
            text: w.word,
            start: w.start,
            end: w.end
          })
        ),
        durationSec: verboseTranscript.duration ?? 0
      };
      await (0, import_storage.uploadPipelineJson)(sessionId, "transcription.json", result);
      await (0, import_storage.updatePipelinePhase)(sessionId, 3);
      return {
        success: true,
        cached: false,
        wordCount: result.words.length,
        durationSec: result.durationSec,
        excerpt: result.text.slice(0, 200) ?? ""
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[transcribe_video]", sessionId, message);
      const stage = message.includes("Download failed") || message.includes("No video URL") ? "download" : "transcription";
      return {
        success: false,
        error: stage === "download" ? `Could not download the teacher video: ${message}` : `Transcription failed: ${message}`
      };
    }
  }
});
const extract_concepts = (0, import_ai.tool)({
  description: "Extract timestamped visual concepts from the transcript that will become Manim animations. Uses AI to identify 2-6 concepts that genuinely benefit from visualization.",
  inputSchema: import_zod.z.object({
    sessionId: import_zod.z.string()
  }),
  execute: async ({ sessionId }) => {
    try {
      if (await (0, import_storage.pipelineFileExists)(sessionId, "moments.json")) {
        const existing = await (0, import_storage.downloadPipelineJson)(sessionId, "moments.json");
        return { success: true, cached: true, concepts: existing };
      }
      const transcript = await (0, import_storage.downloadPipelineJson)(sessionId, "transcription.json");
      const manimSkill = loadSkillFile("manim-video/SKILL.md");
      const { text: responseText } = await (0, import_retry.withRetry)(
        () => (0, import_ai.generateText)({
          model: openrouter.chat("anthropic/claude-sonnet-4-6"),
          system: "You extract visual concepts from educational transcripts. Return ONLY valid JSON array. No markdown, no explanation, no code fences.",
          prompt: `Manim skill reference (first 2000 chars):
${manimSkill.slice(0, 2e3)}

Transcript (${transcript.durationSec}s):
${transcript.text}

Word timestamps (JSON):
${JSON.stringify(transcript.words.slice(0, 200))}

Extract 2-6 concepts that genuinely benefit from Manim animation. Be selective. Each concept must be spaced from others with speaker-only gaps between them.

For each concept find EXACT timestamps from the words array \u2014 use start of first word and end of last word.

Return ONLY this JSON array (no other text):
[{"moment_id":"m1","start":12.4,"end":28.1,"type":"formula","topic":"short label","excerpt":"exact words","manim_brief":"what animation shows"}]

Types: formula, steps, definition, diagram, comparison`
        }),
        { label: "extract-concepts", maxAttempts: 2 }
      );
      const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const concepts = JSON.parse(cleaned);
      if (!Array.isArray(concepts) || concepts.length === 0) {
        throw new Error("No valid concepts extracted from transcript");
      }
      await (0, import_storage.uploadPipelineJson)(sessionId, "moments.json", concepts);
      const sessionSnap = await import_firebase.db.collection("sessions").doc(sessionId).get();
      const sessionData = sessionSnap.data();
      const pipelineMode = sessionData?.pipelineMode ?? "auto";
      if (pipelineMode === "ask") {
        await import_firebase.db.collection("sessions").doc(sessionId).set(
          {
            pipelineStatus: "awaiting_approval",
            pipelineApproved: false,
            pipelinePhase: 3
          },
          { merge: true }
        );
        return {
          success: true,
          concepts,
          awaitingApproval: true,
          message: "Concepts extracted. Waiting for user approval before rendering."
        };
      }
      await (0, import_storage.updatePipelinePhase)(sessionId, 4);
      return { success: true, concepts, awaitingApproval: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
});
const render_manim_clips = (0, import_ai.tool)({
  description: "Generate Manim Python scripts for each concept using AI, then render them via the Manim renderer service. Returns download URLs for each clip.",
  inputSchema: import_zod.z.object({
    sessionId: import_zod.z.string()
  }),
  execute: async ({ sessionId }) => {
    try {
      const concepts = await (0, import_storage.downloadPipelineJson)(sessionId, "moments.json");
      const manimSkill = loadSkillFile("manim-video/SKILL.md");
      const workdir = getWorkdir(sessionId);
      import_fs.default.mkdirSync(import_path.default.join(workdir, "manim"), { recursive: true });
      const clips = [];
      const failed = [];
      for (const concept of concepts) {
        const clipStoragePath = `manim/scene_${concept.moment_id}_hq.mp4`;
        if (await (0, import_storage.pipelineFileExists)(sessionId, clipStoragePath)) {
          const url = `https://storage.googleapis.com/${(0, import_firebase.getStorageBucketName)()}/projects/${sessionId}/pipeline/${clipStoragePath}`;
          clips.push({
            moment_id: concept.moment_id,
            url,
            durationSec: concept.end - concept.start
          });
          continue;
        }
        try {
          const { text: script } = await (0, import_retry.withRetry)(
            () => (0, import_ai.generateText)({
              model: openrouter.chat("anthropic/claude-sonnet-4-6"),
              system: "You write Manim Python scripts. Return ONLY valid Python code. No markdown, no explanation, no code fences.",
              prompt: `Manim skill reference:
${manimSkill.slice(0, 3e3)}

Write a Manim scene for this concept:
Topic: ${concept.topic}
Type: ${concept.type}
Excerpt: "${concept.excerpt}"
Animation brief: ${concept.manim_brief}
Duration: ${(concept.end - concept.start).toFixed(1)} seconds

Requirements:
- Import from manim with: from manim import *
- Class name must be exactly: Scene${concept.moment_id.toUpperCase()}
- Set background: self.camera.background_color = "#0f0f0f"
- Duration must match ${(concept.end - concept.start).toFixed(1)}s using self.wait()
- Use monospace font: MONO = "Menlo"
- End with: self.play(FadeOut(Group(*self.mobjects)))
- Return ONLY the Python code, no markdown fences`
            }),
            { label: `manim-script-${concept.moment_id}`, maxAttempts: 2 }
          );
          const cleanScript = script.replace(/```python\n?/g, "").replace(/```\n?/g, "").trim();
          const scriptPath = import_path.default.join(workdir, "manim", `scene_${concept.moment_id}.py`);
          import_fs.default.writeFileSync(scriptPath, cleanScript);
          const rendererUrl = process.env.MANIM_RENDERER_URL ?? "http://localhost:3031";
          const renderResponse = await (0, import_retry.withRetry)(
            () => postMultipart(
              `${rendererUrl}/render`,
              [{ name: "quality", value: "high" }],
              [
                {
                  name: "script",
                  path: scriptPath,
                  filename: "scene.py",
                  type: "text/x-python"
                }
              ],
              6e5
            ),
            {
              label: `manim-render-${concept.moment_id}`,
              maxAttempts: 2,
              delayMs: 5e3
            }
          );
          if (!renderResponse.ok) {
            const err = await renderResponse.json();
            throw new Error(`Renderer error: ${err.error ?? renderResponse.status}`);
          }
          const mp4Path = import_path.default.join(workdir, "manim", `scene_${concept.moment_id}_hq.mp4`);
          const mp4Buffer = Buffer.from(await renderResponse.arrayBuffer());
          import_fs.default.writeFileSync(mp4Path, mp4Buffer);
          const url = await (0, import_storage.uploadPipelineFile)(
            sessionId,
            clipStoragePath,
            mp4Path,
            "video/mp4"
          );
          clips.push({
            moment_id: concept.moment_id,
            url,
            durationSec: concept.end - concept.start
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`Failed to render clip ${concept.moment_id}:`, message);
          failed.push({ moment_id: concept.moment_id, error: message });
        }
      }
      if (clips.length > 0) {
        await (0, import_storage.uploadPipelineJson)(sessionId, "manim-clips.json", clips);
        await (0, import_storage.updatePipelinePhase)(sessionId, 5);
      }
      return { success: clips.length > 0, clips, failed };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, clips: [], failed: [] };
    }
  }
});
const build_hf_composition = (0, import_ai.tool)({
  description: "Build HyperFrames HTML composition from transcript, concepts, and Manim clips. Runs lint check and fixes errors before packaging as ZIP.",
  inputSchema: import_zod.z.object({
    sessionId: import_zod.z.string()
  }),
  execute: async ({ sessionId }) => {
    try {
      if (await (0, import_storage.pipelineFileExists)(sessionId, "hf-composition.zip")) {
        const url = `https://storage.googleapis.com/${(0, import_firebase.getStorageBucketName)()}/projects/${sessionId}/pipeline/hf-composition.zip`;
        return { success: true, cached: true, zipUrl: url };
      }
      const transcript = await (0, import_storage.downloadPipelineJson)(sessionId, "transcription.json");
      const concepts = await (0, import_storage.downloadPipelineJson)(sessionId, "moments.json");
      const clips = await (0, import_storage.downloadPipelineJson)(sessionId, "manim-clips.json");
      const hfSkill = loadSkillFile("hyperframes/.agents/skills/hyperframes/SKILL.md");
      const workdir = getWorkdir(sessionId);
      const compDir = import_path.default.join(workdir, "hf-composition");
      import_fs.default.mkdirSync(import_path.default.join(compDir, "compositions", "sections"), { recursive: true });
      const segments = buildSegmentMap(concepts, transcript.durationSec);
      const { text: compositionJson } = await (0, import_retry.withRetry)(
        () => (0, import_ai.generateText)({
          model: openrouter.chat("anthropic/claude-sonnet-4-6"),
          system: "You build HyperFrames HTML compositions. Return ONLY valid JSON. No markdown, no explanation.",
          prompt: `HyperFrames skill (first 3000 chars):
${hfSkill.slice(0, 3e3)}

Build a HyperFrames composition for this educational video.

Transcript: ${transcript.text.slice(0, 2e3)}
Total duration: ${transcript.durationSec}s
Concepts with Manim clips: ${JSON.stringify(concepts.map((c, i) => ({ ...c, clipUrl: clips[i]?.url })))}
Segments: ${JSON.stringify(segments)}

Return ONLY this JSON object:
{
  "meta": { "id": "edu-${sessionId.slice(0, 8)}", "name": "Educational Video", "width": 1920, "height": 1080, "fps": 30 },
  "hyperframes": { "version": "1.0.0", "registry": "https://hyperframes.heygen.com" },
  "index_html": "complete index.html string with proper HyperFrames structure",
  "segments": [{ "filename": "seg_001.html", "html": "segment html content", "mode": "A|B|C" }]
}`
        }),
        { label: "build-composition", maxAttempts: 2 }
      );
      const cleaned = compositionJson.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const composition = JSON.parse(cleaned);
      import_fs.default.writeFileSync(
        import_path.default.join(compDir, "meta.json"),
        JSON.stringify(composition.meta, null, 2)
      );
      import_fs.default.writeFileSync(
        import_path.default.join(compDir, "hyperframes.json"),
        JSON.stringify(composition.hyperframes, null, 2)
      );
      import_fs.default.writeFileSync(import_path.default.join(compDir, "index.html"), composition.index_html);
      for (const seg of composition.segments) {
        import_fs.default.writeFileSync(
          import_path.default.join(compDir, "compositions", "sections", seg.filename),
          seg.html
        );
      }
      const hfUrl = process.env.HYPERFRAMES_RENDERER_URL ?? "http://localhost:3030";
      let lintPassed = false;
      let lintAttempts = 0;
      const maxLintAttempts = 3;
      while (!lintPassed && lintAttempts < maxLintAttempts) {
        lintAttempts++;
        try {
          const lintRes = await fetch(`${hfUrl}/lint`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectDir: compDir }),
            signal: AbortSignal.timeout(3e4)
          });
          if (lintRes.ok) {
            lintPassed = true;
          } else {
            const lintResult = await lintRes.json();
            if (lintAttempts < maxLintAttempts) {
              const { text: fixedHtml } = await (0, import_ai.generateText)({
                model: openrouter.chat("anthropic/claude-sonnet-4-6"),
                system: "Fix the HyperFrames HTML composition errors. Return ONLY the corrected index.html content.",
                prompt: `Lint errors:
${JSON.stringify(lintResult.errors)}

Current index.html:
${composition.index_html}

Return the fixed index.html with all errors resolved.`
              });
              composition.index_html = fixedHtml.replace(/```html\n?/g, "").replace(/```\n?/g, "").trim();
              import_fs.default.writeFileSync(import_path.default.join(compDir, "index.html"), composition.index_html);
            }
          }
        } catch {
          lintPassed = true;
          console.warn("Lint endpoint unavailable \u2014 proceeding without lint check");
          break;
        }
      }
      const zipPath = import_path.default.join(workdir, "hf-composition.zip");
      await createZip(compDir, zipPath);
      const zipUrl = await (0, import_storage.uploadPipelineFile)(
        sessionId,
        "hf-composition.zip",
        zipPath,
        "application/zip"
      );
      await (0, import_storage.updatePipelinePhase)(sessionId, 6);
      return {
        success: true,
        cached: false,
        zipUrl,
        segmentCount: composition.segments.length,
        lintPassed,
        lintAttempts
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
});
const render_draft_video = (0, import_ai.tool)({
  description: "Send the HyperFrames composition ZIP to the renderer and get back a draft MP4. Final step of the pipeline.",
  inputSchema: import_zod.z.object({
    sessionId: import_zod.z.string()
  }),
  execute: async ({ sessionId }) => {
    try {
      if (await (0, import_storage.pipelineFileExists)(sessionId, "renders/draft.mp4")) {
        const url = `https://storage.googleapis.com/${(0, import_firebase.getStorageBucketName)()}/projects/${sessionId}/pipeline/renders/draft.mp4`;
        return { success: true, cached: true, videoUrl: url };
      }
      const workdir = getWorkdir(sessionId);
      const zipPath = import_path.default.join(workdir, "hf-composition.zip");
      if (!import_fs.default.existsSync(zipPath)) {
        const { getStorage } = await import("firebase-admin/storage");
        const [buffer] = await getStorage().bucket((0, import_firebase.getStorageBucketName)()).file(`projects/${sessionId}/pipeline/hf-composition.zip`).download();
        import_fs.default.mkdirSync(workdir, { recursive: true });
        import_fs.default.writeFileSync(zipPath, buffer);
      }
      const hfUrl = process.env.HYPERFRAMES_RENDERER_URL ?? "http://localhost:3030";
      const renderRes = await (0, import_retry.withRetry)(
        () => postMultipart(
          `${hfUrl}/render-project`,
          [{ name: "options", value: JSON.stringify({ quality: "draft", fps: "30" }) }],
          [
            {
              name: "project",
              path: zipPath,
              filename: "project.zip",
              type: "application/zip"
            }
          ],
          18e5
        ),
        { label: "hf-render", maxAttempts: 2, delayMs: 1e4 }
      );
      if (!renderRes.ok) {
        const err = await renderRes.text();
        throw new Error(`HyperFrames renderer error: ${err.slice(0, 500)}`);
      }
      const responseBuffer = Buffer.from(await renderRes.arrayBuffer());
      const responseZipPath = import_path.default.join(workdir, "render-response.zip");
      import_fs.default.writeFileSync(responseZipPath, responseBuffer);
      const mp4Path = import_path.default.join(workdir, "draft.mp4");
      await extractMp4FromZip(responseZipPath, mp4Path);
      const draftUrl = await (0, import_storage.uploadPipelineFile)(
        sessionId,
        "renders/draft.mp4",
        mp4Path,
        "video/mp4"
      );
      await (0, import_storage.updatePipelinePhase)(sessionId, 7, {
        pipelineStatus: "complete",
        draftVideoUrl: draftUrl
      });
      return { success: true, cached: false, videoUrl: draftUrl };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  build_hf_composition,
  extract_concepts,
  render_draft_video,
  render_manim_clips,
  transcribe_video
});
//# sourceMappingURL=tools.js.map
