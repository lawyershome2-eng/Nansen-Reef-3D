import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// --- bridge: fake browser globals, run the simulation, check what the aquarium would draw
globalThis.window = globalThis;
globalThis.EventSource = class { addEventListener() {} close() {} };
await import('../web/src/bridge.js');
const M = window.Meridian;
const { mockEvent } = await import('../server/mock.js');

const infos = Array.from({ length: 5 }, (_, i) => ({ num: [], fishData: [], lasers: i >= 3 }));
const per = { worldPosition: new Float32Array(3), nextPosition: new Float32Array(3), scale: 1, time: 0 };
let drawn = 0, bad = 0;
const fish = { draw(p) {
  drawn++;
  const v = [...p.worldPosition, ...p.nextPosition, p.scale, p.time];
  if (!v.every(Number.isFinite) || p.scale <= 0) bad++;
  if (p.worldPosition[1] < 5 || p.worldPosition[1] > 50) bad++; // must stay inside the tank band
} };

for (let f = 0; f < 60 * 60; f++) {
  if (f % 60 === 0) M.sim.handleEvent(mockEvent({ big: f % 1200 === 0 }));
  M.step(1 / 60);
  if (f % 300 === 0) {
    drawn = 0;
    for (let ff = 0; ff < 5; ff++) assert.equal(M.drawModel(ff, fish, per, infos[ff], 2, true, 1), true);
    assert.equal(drawn, M.sim.entities.length, 'every entity drawn exactly once');
  }
}
assert.equal(bad, 0, 'bad draw values');
const lasersOk = infos[3].fishData.length === infos[3].num[2];
assert.ok(lasersOk, 'laser data matches count');
console.log('bridge ok: entities', M.sim.entities.length, 'per model', infos.map((i) => i.num[2]).join(','));

// --- patch script on a fixture holding the two exact anchor lines from aquarium.js
mkdirSync('/tmp/fx', { recursive: true });
writeFileSync('/tmp/fx/aquarium.js', `
function render(fishScale){ for (var ff = 0; ff < 5; ++ff) { var fish = {drawPrep(){}}; var fishConstInUse = {}; var fishPer={}, fishInfo={}, g={globals:{},drawLasers:false};
        fish.drawPrep(fishConstInUse);
        var stock = 1; } }
function onAnimationFrame(){ var elapsedTime = 0;
    g_requestId = requestAnimationFrame(onAnimationFrame);
}`);
writeFileSync('/tmp/fx/aquarium.html', '<html><body>hi</body></html>');
const run = () => execFileSync('node', ['tools/patch-aquarium.mjs', '/tmp/fx/aquarium.js', '/tmp/fx/aquarium.html']).toString();
console.log(run());
execFileSync('node', ['--check', '/tmp/fx/aquarium.js']);
assert.ok(readFileSync('/tmp/fx/aquarium.html', 'utf8').includes('/src/bridge.js'));
assert.match(run(), /already patched/); // idempotent
console.log('patch script ok');
