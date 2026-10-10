import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { creditsFromRawMicro } from "../gateway/pricing.ts";
import {
  DramaLedger,
  a2vSizeFlag,
  handleDrama,
  loadCatalog,
  reconcilePair,
  reviewHold,
  schemaProblems,
  type LedgerRow,
} from "./dramaGate.ts";

const catalog = loadCatalog();
const fast25 = catalog.cards.find((card) => card.id === "lightricks/ltx-2.5/text-to-video/fast");
const fast23 = catalog.cards.find((card) => card.id === "fal-ai/ltx-2.3/text-to-video/fast");
const audio = catalog.cards.find((card) => card.id === "lightricks/ltx-2.5/audio-to-video/fast");
assert.ok(fast25 && fast23 && audio);
assert.equal(audio.same_pass_audio, false);

const blocked = schemaProblems(fast25, { resolution: "2160p", duration: 12, generate_audio: true, prompt: "x" });
assert.ok(blocked.some((problem) => problem.includes("10s")));

const ledger = new DramaLedger();
ledger.balances.set("u", 1_000_000);
const ignored = await handleDrama("quote", "u", {
  endpoint: fast23.id,
  credits: 1,
  rawUsd: 0.01,
  shot: { job: "text-only", images: 0, videos: 0, audios: 0, durationSeconds: 6, resolution: "1080p" },
}, ledger, catalog);
assert.equal(ignored.status, 200);
const quoted = ignored.body.quote as { credits: number; rawMicro: string };
assert.notEqual(quoted.credits, 1);
assert.equal(quoted.rawMicro, "360000");
assert.equal(quoted.credits, creditsFromRawMicro(360000n));

let falCalls = 0;
const fal = async () => {
  falCalls += 1;
  return { requestId: `req-${falCalls}` };
};
const submitBody = {
  endpoint: fast23.id,
  idempotencyKey: "job-1",
  approvedCredits: quoted.credits,
  shot: { job: "text-only", images: 0, videos: 0, audios: 0, durationSeconds: 6, resolution: "1080p" },
  args: { prompt: "hello" },
  credits: 1,
};
const first = await handleDrama("submit", "u", submitBody, ledger, catalog, { falSubmit: fal });
assert.equal(first.status, 200);
assert.equal(first.body.requestId, "req-1");
const row = ledger.rows[0];
assert.equal(row.args.resolution, "1080p");
assert.equal(row.args.duration, 6);
assert.equal(row.args.generate_audio, true);
assert.equal(falCalls, 1);
const again = await handleDrama("submit", "u", submitBody, ledger, catalog, { falSubmit: fal });
assert.equal(again.body.requestId, "req-1");
assert.equal(falCalls, 1);
const otherUser = await handleDrama("submit", "other", { ...submitBody }, ledger, catalog, { falSubmit: fal });
assert.equal(otherUser.status, 402);
ledger.balances.set("other", 1_000_000);
const otherOk = await handleDrama("submit", "other", { ...submitBody }, ledger, catalog, { falSubmit: fal });
assert.equal(otherOk.status, 200);
assert.equal(otherOk.body.requestId, "req-2");
const changed = await handleDrama("submit", "u", { ...submitBody, args: { prompt: "different" } }, ledger, catalog, { falSubmit: fal });
assert.equal(changed.status, 409);
assert.match(String(changed.body.error), /different body/);
assert.equal(ledger.rows.filter((item) => item.userId === "u" && item.idempotencyKey === "job-1").length, 1);

const over = await handleDrama("submit", "u", {
  ...submitBody,
  idempotencyKey: "too-big",
  approvedCredits: quoted.credits - 1,
}, ledger, catalog, { falSubmit: fal });
assert.equal(over.status, 409);
assert.equal(ledger.rows.some((item) => item.idempotencyKey === "too-big"), false);

const capLedger = new DramaLedger({ cap: 2 });
capLedger.balances.set("u", 1_000_000);
const seed = await handleDrama("submit", "u", { ...submitBody, idempotencyKey: "seed" }, capLedger, catalog, { falSubmit: fal });
assert.equal(seed.status, 200);
const [left, right] = await Promise.all([
  handleDrama("submit", "u", { ...submitBody, idempotencyKey: "a", args: { prompt: "a" } }, capLedger, catalog, { falSubmit: fal }),
  handleDrama("submit", "u", { ...submitBody, idempotencyKey: "b", args: { prompt: "b" } }, capLedger, catalog, { falSubmit: fal }),
]);
const reserved = capLedger.rows.filter((item) => item.status === "reserved");
assert.equal(reserved.length, 2);
assert.equal([left, right].filter((item) => item.status === 409).length, 1);

