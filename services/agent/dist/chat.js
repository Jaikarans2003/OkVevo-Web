"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var chat_exports = {};
__export(chat_exports, {
  handleChat: () => handleChat
});
module.exports = __toCommonJS(chat_exports);
var import_ai = require("ai");
var import_openai = require("@ai-sdk/openai");
var import_firebase = require("./firebase");
var import_edu_video = require("./pipelines/edu-video/index");
var import_loader = require("./skills/loader");
var import_session = require("./session");
const openrouter = (0, import_openai.createOpenAI)({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? ""
});
function getLastMessageText(messages) {
  if (messages.length === 0) return "";
  const last = messages[messages.length - 1];
  if (typeof last.content === "string") {
    return last.content;
  }
  if (Array.isArray(last.parts)) {
    return last.parts.filter((part) => part.type === "text").map((part) => part.text).join("");
  }
  return "";
}
function appendVideoContext(systemPrompt, sessionData) {
  if (!sessionData?.videoUrl) return systemPrompt;
  const name = sessionData.videoName ? ` (${sessionData.videoName})` : "";
  return systemPrompt + `

The user has uploaded a teacher video${name} and it is ready for processing. Do not ask whether they have a video file.`;
}
async function handleChat(messages, userId, sessionId, model, videoUrl, pipelineMode, skillId, videoName) {
  const lastUserText = getLastMessageText(messages);
  const title = lastUserText.trim().slice(0, 50);
  await (0, import_session.ensureSession)(sessionId, userId, title);
  await import_firebase.db.collection("sessions").doc(sessionId).set(
    {
      pipelineMode: pipelineMode ?? "auto",
      ...videoUrl ? { videoUrl, ...videoName ? { videoName } : {} } : {}
    },
    { merge: true }
  );
  const sessionSnap = await import_firebase.db.collection("sessions").doc(sessionId).get();
  let sessionData = sessionSnap.data();
  const effectiveVideoUrl = videoUrl ?? sessionData?.videoUrl;
  const effectiveVideoName = videoName ?? sessionData?.videoName;
  await (0, import_session.writeMessage)(
    sessionId,
    "user",
    lastUserText,
    videoUrl ? { videoUrl, videoName } : void 0
  );
  const history = await (0, import_session.getRecentMessages)(sessionId, 50);
  const selectedModel = model ?? "anthropic/claude-haiku-4-5";
  let pipelinePhase = sessionData?.pipelinePhase ?? 0;
  let isEduVideoActive = pipelinePhase >= 2 && pipelinePhase <= 6;
  const resolvedSkill = (0, import_loader.resolveSkill)(messages, skillId);
  const isEduVideoStart = !isEduVideoActive && resolvedSkill === "edu-video";
  if (isEduVideoStart) {
    if (effectiveVideoUrl) {
      await import_firebase.db.collection("sessions").doc(sessionId).set(
        {
          pipelinePhase: 2,
          pipelineStatus: "running",
          pipelineMode: pipelineMode ?? "auto",
          videoUrl: effectiveVideoUrl
        },
        { merge: true }
      );
      pipelinePhase = 2;
      isEduVideoActive = true;
    }
  }
  const historyMessages = history.map((msg) => ({
    role: msg.role,
    content: msg.content
  }));
  if (isEduVideoActive) {
    if (sessionData?.pipelineStatus === "awaiting_approval") {
      await import_firebase.db.collection("sessions").doc(sessionId).set(
        { pipelineStatus: "running", pipelineApproved: true, pipelinePhase: 4 },
        { merge: true }
      );
      const refreshed = await import_firebase.db.collection("sessions").doc(sessionId).get();
      sessionData = refreshed.data() ?? {};
      pipelinePhase = 4;
    }
    const phaseTools = (0, import_edu_video.getAvailableTools)(pipelinePhase, sessionData ?? {});
    const skillMd = (0, import_loader.loadSkillMd)("edu-video");
    const sessionVideoUrl = effectiveVideoUrl ?? sessionData?.videoUrl ?? "";
    const fullSystem = appendVideoContext(
      (0, import_loader.loadAgentMd)() + "\n\n" + skillMd + `

Pipeline context: sessionId=${sessionId}, videoUrl=${sessionVideoUrl}, pipelineMode=${sessionData?.pipelineMode ?? "auto"}`,
      { ...sessionData, videoUrl: sessionVideoUrl }
    );
    const result2 = (0, import_ai.streamText)({
      model: openrouter.chat(selectedModel),
      system: fullSystem,
      messages: historyMessages,
      tools: Object.keys(phaseTools).length > 0 ? phaseTools : void 0,
      stopWhen: (0, import_ai.stepCountIs)(20),
      onError: ({ error }) => {
        console.error("streamText error:", error);
      }
    });
    void result2.text.then(
      (text) => (0, import_session.writeMessage)(sessionId, "assistant", text),
      (error) => {
        console.error("Failed to persist assistant message:", error);
      }
    );
    return result2;
  }
  let fullSystemPrompt = (0, import_loader.loadAgentMd)();
  if (resolvedSkill) {
    const skillContent = (0, import_loader.loadSkillMd)(resolvedSkill);
    if (skillContent) {
      fullSystemPrompt = `${fullSystemPrompt}

${skillContent}`;
    }
  }
  fullSystemPrompt = appendVideoContext(fullSystemPrompt, {
    ...sessionData,
    videoUrl: effectiveVideoUrl ?? sessionData?.videoUrl
  });
  if (isEduVideoStart && !effectiveVideoUrl) {
    fullSystemPrompt += "\n\nThe user invoked edu-video but no video has been uploaded yet. Ask them to upload a teacher video before starting the pipeline.";
  }
  const result = (0, import_ai.streamText)({
    model: openrouter.chat(selectedModel),
    system: fullSystemPrompt,
    messages: historyMessages,
    onError: ({ error }) => {
      console.error("streamText error:", error);
    }
  });
  void result.text.then(
    (text) => (0, import_session.writeMessage)(sessionId, "assistant", text),
    (error) => {
      console.error("Failed to persist assistant message:", error);
    }
  );
  return result;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handleChat
});
//# sourceMappingURL=chat.js.map
