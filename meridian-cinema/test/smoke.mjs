import assert from 'node:assert/strict';
import { normalizeDexTrade } from '../server/normalize.js';
import { Seen } from '../server/dedupe.js';
import { mockEvent } from '../server/mock.js';
import { Simulation, STRIDE } from '../web/src/simulation.js';
import { usdToT, speciesFor } from '../web/src/mapper.js';

// normalizer: buy vs sell, shape from the Nansen v1 schema
const raw = {
  chain: 'solana', block_timestamp: '2026-09-24T12:00:00Z', transaction_hash: 'abc',
  trader_address: 'T1', trader_address_label: 'Fund', token_bought_address: 'A', token_sold_address: 'B',
  token_bought_amount: 5, token_bought_symbol: 'JUP', token_sold_symbol: 'USDC', trade_value_usd: 42000,
};
let ev = normalizeDexTrade(raw);
assert.equal(ev.side, 'buy'); assert.equal(ev.token.symbol, 'JUP'); assert.equal(ev.from.kind, 'fund');
ev = normalizeDexTrade({ ...raw, token_bought_symbol: 'USDC', token_sold_symbol: 'JUP' });
assert.equal(ev.side, 'sell'); assert.equal(ev.token.symbol, 'JUP');
assert.equal(normalizeDexTrade({ ...raw, trade_value_usd: 0 }), null);

// dedupe
const s = new Seen(); const e1 = normalizeDexTrade(raw);
assert.equal(s.filter([e1, e1]).length, 1); assert.equal(s.filter([e1]).length, 0);

// scale mapping is monotonic and bounded
assert.ok(usdToT(1e3) < usdToT(1e5) && usdToT(1e5) < usdToT(1e7));
assert.equal(usdToT(1e9), 1); assert.equal(speciesFor(usdToT(1e7)), 3);

// simulation: 2 minutes of mock traffic at 60 fps, no NaNs, bounded population
const sim = new Simulation({ seed: 7 });
let buf; let spawned = 0;
for (let f = 0; f < 60 * 120; f++) {
  if (f % 90 === 0) { if (sim.handleEvent(mockEvent({ big: f % 1800 === 0 }))) spawned++; }
  sim.update(1 / 60);
  if (f % 600 === 0) {
    const r = sim.getRenderState(buf); buf = r.buffer;
    for (let i = 0; i < r.count * STRIDE; i++) assert.ok(Number.isFinite(buf[i]), `NaN at ${f}/${i}`);
  }
}
const live = sim.entities.filter((e) => e.event).length;
console.log(`ok: spawned ${spawned}, live event fish ${live}, total ${sim.entities.length}`);
assert.ok(spawned > 0 && live <= sim.cfg.maxEventEntities);
assert.ok(sim.entities.length >= sim.cfg.ambientCount);
