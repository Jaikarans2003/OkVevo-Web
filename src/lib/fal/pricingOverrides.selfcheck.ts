import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { rateMissingFromEnum, type DramaCard, type RatePrice } from "./dramaChooser.ts";

const DETERMINISTIC = new Set([
  "seconds",
  "images",
  "megapixels",
  "processed megapixels",
  "1000 tokens",
]);

type Row = {
  id: string;
  unit: string;
  billing_basis: "output" | "input_audio";
  rates_by_resolution: Record<string, number>;
  source: string;
  as_of: string;
};

const raw = JSON.parse(
  readFileSync(new URL("./pricing-overrides.json", import.meta.url), "utf8")
) as { overrides: Row[] };
assert.ok(Array.isArray(raw.overrides));
const cards = JSON.parse(
  readFileSync(new URL("./drama-cards.json", import.meta.url), "utf8")
) as DramaCard[];

for (const item of raw.overrides) {
  assert.equal(typeof item.id, "string");
  assert.ok(DETERMINISTIC.has(item.unit));
  assert.ok(item.billing_basis === "output" || item.billing_basis === "input_audio");
  assert.equal(typeof item.source, "string");
  assert.equal(typeof item.as_of, "string");
  for (const rate of Object.values(item.rates_by_resolution)) {
    assert.equal(typeof rate, "number");
    assert.ok(rate > 0);
  }
  const card = cards.find((entry) => entry.id === item.id);
  assert.ok(card, item.id);
  assert.equal(card.shipped, false);
  const price: RatePrice = {
    unit: "seconds",
    billingBasis: item.billing_basis,
    ratesByResolution: item.rates_by_resolution,
  };
  assert.equal(rateMissingFromEnum(card, price), null, item.id);
}

const fake: DramaCard = {
  id: "example",
  max_images: 0,
  max_videos: 0,
  max_audio: 0,
  duration: null,
  aspects: null,
  jobs: [],
  tier: "draft",
  billing_unit: "seconds",
  unit_price: null,
  shipped: false,
  input_schema: { properties: { resolution: { enum: ["2160p"] } } },
};
assert.equal(
  rateMissingFromEnum(fake, {
    unit: "seconds",
    billingBasis: "output",
    ratesByResolution: { "4K": 0.3 },
  }),
  "4K"
);

console.log("pricingOverrides.selfcheck: ok");
