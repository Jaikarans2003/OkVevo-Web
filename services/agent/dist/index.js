"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var import_config = require("dotenv/config");
var import_cors = __toESM(require("cors"));
var import_express = __toESM(require("express"));
var import_chat = require("./chat");
const app = (0, import_express.default)();
const PORT = process.env.PORT ?? 3001;
app.use((0, import_cors.default)());
app.use(import_express.default.json());
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "okvevo-agent" });
});
app.post("/chat", async (req, res) => {
  try {
    const { messages, userId, sessionId, model, videoUrl, pipelineMode, skillId, videoName } = req.body;
    const result = await (0, import_chat.handleChat)(messages, userId, sessionId, model, videoUrl, pipelineMode, skillId, videoName);
    result.pipeUIMessageStreamToResponse(res, {
      headers: {
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      },
      onError: (error) => error instanceof Error ? error.message : "An error occurred."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});
app.listen(PORT, () => {
  console.log(`OkVevo Agent running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map
