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
var loader_exports = {};
__export(loader_exports, {
  detectSkill: () => detectSkill,
  loadAgentMd: () => loadAgentMd,
  loadSkillMd: () => loadSkillMd,
  resolveSkill: () => resolveSkill
});
module.exports = __toCommonJS(loader_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
const SKILLS_BASE = import_path.default.join(__dirname, "../../../../Skills");
const AGENT_MD_PATH = import_path.default.join(__dirname, "../../AGENT.md");
const DEFAULT_AGENT_PROMPT = "You are OkVevo's AI assistant. Help users create educational videos. Be helpful, clear, and concise.";
const SKILL_PATHS = {
  hyperframes: import_path.default.join(SKILLS_BASE, "hyperframes/.agents/skills/hyperframes/SKILL.md"),
  "manim-video": import_path.default.join(SKILLS_BASE, "manim-video/SKILL.md"),
  "edu-video": import_path.default.join(SKILLS_BASE, "edu-video/SKILL.md")
};
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
function loadAgentMd() {
  try {
    if (import_fs.default.existsSync(AGENT_MD_PATH)) {
      return import_fs.default.readFileSync(AGENT_MD_PATH, "utf-8");
    }
  } catch {
  }
  return DEFAULT_AGENT_PROMPT;
}
function detectSkill(messages) {
  const text = getLastMessageText(messages).toLowerCase();
  if (text.includes("edu-video") || text.includes("/edu-video") || text.includes("educational video") || text.includes("generate educational video") || text.includes("teacher video") || text.includes("turn my video into")) {
    return "edu-video";
  }
  if (text.includes("hyperframes") || text.includes("/hyperframes")) {
    return "hyperframes";
  }
  if (text.includes("manim") || text.includes("/manim")) {
    return "manim-video";
  }
  return null;
}
function resolveSkill(messages, skillId) {
  if (skillId) return skillId;
  return detectSkill(messages);
}
function loadSkillMd(skillName) {
  const skillPath = SKILL_PATHS[skillName];
  if (!skillPath) return "";
  try {
    if (import_fs.default.existsSync(skillPath)) {
      return import_fs.default.readFileSync(skillPath, "utf-8");
    }
  } catch {
  }
  return "";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  detectSkill,
  loadAgentMd,
  loadSkillMd,
  resolveSkill
});
//# sourceMappingURL=loader.js.map
