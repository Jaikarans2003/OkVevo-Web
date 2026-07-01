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
var storage_exports = {};
__export(storage_exports, {
  downloadPipelineJson: () => downloadPipelineJson,
  pipelineFileExists: () => pipelineFileExists,
  updatePipelinePhase: () => updatePipelinePhase,
  uploadPipelineFile: () => uploadPipelineFile,
  uploadPipelineJson: () => uploadPipelineJson
});
module.exports = __toCommonJS(storage_exports);
var import_fs = __toESM(require("fs"));
var import_firestore = require("firebase-admin/firestore");
var import_storage = require("firebase-admin/storage");
var import_firebase = require("../../firebase");
const bucket = () => (0, import_storage.getStorage)().bucket((0, import_firebase.getStorageBucketName)());
const pipelinePath = (sessionId, file) => `projects/${sessionId}/pipeline/${file}`;
function getPublicUrl(bucketName, filePath) {
  return `https://storage.googleapis.com/${bucketName}/${filePath}`;
}
async function pipelineFileExists(sessionId, file) {
  try {
    const [exists] = await bucket().file(pipelinePath(sessionId, file)).exists();
    return exists;
  } catch {
    return false;
  }
}
async function uploadPipelineJson(sessionId, file, data) {
  const filePath = pipelinePath(sessionId, file);
  const fileRef = bucket().file(filePath);
  await fileRef.save(JSON.stringify(data), { contentType: "application/json" });
  await fileRef.makePublic();
  return getPublicUrl(fileRef.bucket.name, filePath);
}
async function downloadPipelineJson(sessionId, file) {
  const filePath = pipelinePath(sessionId, file);
  try {
    const [buffer] = await bucket().file(filePath).download();
    return JSON.parse(buffer.toString());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Pipeline file not found or unreadable: ${filePath} (${message})`);
  }
}
async function uploadPipelineFile(sessionId, storagePath, localPath, contentType) {
  const filePath = pipelinePath(sessionId, storagePath);
  const fileRef = bucket().file(filePath);
  await fileRef.save(import_fs.default.readFileSync(localPath), { contentType });
  await fileRef.makePublic();
  return getPublicUrl(fileRef.bucket.name, filePath);
}
async function updatePipelinePhase(sessionId, phase, extra) {
  await import_firebase.db.collection("sessions").doc(sessionId).set(
    {
      pipelinePhase: phase,
      pipelineUpdatedAt: import_firestore.FieldValue.serverTimestamp(),
      ...extra
    },
    { merge: true }
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  downloadPipelineJson,
  pipelineFileExists,
  updatePipelinePhase,
  uploadPipelineFile,
  uploadPipelineJson
});
//# sourceMappingURL=storage.js.map
