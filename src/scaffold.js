/* ============================================================
   scaffold.js — moving geometric construction lines
   ------------------------------------------------------------
   Glowing white light lines.
   ============================================================ */

import * as THREE from 'three';

const CAGE_COUNT = 16;
const RUNNER_COUNT = 12;

function makeFlowingDashMaterial() {
  const mat = new THREE.LineDashedMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
    dashSize: 0.28,
    gapSize: 0.22,
  });
  mat.userData.uDashOffset = { value: 0 };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDashOffset = mat.userData.uDashOffset;
    shader.fragmentShader = shader.fragmentShader
      .replace('uniform float dashSize;', 'uniform float dashSize;\nuniform float uDashOffset;')
      .replace('mod( vLineDistance,', 'mod( vLineDistance + uDashOffset,');
  };
  return mat;
}

export function createScaffold(scene, getHeight) {
  const group = new THREE.Group();
  group.name = 'scaffold';
  scene.add(group);

  const dashMat = makeFlowingDashMaterial();

  const cageGeos = [
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.EdgesGeometry(new THREE.TetrahedronGeometry(0.9)),
    new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.8)),
  ];

  const cages = [];
  function respawn(cage) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 4.5 + Math.random() * 10.5;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const s = 0.6 + Math.random() * 1.9;
    cage.line.position.set(x, getHeight(x, z) + s * 0.45, z);
    cage.targetScale = s;
    cage.line.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    cage.spin.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.3);
    cage.age = 0;
    cage.life = 5 + Math.random() * 6;
  }

  for (let i = 0; i < CAGE_COUNT; i++) {
    const line = new THREE.LineSegments(cageGeos[i % cageGeos.length], dashMat);
    line.computeLineDistances();
    const cage = { line, spin: new THREE.Vector3(), targetScale: 1, age: 0, life: 1 };
    respawn(cage);
    cage.age = Math.random() * cage.life;
    group.add(line);
    cages.push(cage);
  }

  const runnerPos = new Float32Array(RUNNER_COUNT * 2 * 3);
  const runnerGeo = new THREE.BufferGeometry();
  runnerGeo.setAttribute('position', new THREE.BufferAttribute(runnerPos, 3));
  const runnerMat = new THREE.LineBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.65,
  });
  const runnerLines = new THREE.LineSegments(runnerGeo, runnerMat);
  runnerLines.frustumCulled = false;
  group.add(runnerLines);

  const runners = [];
  function pointOnLand(out) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.5 + Math.random() * 13;
    out.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    out.y = getHeight(out.x, out.z) + 0.15 + Math.random() * 1.6;
    return out;
  }
  for (let i = 0; i < RUNNER_COUNT; i++) {
    runners.push({
      from: pointOnLand(new THREE.Vector3()),
      to: pointOnLand(new THREE.Vector3()),
      t: Math.random(),
      speed: 0.25 + Math.random() * 0.5,
    });
  }
  const head = new THREE.Vector3(), tail = new THREE.Vector3();

  let flare = 0;
  let burstEnergy = 0;
  let globalOpacity = 1;

  function burst() { burstEnergy = 1; }
  function setFlare(v) { flare = v; }
  function setOpacity(v) {
    globalOpacity = v;
    group.visible = v > 0.01;
  }

  function tick(dt, elapsed) {
    if (!group.visible) return;
    burstEnergy = Math.max(0, burstEnergy - dt * 0.25);

    const energy = Math.min(1, 0.35 + flare * 0.65 + burstEnergy);

    dashMat.userData.uDashOffset.value -= dt * (0.6 + energy * 2.4);
    dashMat.opacity = globalOpacity * (0.28 + energy * 0.5);
    runnerMat.opacity = globalOpacity * (0.35 + energy * 0.45);

    for (const c of cages) {
      c.age += dt;
      if (c.age >= c.life) respawn(c);
      const inT = Math.min(c.age / 0.9, 1);
      const outT = Math.min((c.life - c.age) / 0.9, 1);
      const env = Math.min(inT, outT);
      c.line.scale.setScalar(c.targetScale * (0.2 + 0.8 * env * env * (3 - 2 * env)));
      c.line.rotation.x += c.spin.x * dt * (1 + burstEnergy * 2);
      c.line.rotation.y += c.spin.y * dt * (1 + burstEnergy * 2);
      c.line.rotation.z += c.spin.z * dt;
    }

    for (let i = 0; i < RUNNER_COUNT; i++) {
      const r = runners[i];
      r.t += dt * r.speed * (1 + energy);
      if (r.t >= 1) {
        r.from.copy(r.to);
        pointOnLand(r.to);
        r.t = 0;
      }
      const tailT = Math.max(0, r.t - 0.18);
      head.lerpVectors(r.from, r.to, r.t);
      tail.lerpVectors(r.from, r.to, tailT);
      runnerPos.set([tail.x, tail.y, tail.z, head.x, head.y, head.z], i * 6);
    }
    runnerGeo.attributes.position.needsUpdate = true;
  }

  return { group, tick, burst, setFlare, setOpacity };
}
