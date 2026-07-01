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
var firebase_exports = {};
__export(firebase_exports, {
  db: () => db,
  getStorageBucketName: () => getStorageBucketName
});
module.exports = __toCommonJS(firebase_exports);
var import_app = require("firebase-admin/app");
var import_firestore = require("firebase-admin/firestore");
function loadServiceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    return JSON.parse(json);
  }
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FB_SERVICE_ACCOUNT_KEY;
  if (b64) {
    return JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
  }
  throw new Error(
    "Missing Firebase service account key (FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_KEY)"
  );
}
function getStorageBucketName() {
  return process.env.FIREBASE_STORAGE_BUCKET || process.env.FB_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "text2video-16cbf.firebasestorage.app";
}
function getAdminApp() {
  if ((0, import_app.getApps)().length > 0) {
    return (0, import_app.getApps)()[0];
  }
  return (0, import_app.initializeApp)({
    credential: (0, import_app.cert)(loadServiceAccount()),
    storageBucket: getStorageBucketName()
  });
}
const app = getAdminApp();
const db = (0, import_firestore.getFirestore)(app);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  db,
  getStorageBucketName
});
//# sourceMappingURL=firebase.js.map
