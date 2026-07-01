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
var session_exports = {};
__export(session_exports, {
  ensureSession: () => ensureSession,
  getRecentMessages: () => getRecentMessages,
  getUserSessions: () => getUserSessions,
  writeMessage: () => writeMessage
});
module.exports = __toCommonJS(session_exports);
var import_firebase = require("./firebase");
var import_firestore = require("firebase-admin/firestore");
async function ensureSession(sessionId, userId, title) {
  const ref = import_firebase.db.collection("sessions").doc(sessionId);
  const existing = await ref.get();
  const payload = {
    userId,
    status: "active",
    createdAt: import_firestore.FieldValue.serverTimestamp()
  };
  if (!existing.exists || !existing.data()?.title) {
    payload.title = title;
  }
  await ref.set(payload, { merge: true });
}
async function writeMessage(sessionId, role, content, attachment) {
  await import_firebase.db.collection("sessions").doc(sessionId).collection("messages").add({
    role,
    content,
    ...attachment?.videoUrl ? { videoUrl: attachment.videoUrl } : {},
    ...attachment?.videoName ? { videoName: attachment.videoName } : {},
    createdAt: import_firestore.FieldValue.serverTimestamp()
  });
  await import_firebase.db.collection("sessions").doc(sessionId).set(
    {
      lastMessageAt: import_firestore.FieldValue.serverTimestamp(),
      messageCount: import_firestore.FieldValue.increment(1)
    },
    { merge: true }
  );
}
async function getRecentMessages(sessionId, limitCount = 50) {
  const snapshot = await import_firebase.db.collection("sessions").doc(sessionId).collection("messages").orderBy("createdAt", "asc").limit(limitCount).get();
  if (snapshot.empty) {
    return [];
  }
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      role: data.role,
      content: data.content
    };
  });
}
async function getUserSessions(userId, limitCount = 20) {
  const snapshot = await import_firebase.db.collection("sessions").where("userId", "==", userId).get();
  const sessions = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const lastMessageAtRaw = data.lastMessageAt ?? data.createdAt;
    if (!lastMessageAtRaw) {
      continue;
    }
    const lastMessageAt = lastMessageAtRaw instanceof import_firestore.Timestamp ? lastMessageAtRaw.toDate() : new Date(lastMessageAtRaw);
    sessions.push({
      sessionId: doc.id,
      title: data.title || "Untitled Chat",
      lastMessageAt,
      messageCount: data.messageCount ?? 0
    });
  }
  return sessions.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime()).slice(0, limitCount);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ensureSession,
  getRecentMessages,
  getUserSessions,
  writeMessage
});
//# sourceMappingURL=session.js.map
