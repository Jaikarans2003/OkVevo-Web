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
var edu_video_exports = {};
__export(edu_video_exports, {
  build_hf_composition: () => import_tools.build_hf_composition,
  extract_concepts: () => import_tools.extract_concepts,
  getAvailableTools: () => getAvailableTools,
  getPhaseTools: () => getPhaseTools,
  render_draft_video: () => import_tools.render_draft_video,
  render_manim_clips: () => import_tools.render_manim_clips,
  transcribe_video: () => import_tools.transcribe_video
});
module.exports = __toCommonJS(edu_video_exports);
var import_tools = require("./tools");
function getAvailableTools(pipelinePhase, sessionData) {
  const pipelineMode = sessionData?.pipelineMode ?? "auto";
  const awaitingApproval = sessionData?.pipelineStatus === "awaiting_approval";
  if (pipelinePhase < 2) return {};
  if (pipelinePhase >= 7) return {};
  if (awaitingApproval && pipelineMode === "ask") return {};
  const tools = {};
  if (pipelinePhase <= 2) tools.transcribe_video = import_tools.transcribe_video;
  if (pipelinePhase <= 3) tools.extract_concepts = import_tools.extract_concepts;
  if (pipelinePhase <= 4) tools.render_manim_clips = import_tools.render_manim_clips;
  if (pipelinePhase <= 5) tools.build_hf_composition = import_tools.build_hf_composition;
  if (pipelinePhase <= 6) tools.render_draft_video = import_tools.render_draft_video;
  return tools;
}
function getPhaseTools(phase) {
  return getAvailableTools(phase, {});
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  build_hf_composition,
  extract_concepts,
  getAvailableTools,
  getPhaseTools,
  render_draft_video,
  render_manim_clips,
  transcribe_video
});
//# sourceMappingURL=index.js.map
