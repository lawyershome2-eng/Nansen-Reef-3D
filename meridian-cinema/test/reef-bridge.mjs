// Exercises the meridian-bridge geometry/instancing path under plain Node using the
// vendored three.module.js. This does NOT prove it renders correctly in a browser
// (no WebGL context here), but it does catch: import errors, geometry/shader wiring
// errors, NaNs, and matrix corruption over a run of synthetic events.
import assert from 'node:assert/strict';
globalThis.self = globalThis; // three.module.js checks for this in a couple of spots

globalThis.window = globalThis;
globalThis.EventSource = class { addEventListener() {} close() {} };

// Import the same specifier the bridge itself resolves ('three' -> node_modules/three,
// shimmed to the vendored file) so both get the same module instance. Importing the
// vendor path directly here would create a second Three.js instance and instanceof
// checks like isInstancedMesh would silently fail.
const THREE = await import('three');
const { createMeridianBridge } = await import('../web/reefscape/src/meridian-bridge.js');
const { mockEvent } = await import('../server/mock.js');

const scene = new THREE.Scene();
const bridge = createMeridianBridge(scene);

// two InstancedMesh objects (chromis, anthias) should be in the scene
const meshes = scene.children.filter((c) => c.isInstancedMesh);
assert.equal(meshes.length, 2, 'expected 2 instanced pools in the scene');
for (const m of meshes) {
  assert.ok(m.geometry.attributes.aFishTrim, 'aFishTrim attribute present');
  assert.ok(m.geometry.attributes.aFishGait, 'aFishGait attribute present');
  assert.equal(m.geometry.attributes.aFishTrim.count, m.count);
}

let spawned = 0;
const mat = new THREE.Matrix4();
const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scale = new THREE.Vector3();

for (let f = 0; f < 60 * 90; f++) {
  if (f % 20 === 0) { bridge.sim.handleEvent(mockEvent({ big: f % 900 === 0 })); spawned++; }
  bridge.update(1 / 60);

  if (f % 300 === 0) {
    for (const m of meshes) {
      for (let i = 0; i < m.count; i++) {
        m.getMatrixAt(i, mat);
        mat.decompose(pos, quat, scale);
        // Matrix4.decompose divides by scale to recover rotation, so a legitimately
        // zero-scale (hidden) instance yields a NaN quaternion even though the matrix
        // itself is fine for GPU rendering. Only check position/scale there.
        const checks = scale.x > 1e-9 ? [pos.x, pos.y, pos.z, scale.x, quat.x, quat.y, quat.z, quat.w] : [pos.x, pos.y, pos.z, scale.x];
        for (const v of checks) assert.ok(Number.isFinite(v), `non-finite value at frame ${f}, instance ${i}`);
        // A visibly-scaled fish (comfortably past its fade-in) must sit inside the
        // mid-water zone. A fading entity keeps its real position with shrinking scale,
        // which is correct (no teleport), so only check the zone once scale is well past
        // the decompose noise floor, not merely nonzero.
        if (scale.x > 0.02) {
          assert.ok(pos.y > 3 && pos.y < 7.1, `fish y out of zone at frame ${f}: ${pos.y}`);
          assert.ok(Math.abs(pos.x) <= 8.5, `fish x out of zone at frame ${f}: ${pos.x}`);
        }
      }
      const trim = m.geometry.attributes.aFishTrim.array;
      for (const v of trim) assert.ok(Number.isFinite(v), 'non-finite aFishTrim value');
    }
  }
}

const liveChromis = meshes[0].count, liveAnthias = meshes[1].count;
console.log(`reef bridge ok: spawned ${spawned} events, pools sized ${liveChromis}/${liveAnthias}, live entities ${bridge.sim.entities.length}`);
assert.ok(bridge.sim.entities.length > 0);
