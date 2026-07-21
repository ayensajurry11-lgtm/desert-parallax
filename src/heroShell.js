/* ============================================================
   heroShell.js — the hero as an exploding brick shell
   ------------------------------------------------------------
   Arctic variant: rock+snow textured bricks with frost glow.
   ============================================================ */

import * as THREE from 'three';
import { makeRockSnowMaps } from './textures.js';

const RADIUS = 2.4;
const BRICK_DEPTH = 0.62;
const BRICK_BEVEL = 0.085;
const BRICK_INSET = 0.10;
const EXPLODE_REACH = 2.2;
const EXPLODE_PUSH = 1.1;
const DRAG_PUSH = 1.6;
const SPRING_K = 26;
const SPRING_DAMP = 6.5;
const BREATHE_AMP = 0.13;
const BREATHE_FREQ = 1.5;

export function createHeroShell() {
  const group = new THREE.Group();
  group.name = 'mass-hero';

  /* ---- rock+snow material with depth maps --------------------- */
  const rockMaps = makeRockSnowMaps();
  const material = new THREE.MeshStandardMaterial({
    map: rockMaps.map,
    bumpMap: rockMaps.bump,
    bumpScale: 0.18,
    color: 0xc8d0d8,
    roughness: 0.92,
    metalness: 0.0,
    transparent: true,
  });

  // ---- build one BEVELED brick per icosahedron face ----------
  const source = new THREE.IcosahedronGeometry(RADIUS, 1);
  const p = source.attributes.position;
  const pieces = [];
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();

  for (let f = 0; f < p.count; f += 3) {
    vA.fromBufferAttribute(p, f);
    vB.fromBufferAttribute(p, f + 1);
    vC.fromBufferAttribute(p, f + 2);
    const A = vA.clone(), B = vB.clone(), C = vC.clone();

    const nOut = new THREE.Vector3().subVectors(B, A)
      .cross(new THREE.Vector3().subVectors(C, A)).normalize();
    const centroid = A.clone().add(B).add(C).divideScalar(3);
    if (nOut.dot(centroid) < 0) nOut.negate();

    const u = new THREE.Vector3().subVectors(B, A).normalize();
    const zAxis = nOut.clone().negate();
    const v = new THREE.Vector3().crossVectors(zAxis, u).normalize();

    const to2 = (pt) => {
      const d = pt.clone().sub(A);
      return new THREE.Vector2(d.dot(u), d.dot(v));
    };
    const a2 = to2(A), b2 = to2(B), c2 = to2(C);
    const cen2 = a2.clone().add(b2).add(c2).multiplyScalar(1 / 3);
    a2.lerp(cen2, BRICK_INSET); b2.lerp(cen2, BRICK_INSET); c2.lerp(cen2, BRICK_INSET);

    const shape = new THREE.Shape([a2, b2, c2]);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: BRICK_DEPTH,
      bevelEnabled: true,
      bevelThickness: BRICK_BEVEL,
      bevelSize: BRICK_BEVEL,
      bevelSegments: 3,
      steps: 1,
      curveSegments: 1,
    });
    geo.applyMatrix4(new THREE.Matrix4().makeBasis(u, v, zAxis).setPosition(A));

    const brickMat = material.clone();
    brickMat.opacity = 0;
    // Random UV offset per brick for texture variety
    brickMat.map = rockMaps.map.clone();
    brickMat.map.offset.set(Math.random(), Math.random());
    brickMat.map.needsUpdate = true;
    brickMat.bumpMap = rockMaps.bump.clone();
    brickMat.bumpMap.offset.set(Math.random(), Math.random());
    brickMat.bumpMap.needsUpdate = true;
    const brick = new THREE.Mesh(geo, brickMat);
    brick.castShadow = true;
    brick.receiveShadow = true;
    brick.userData.mat = brickMat;
    brick.userData.centroid = centroid;
    brick.userData.dir = nOut.clone();
    brick.userData.offset = new THREE.Vector3();
    brick.userData.vel = new THREE.Vector3();
    brick.userData.phase =
      (centroid.y / RADIUS) * Math.PI * 1.6 +
      Math.atan2(centroid.z, centroid.x) * 0.6;
    group.add(brick);
    pieces.push(brick);
  }

  // ---- glowing interior (cold ice glow) -----------------------
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(RADIUS * 0.62, 1),
    new THREE.MeshBasicMaterial({ color: 0x90b8d0, transparent: true, opacity: 0 })
  );
  core.name = 'hero-core';
  group.add(core);
  const coreLight = new THREE.PointLight(0x80b0d0, 0, 10, 1.6);
  group.add(coreLight);

  // ---- electricity wave sparks (ice blue) ---------------------
  const SPARK_ARCS = 34, SPARK_SEG = 5;
  const sparkPos = new Float32Array(SPARK_ARCS * (SPARK_SEG - 1) * 2 * 3);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.LineSegments(
    sparkGeo,
    new THREE.LineBasicMaterial({
      color: 0xa0c8e0, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  sparks.name = 'hero-sparks';
  sparks.frustumCulled = false;
  group.add(sparks);

  // ---- pointer state ------------------------------------------
  const pointer = {
    hit: new THREE.Vector3(), hasHit: false,
    vel: new THREE.Vector3(),
    hover: 0,
  };
  function setPointer(hitWorld, velWorld, hover) {
    pointer.hasHit = !!hitWorld;
    if (hitWorld) pointer.hit.copy(hitWorld);
    pointer.vel.copy(velWorld);
    pointer.hover = hover;
  }

  let assembling = false;
  function assemble() { assembling = true; }

  const SPHERE_TOP = RADIUS * 1.3;

  // Pre-compute per-brick neutral colors (rock palette)
  const warmBase = new THREE.Color(0xc8d0d8);
  const coolSolid = new THREE.Color(0xb8c4d0);
  const glowEdge = new THREE.Color(0x80b0d0);

  function setWave(frontY, glow) {
    // Wide soft band: 1.2 units total transition zone
    const WAVE_HALF = 0.6;
    // Leading glow zone sits 0.8 units ahead of the solidification line
    const GLOW_AHEAD = 0.8;
    const GLOW_HALF = 0.35;

    for (const b of pieces) {
      const cy = b.userData.centroid.y;
      const mat = b.userData.mat;

      // Solidification: smooth ramp over wide band
      const solid = THREE.MathUtils.smoothstep(cy, frontY - WAVE_HALF, frontY + WAVE_HALF);
      mat.opacity = solid;

      // Color: cool→warm gradient through the wave front
      const colorMix = THREE.MathUtils.smoothstep(cy, frontY + WAVE_HALF, frontY - WAVE_HALF);
      mat.color.copy(coolSolid).lerp(warmBase, colorMix);

      // Glow zone: brighter emission band leading the wave
      const glowDist = Math.abs(cy - (frontY + GLOW_AHEAD));
      const glowBand = 1.0 - THREE.MathUtils.smoothstep(glowDist, 0, GLOW_HALF);
      if (glowBand > 0.01 && glow > 0.01) {
        mat.emissive.copy(glowEdge);
        mat.emissiveIntensity = glowBand * glow * 0.4;
      } else {
        mat.emissiveIntensity = 0;
      }
    }

    // Sparks: concentrate along the wave front, not random
    const rr = Math.sqrt(Math.max(0, RADIUS * RADIUS - frontY * frontY)) + 0.05;
    const pa = sparkGeo.attributes.position;
    let w = 0;
    for (let a = 0; a < SPARK_ARCS; a++) {
      const a0 = (a / SPARK_ARCS) * Math.PI * 2 + Math.random() * 0.15;
      const a1 = a0 + (Math.PI * 2 / SPARK_ARCS) * (0.4 + Math.random() * 0.4);
      // Spark band width tightens with glow
      const bandH = 0.15 + (1 - glow) * 0.25;
      let px = Math.cos(a0) * rr, pz = Math.sin(a0) * rr, py = frontY;
      for (let s = 1; s < SPARK_SEG; s++) {
        const t = s / (SPARK_SEG - 1);
        const ang = a0 + (a1 - a0) * t;
        const jr = rr + (Math.random() - 0.5) * 0.3;
        const ny = frontY + (Math.random() - 0.5) * bandH;
        const nx = Math.cos(ang) * jr, nz = Math.sin(ang) * jr;
        pa.setXYZ(w++, px, py, pz);
        pa.setXYZ(w++, nx, ny, nz);
        px = nx; py = ny; pz = nz;
      }
    }
    pa.needsUpdate = true;
    sparks.material.opacity = glow * 0.85;
    coreLight.intensity = 8 + glow * 30;
    core.material.opacity = 0.3 + glow * 0.5;
  }

  // ---- physics ---------------------------------------------------
  const hitLocal = new THREE.Vector3();
  const velLocal = new THREE.Vector3();
  const target = new THREE.Vector3();
  const force = new THREE.Vector3();
  const _invMatrix = new THREE.Matrix4();   // pre-allocated for worldToLocal velocity transform

  let t = 0;

  function tick(dt) {
    if (!assembling) return;
    t += dt;

    const breatheAmt = BREATHE_AMP * (1 - pointer.hover);

    if (pointer.hasHit) {
      hitLocal.copy(pointer.hit);
      group.worldToLocal(hitLocal);
      velLocal.copy(pointer.vel)
        .transformDirection(_invMatrix.copy(group.matrixWorld).invert())
        .multiplyScalar(pointer.vel.length());
    }

    let glowTotal = 0;

    for (const b of pieces) {
      const u = b.userData;

      target.copy(u.dir).multiplyScalar(
        breatheAmt * Math.sin(t * BREATHE_FREQ - u.phase)
      );
      if (pointer.hasHit && pointer.hover > 0.02) {
        const d = u.centroid.distanceTo(hitLocal);
        const prox = Math.exp(-((d / EXPLODE_REACH) ** 2)) * pointer.hover;
        if (prox > 0.01) {
          target.addScaledVector(u.dir, EXPLODE_PUSH * prox);
          target.addScaledVector(velLocal, DRAG_PUSH * prox * 0.12);
          glowTotal += prox;
        }
      }

      force.copy(target).sub(u.offset).multiplyScalar(SPRING_K);
      u.vel.addScaledVector(force, dt);
      u.vel.multiplyScalar(Math.max(0, 1 - SPRING_DAMP * dt));
      u.offset.addScaledVector(u.vel, dt);
      b.position.copy(u.offset);
    }

    const glow = Math.min(1, glowTotal / 6);
    const breathePulse = 0.5 + 0.5 * Math.sin(t * BREATHE_FREQ * 0.5);
    core.material.opacity = 0.45 + 0.12 * breathePulse + glow * 0.43;
    coreLight.intensity = 14 + 6 * breathePulse + glow * 46;
  }

  group.userData.shell = { pieces, core, setPointer, assemble, setWave, tick };
  return group;
}
