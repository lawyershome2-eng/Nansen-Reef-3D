import assert from "node:assert/strict";
import test from "node:test";
import { bracketFor, dirFor, eventToParams } from "./mapper.js";

const base = {
  usd: 10_000,
  token: { symbol: "PEPE", address: "0xabc" },
  from: { kind: "wallet", label: "A", address: "0x1" },
  chain: "ethereum",
};

test("buy and in swim one way, sell and out the other", () => {
  assert.equal(dirFor({ ...base, side: "buy" }), 1);
  assert.equal(dirFor({ ...base, side: "in" }), 1);
  assert.equal(dirFor({ ...base, side: "sell" }), -1);
  assert.equal(dirFor({ ...base, side: "out" }), -1);
});

test("a transfer is a drift, not a silent sell", () => {
  const params = eventToParams({ ...base, side: "transfer", to: { address: "0x2" } });
  assert.equal(params.behavior, "drift");
  assert.ok(params.dir === 1 || params.dir === -1);
});

test("a missing actor does not throw", () => {
  const params = eventToParams({ usd: 100, side: "transfer", token: { symbol: "X", address: "0x" }, chain: "base" });
  assert.equal(params.behavior, "drift");
  assert.ok(Number.isFinite(params.scale));
});

test("a holder lingers instead of crossing", () => {
  const params = eventToParams({
    ...base,
    side: "transfer",
    metadata: { role: "holder", rank: 0 },
    from: { kind: "wallet", label: "Wintermute", address: "0xabc" },
  });
  assert.equal(params.behavior, "linger");
  assert.equal(params.bracket, "holder");
  assert.equal(params.lifetime, Infinity);
  assert.ok(params.score > 50);
});

test("size and who decide the bracket", () => {
  assert.equal(bracketFor({ ...base, usd: 200 }), "shrimp");
  assert.equal(bracketFor({ ...base, usd: 10_000 }), "wallet");
  assert.equal(bracketFor({ ...base, usd: 10_000, from: { kind: "smart", label: "S", address: "0x1" } }), "smart");
  assert.equal(bracketFor({ ...base, usd: 50_000, from: { kind: "fund", label: "F", address: "0x1" } }), "institution");
  assert.equal(bracketFor({ ...base, usd: 2_000_000 }), "whale");
});
