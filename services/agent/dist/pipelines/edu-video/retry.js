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
var retry_exports = {};
__export(retry_exports, {
  withRetry: () => withRetry
});
module.exports = __toCommonJS(retry_exports);
async function withRetry(fn, options = {}) {
  const { maxAttempts = 3, label = "operation", delayMs = 1e3 } = options;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const wait = delayMs * Math.pow(2, attempt - 1);
        console.warn(`[${label}] attempt ${attempt}/${maxAttempts} failed, retrying in ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastError;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  withRetry
});
//# sourceMappingURL=retry.js.map