const longJob = await handleDrama("submit", "u", { ...submitBody, idempotencyKey: "long" }, ledger, catalog, { falSubmit: fal });
assert.equal(longJob.status, 200);
const settled = await handleDrama("collect", "u", {
  idempotencyKey: "long",
  falStatus: "COMPLETED",
  video: { duration: 20, width: 1920, height: 1080 },
  probeSeconds: 20,
}, ledger, catalog);
assert.equal(settled.status, 200);
const longRow = ledger.rows.find((item) => item.idempotencyKey === "long");
assert.ok(longRow);
assert.equal(longRow.settledCredits, longRow.reservedCredits);
assert.ok((longRow.actualCredits ?? 0) > longRow.reservedCredits);
assert.ok(longRow.alerts.some((alert) => alert.includes("actual above reserved")));

const audioLedger = new DramaLedger();
audioLedger.balances.set("u", 1_000_000);
const up = await handleDrama("upload", "u", { mime: "audio/wav", bytes: 1000 }, audioLedger, catalog, {
  probe: () => ({ seconds: 4.2 }),
});
assert.equal(up.status, 200);
assert.equal(up.body.audioSeconds, 4.2);
const audioSubmit = await handleDrama("submit", "u", {
  endpoint: audio.id,
  idempotencyKey: "a2v",
  uploadId: up.body.uploadId,
  approvedCredits: 2000,
  shot: { job: "audio-driven", images: 1, videos: 0, audios: 1, audioSeconds: 1 },
  args: { prompt: "scene", image_url: "upload://still" },
}, audioLedger, catalog, { allowUnshipped: true, falSubmit: fal });
assert.equal(audioSubmit.status, 200, JSON.stringify(audioSubmit.body));
const audioRow = audioLedger.rows[0];
assert.equal(audioRow.audioSeconds, 4.2);
assert.equal(audioRow.rawMicro, "650000");
assert.equal(audioRow.args.resolution, undefined);
assert.equal(audioRow.args.generate_audio, undefined);
const audioDone = await handleDrama("collect", "u", {
  idempotencyKey: "a2v",
  falStatus: "COMPLETED",
  video: { duration: 30, width: 1280, height: 720, num_frames: 121 },
  probeSeconds: 30,
}, audioLedger, catalog);
assert.equal(audioDone.status, 200);
assert.equal(audioRow.actualCredits, audioRow.reservedCredits);
assert.equal(audioRow.settledCredits, audioRow.reservedCredits);
assert.ok(audioRow.alerts.some((alert) => alert.includes("not 1080p")));
assert.ok(audioRow.alerts.some((alert) => alert.includes("mismatch")));
assert.equal(a2vSizeFlag(1920, 1080), null);
assert.equal(a2vSizeFlag(1080, 1920), null);

const url = await handleDrama("upload", "u", { mime: "image/png", bytes: 10, url: "https://example.com/a.png" }, audioLedger, catalog);
assert.equal(url.status, 400);

const limited = new DramaLedger({ chooseLimit: 2, uploadLimit: 1 });
const shot = { job: "text-only", images: 0, videos: 0, audios: 0, durationSeconds: 6, resolution: "1080p", tier: "draft" as const };
assert.equal((await handleDrama("choose", "u", { shot, credits: 1 }, limited, catalog)).status, 200);
assert.equal((await handleDrama("quote", "u", { endpoint: fast23.id, shot, rawUsd: 1 }, limited, catalog)).status, 200);
assert.equal((await handleDrama("choose", "u", { shot }, limited, catalog)).status, 429);
assert.equal((await handleDrama("upload", "u", { mime: "image/png", bytes: 10 }, limited, catalog)).status, 200);
assert.equal((await handleDrama("upload", "u", { mime: "image/png", bytes: 10 }, limited, catalog)).status, 429);
assert.equal(limited.rows.length, 0);

