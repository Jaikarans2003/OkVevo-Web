import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { creditsFromRawMicro, creditsFromUsd, rawMicroTimesQuantity, usdNumberToDecimal } from "../gateway/pricing.ts";
import {
  choose,
  quoteCard,
  type DramaCard,
  type Price,
  type RatePrice,
  type Shot,
} from "./dramaChooser.ts";

const cards = JSON.parse(
  readFileSync(new URL("./drama-cards.json", import.meta.url), "utf8")
) as DramaCard[];
const overrides = JSON.parse(
  readFileSync(new URL("./pricing-overrides.json", import.meta.url), "utf8")
) as {
  overrides: {
    id: string;
    billing_basis: "output" | "input_audio";
    rates_by_resolution: Record<string, number>;
  }[];
};

function pricesFor(list: DramaCard[]): Record<string, Price> {
  const prices: Record<string, Price> = {};
  for (const card of list) {
    if (card.billing_unit && card.unit_price != null) {
      prices[card.id] = { unit: card.billing_unit, unitPrice: card.unit_price };
    }
  }
  for (const row of overrides.overrides) {
    prices[row.id] = {
      unit: "seconds",
      billingBasis: row.billing_basis,
      ratesByResolution: row.rates_by_resolution,
    };
  }
  return prices;
}

const prices = pricesFor(cards);

const threeStills: Shot = {
  job: "multi-slot",
  images: 3,
  videos: 0,
  audios: 0,
  durationSeconds: 5,
  aspect: "16:9",
  tier: "draft",
  width: 1280,
  height: 720,
};

const first = choose(cards, prices, threeStills);
const second = choose(cards, prices, threeStills);
assert.deepEqual(first, second);
assert.ok(first.choice);
assert.equal(first.choice.tier, "standard");
assert.match(first.choice.notice ?? "", /no draft model fits this shot; using standard/);
assert.equal(first.choice.credits, creditsFromUsd(first.choice.rawUsd).credits);

const capped = choose(cards, prices, { ...threeStills, spendCapCredits: 100 });
assert.equal(capped.choice, null);
assert.ok(capped.rejections.some((row) => row.reason.includes("spend cap")));

const named = choose(cards, prices, {
  ...threeStills,
  tier: "draft",
  modelId: "fal-ai/ltx-2.3/image-to-video",
  spendCapCredits: undefined,
});
assert.equal(named.choice, null);
assert.ok(named.rejections.some((row) => row.id === "fal-ai/ltx-2.3/image-to-video"));
assert.ok(!named.rejections.some((row) => row.reason.includes("using standard")));

const fast = cards.find((card) => card.id === "lightricks/ltx-2.5/text-to-video/fast");
assert.ok(fast);
const fastPrice = prices[fast.id] as RatePrice;
const low = quoteCard(fast, fastPrice, {
  job: "text-only",
  images: 0,
  videos: 0,
  audios: 0,
  durationSeconds: 6,
  resolution: "720p",
});
const high = quoteCard(fast, fastPrice, {
  job: "text-only",
  images: 0,
  videos: 0,
  audios: 0,
  durationSeconds: 6,
  resolution: "1080p",
});
assert.ok(!("reason" in low) && !("reason" in high));
assert.equal(low.rawUsd, 0.54);
assert.equal(high.rawUsd, 0.78);
assert.ok(high.credits > low.credits);
assert.equal(low.credits, creditsFromUsd(0.54).credits);

const unset = quoteCard(fast, fastPrice, {
  job: "text-only",
  images: 0,
  videos: 0,
  audios: 0,
  durationSeconds: 6,
});
assert.ok(!("reason" in unset));
assert.equal(unset.resolution, "720p");
assert.match(unset.notice ?? "", /using 720p/);

const refused = quoteCard(fast, fastPrice, {
  job: "text-only",
  images: 0,
  videos: 0,
  audios: 0,
  durationSeconds: 6,
  resolution: "480p",
});
assert.ok("reason" in refused);

const audioCard = cards.find((card) => card.id === "lightricks/ltx-2.5/audio-to-video/fast");
assert.ok(audioCard);
const audioQuote = quoteCard(audioCard, prices[audioCard.id], {
  job: "audio-driven",
  images: 0,
  videos: 0,
  audios: 1,
  audioSeconds: 4.2,
});
assert.ok(!("reason" in audioQuote));
assert.equal(audioQuote.resolution, "1080p");
assert.equal(audioQuote.reservedSeconds, 5);
assert.equal(audioQuote.rawUsd, 0.65);
assert.equal(audioQuote.credits, creditsFromUsd(0.65).credits);

for (const row of overrides.overrides) {
  const card = cards.find((entry) => entry.id === row.id);
  assert.ok(card);
  assert.equal(card.shipped, false);
  for (const [resolution, rate] of Object.entries(row.rates_by_resolution)) {
    const shot: Shot = {
      job: card.jobs[0],
      images: 0,
      videos: 0,
      audios: row.billing_basis === "input_audio" ? 1 : 0,
      durationSeconds: row.billing_basis === "output" ? 6 : undefined,
      audioSeconds: row.billing_basis === "input_audio" ? 1 : undefined,
      resolution,
    };
    const quoted = quoteCard(card, prices[card.id], shot);
    assert.ok(!("reason" in quoted), `${row.id} ${resolution}`);
    const seconds = row.billing_basis === "output" ? 6 : 1;
    const micro = rawMicroTimesQuantity(usdNumberToDecimal(rate), BigInt(seconds));
    assert.equal(quoted.rawMicro, micro.toString());
    assert.equal(quoted.credits, creditsFromRawMicro(micro));
  }
}

const units = ["seconds", "images", "megapixels", "1000 tokens"] as const;
const samples: Record<(typeof units)[number], { raw: number }> = {
  seconds: { raw: 0.05 * 5 },
  images: { raw: 0.02 * 2 },
  megapixels: { raw: 0.001605 * 112 },
  "1000 tokens": { raw: 0.014 * ((720 * 1280 * 5 * 24) / 1024 / 1000) },
};
for (const unit of units) {
  assert.equal(creditsFromUsd(samples[unit].raw).credits, Math.ceil(samples[unit].raw * 2 * 1000));
}


const tokenCard = cards.find((card) => card.id === "bytedance/seedance-2.0/reference-to-video");
assert.ok(tokenCard);
const tokenQuote = quoteCard(tokenCard, prices[tokenCard.id], {
  job: "multi-slot",
  images: 3,
  videos: 0,
  audios: 0,
  durationSeconds: 5,
  width: 1280,
  height: 720,
});
assert.ok(!("reason" in tokenQuote));
assert.equal(tokenQuote.credits, creditsFromUsd(tokenQuote.rawUsd).credits);

const pixelCard = cards.find((card) => card.id === "fal-ai/ltx-2.3-22b/text-to-video");
assert.ok(pixelCard);
const pixelQuote = quoteCard(pixelCard, prices[pixelCard.id], {
  job: "text-only",
  images: 0,
  videos: 0,
  audios: 0,
  width: 1280,
  height: 720,
  frames: 121,
});
assert.ok(!("reason" in pixelQuote), "reason" in pixelQuote ? pixelQuote.reason : "");
assert.equal(pixelQuote.rawMicro, "179760");
assert.equal(pixelQuote.credits, creditsFromRawMicro(179760n));

console.log("dramaChooser.selfcheck: ok", first.choice.id, first.choice.credits);
