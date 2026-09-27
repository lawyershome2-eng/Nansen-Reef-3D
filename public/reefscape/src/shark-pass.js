// A rare pass, not a trade. One long fish crosses the open water. Shoals
// under it dive for coral, and a ring spreads on the surface behind it.

import * as THREE from 'three';
import { makeFishGeometry, fishMaterial } from './fish-model.js';

const FIRST = 18;
const CROSS = 9.4;

export function createSharkPass(scene, reef) {
  const geometry = makeFishGeometry('anthias');
  const trimData = new Float32Array(4);
  const gaitData = new Float32Array(4);
  const trim = new THREE.InstancedBufferAttribute(trimData, 4).setUsage(THREE.DynamicDrawUsage);
  const gait = new THREE.InstancedBufferAttribute(gaitData, 4).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aFishTrim', trim);
  geometry.setAttribute('aFishGait', gait);
  const mesh = new THREE.InstancedMesh(geometry, fishMaterial('anthias'), 1);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const dummy = new THREE.Object3D();
  const euler = new THREE.Euler(0, 0, 0, 'YZX');
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  hide.setPosition(0, -50, 0);
  mesh.setMatrixAt(0, hide);
  mesh.instanceMatrix.needsUpdate = true;

  const ringGeo = new THREE.RingGeometry(0.82, 1.0, 64);
  const rings = Array.from({ length: 7 }, () => {
    const material = new THREE.MeshBasicMaterial({
      color: 0xd7f1ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 8.22;
    ring.visible = false;
    ring.frustumCulled = false;
    scene.add(ring);
    return { ring, age: 0 };
  });
  let cursor = 0;
  let active = false;
  let started = 0;
  let nextAt = FIRST;
  let dir = 1;
  let lastDrop = 0;

  function drop(x, z) {
    const slot = rings[cursor % rings.length];
    cursor += 1;
    slot.age = 0;
    slot.ring.visible = true;
    slot.ring.position.set(x, 8.22, z);
    slot.ring.scale.setScalar(0.45);
  }

  return {
    update(dt) {
      if (!(dt > 0) || !reef) return;
      const time = reef.time;
      if (!active && time >= nextAt) {
        active = true;
        started = time;
        dir = Math.random() < 0.5 ? -1 : 1;
        nextAt = time + 50 + Math.random() * 26;
        lastDrop = time;
      }
      if (active) {
        const u = (time - started) / CROSS;
        if (u >= 1) {
          active = false;
          mesh.setMatrixAt(0, hide);
          mesh.instanceMatrix.needsUpdate = true;
        } else {
          const x = dir * (-10.2 + u * 20.4);
          const z = 1.05 + Math.sin(u * Math.PI) * 0.45;
          const y = 5.45 + Math.sin(u * Math.PI * 2) * 0.1;
          dummy.position.set(x, y, z);
          dummy.scale.setScalar(2.15);
          euler.set(0, dir > 0 ? 0 : Math.PI, Math.sin(time * 2.2) * 0.08);
          dummy.quaternion.setFromEuler(euler);
          dummy.updateMatrix();
          mesh.setMatrixAt(0, dummy.matrix);
          mesh.instanceMatrix.needsUpdate = true;
          const phase = time * 6.5;
          trim.setXYZW(0, phase, 0.14, 0.08, 0);
          gait.setXYZW(0, phase * 0.45, 1, Math.sin(time * 2.4) * 0.2, 0);
          trim.needsUpdate = true;
          gait.needsUpdate = true;
          if (time - lastDrop > 0.42) {
            drop(x, z);
            lastDrop = time;
          }
          reef.surge(x, z);
        }
      }
      for (const slot of rings) {
        if (!slot.ring.visible) continue;
        slot.age += dt;
        const life = 3.1;
        if (slot.age >= life) {
          slot.ring.visible = false;
          continue;
        }
        const k = slot.age / life;
        slot.ring.scale.setScalar(0.55 + k * 8.2);
        slot.ring.material.opacity = (1 - k) * (1 - k) * 0.42;
      }
    },
  };
}