const running = { status: "reserved", holdExpiresAt: 1 } as LedgerRow;
assert.equal(reviewHold(running, "IN_PROGRESS", 10).release, false);
assert.equal(reviewHold(running, "IN_QUEUE", 10).release, false);
assert.equal(reviewHold(running, "IN_PROGRESS", 10).alert, true);
const cancelLedger = new DramaLedger();
cancelLedger.rows.push({ ...row, userId: "c", idempotencyKey: "run", requestId: "req-run", status: "reserved", reservedCredits: 10, falStatus: "IN_PROGRESS" });
cancelLedger.balances.set("c", 0);
const kept = await handleDrama("cancel", "c", { idempotencyKey: "run" }, cancelLedger, catalog, {
  falStatus: async () => ({ status: "IN_PROGRESS" }),
  falCancel: async () => ({ status: "IN_PROGRESS" }),
});
assert.equal(kept.body.held, true);
assert.equal(cancelLedger.rows[0].status, "reserved");
const dropped = await handleDrama("cancel", "c", { idempotencyKey: "run" }, cancelLedger, catalog, {
  falStatus: async () => ({ status: "IN_PROGRESS" }),
  falCancel: async () => ({ status: "CANCELLED" }),
});
assert.equal(dropped.body.status, "released");
assert.equal(cancelLedger.balances.get("c"), 10);

const exact = reconcilePair({ units: 6, rawMicro: 540000n }, { units: 6, rawMicro: 540000n });
assert.equal(exact.unitOk && exact.usdOk, true);
const unitMiss = reconcilePair({ units: 6, rawMicro: 540000n }, { units: 7, rawMicro: 540000n });
assert.equal(unitMiss.unitOk, false);
const inside = reconcilePair({ units: 6, rawMicro: 540050n }, { units: 6, rawMicro: 540000n });
assert.equal(inside.usdOk, true);
const outside = reconcilePair({ units: 6, rawMicro: 542701n }, { units: 6, rawMicro: 540000n });
assert.equal(outside.usdOk, false);

const dir = mkdtempSync(join(tmpdir(), "drama-recon-"));
writeFileSync(join(dir, "ledger.json"), JSON.stringify({ units: 6, rawMicro: "540000" }));
writeFileSync(join(dir, "usage.json"), JSON.stringify({ units: 6, cost: "0.540000" }));
const script = new URL("../../../scripts/drama-reconcile.ts", import.meta.url);
const ran = spawnSync("npx", ["tsx", script.pathname, join(dir, "ledger.json"), join(dir, "usage.json")], { encoding: "utf8" });
assert.equal(ran.status, 0, ran.stderr || ran.stdout);

function walk(root: string, out: string[]) {
  for (const name of readdirSync(root)) {
    if (name === "node_modules" || name === ".git" || name === "dist" || name === ".next" || name.startsWith(".env")) continue;
    const path = join(root, name);
    const info = statSync(path);
    if (info.isDirectory()) walk(path, out);
    else if (/\.(ts|tsx|js|mjs|py|json)$/.test(name)) out.push(path);
  }
}
const roots = [
  join(import.meta.dirname, "../../../..", "OkVevo-Web/src"),
  join(import.meta.dirname, "../../../..", "hermes-agent/okvevo"),
  join(import.meta.dirname, "../../../..", "hermes-agent/apps/desktop/electron"),
  join(import.meta.dirname, "../../../..", "hermes-agent/apps/desktop/src"),
];
const files: string[] = [];
for (const root of roots) walk(root, files);
const keyPattern = /FAL_(?:KEY|API_KEY)\s*=\s*['"][A-Za-z0-9][^'"]{6,}['"]/;
for (const file of files) {
  assert.equal(keyPattern.test(readFileSync(file, "utf8")), false, file);
}
const adapter = readFileSync(join(import.meta.dirname, "../../../..", "hermes-agent/okvevo/drama_fal_adapter.py"), "utf8");
for (const word of ["unit_price", "creditsFromUsd", "rawMicro", "FAL_KEY", "def choose", "MARGIN"]) {
  assert.equal(adapter.includes(word), false, word);
}
assert.match(adapter, /choose/);
assert.match(adapter, /\/api\/gateway\/fal\/drama\//);

const chosen = await handleDrama("choose", "fresh", {
  shot: { job: "multi-slot", images: 3, videos: 0, audios: 0, durationSeconds: 5, aspect: "16:9", tier: "draft", width: 1280, height: 720 },
}, new DramaLedger({ chooseLimit: 5 }), catalog);
const choice = chosen.body.choice as { id: string; credits: number; rawMicro: string };
assert.equal(choice.id, "minimax/h3/reference-to-video");
assert.equal(choice.rawMicro, "250000");
assert.equal(choice.credits, 500);

console.log("dramaGate.selfcheck: ok");
