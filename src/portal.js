/* ============================================================
   portal.js — scroll-assembled 3-ring dive tunnel (desert stone)
   ------------------------------------------------------------
   Desert variant: rugged stone rings, warm halo glow, sequential
   proximity-based assembly. Blocks scatter/assemble based on
   camera Z-distance. Fully reversible on scroll-back.
   ============================================================ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeDesertStoneMaps } from './textures.js';

const RING_MODEL_URL = '/models/portal-ring.glb';
const RING_NATIVE_RADIUS = 1.467;

const RING_SPECS = [
  { radius: 5.4, y: -42.0, spin:  0.01 },
  { radius: 4.4, y: -47.0, spin: -0.015 },
  { radius: 3.4, y: -52.0, spin:  0.02 },
  { radius: 2.4, y: -57.0, spin: -0.025 },
];
const CORE_Y = -62.0;
const RING_UV_REPEAT = 2;

const FORM_RANGE = 18.0;
const LEG_GATE_A = 2.0, LEG_GATE_B = 2.5;

const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

/* soft ring-shaped glow texture (aurora cyan) */
function makeHaloTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0.52, 'rgba(160,230,250,0)');
  g.addColorStop(0.62, 'rgba(140,220,240,0.85)');
  g.addColorStop(0.68, 'rgba(120,210,230,0.2)');
  g.addColorStop(0.82, 'rgba(100,200,220,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/* soft blob texture for the core glow (aurora green-cyan) */
function makeCoreTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0.0, 'rgba(180,240,230,1)');
  g.addColorStop(0.35, 'rgba(150,225,235,0.8)');
  g.addColorStop(1.0, 'rgba(120,210,230,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

const SPRING_K = 4.5;
const SPRING_DAMP = 2.8;

export async function createPortal(scene, camera) {
  const group = new THREE.Group();
  group.name = 'portal';
  scene.add(group);

  const haloTex = makeHaloTexture();
  const stoneMaps = makeDesertStoneMaps();

  const gltf = await new GLTFLoader().loadAsync(RING_MODEL_URL);
  const template = gltf.scene;

  const vTmp = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpEuler = new THREE.Euler();
  const orbitOffset = new THREE.Vector3();
  const springTarget = new THREE.Vector3();
  const springForce = new THREE.Vector3();

  const rings = RING_SPECS.map((spec, ri) => {
    const wrap = new THREE.Group();
    wrap.position.y = spec.y;
    group.add(wrap);

    const ring = new THREE.Group();
    ring.scale.setScalar(spec.radius / RING_NATIVE_RADIUS);
    wrap.add(ring);

    // Frozen stone material for the ring blocks
    const map = stoneMaps.map.clone();  map.repeat.set(RING_UV_REPEAT, 1);  map.needsUpdate = true;
    const bump = stoneMaps.bump.clone(); bump.repeat.set(RING_UV_REPEAT, 1); bump.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({
      map, bumpMap: bump,
      bumpScale: 0.15,
      color: 0xcccccc,         // light gray stone
      roughness: 0.92,         // rough matte surface
      metalness: 0.0,
      transparent: false,
      opacity: 1,
      emissive: 0x3a4a58,      // subtle cool self-illumination
      emissiveIntensity: 0.15,
    });

    const src = template.clone(true);
    const meshes = [];
    src.traverse((c) => { if (c.isMesh) meshes.push(c); });

    const blocks = meshes.map((mesh, bi) => {
      const blockMat = mat.clone();
      mesh.material = blockMat;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      ring.add(mesh);

      const homePos = mesh.position.clone();
      const homeQuat = mesh.quaternion.clone();

      mesh.geometry.computeBoundingBox();
      mesh.geometry.boundingBox.getCenter(vTmp)
        .applyQuaternion(homeQuat).add(homePos);
      const radial = new THREE.Vector3(vTmp.x, 0, vTmp.z);
      if (radial.lengthSq() < 1e-4) {
        const a = (bi / meshes.length) * Math.PI * 2;
        radial.set(Math.cos(a), 0, Math.sin(a));
      }
      radial.normalize();

      const dist = RING_NATIVE_RADIUS * (0.15 + Math.random() * 0.35);
      const scatterPos = homePos.clone()
        .addScaledVector(radial, dist)
        .add(new THREE.Vector3(0, RING_NATIVE_RADIUS * (Math.random() - 0.5) * 0.10, 0));
      const scatterQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 3
        )
      );

      const vel = new THREE.Vector3();
      const angVel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.4
      );

      const driftSpeed = 0.3 + Math.random() * 0.6;
      const driftPhase = Math.random() * Math.PI * 2;
      const tumbleRate = 0.4 + Math.random() * 0.8;
      const tumblePhase = Math.random() * Math.PI * 2;
      const arrivalOffset = Math.abs(radial.z) * 0.15 + Math.random() * 0.12;

      return {
        mesh, blockMat, homePos, homeQuat, scatterPos, scatterQuat,
        vel, angVel,
        driftSpeed, driftPhase, tumbleRate, tumblePhase, arrivalOffset,
      };
    });

    // Halo: warm amber glow
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(spec.radius * 3.3, spec.radius * 3.3),
      new THREE.MeshBasicMaterial({
        map: haloTex, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = spec.y;
    group.add(halo);

    return { wrap, ring, mat, blocks, halo, spec, form: 0, formed: false };
  });

  // Core glow (warm desert light)
  const core = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 7),
    new THREE.MeshBasicMaterial({
      map: makeCoreTexture(), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  core.rotation.x = -Math.PI / 2;
  core.position.y = CORE_Y;
  group.add(core);

  function tick(dt, elapsed, legPos, speed) {
    dt = Math.min(dt, 0.05);

    group.visible = legPos > LEG_GATE_A - 1.0;
    if (!group.visible) return;

    const energy = Math.min(1, 0.2 + speed * 6);
    const camY = camera.position.y;
    const legGate = THREE.MathUtils.smoothstep(legPos, LEG_GATE_A - 0.5, LEG_GATE_B);
    let maxForm = 0;

    for (let ri = 0; ri < rings.length; ri++) {
      const R = rings[ri];
      const { ring, mat, blocks, halo, spec } = R;
      const dist = camY - spec.y;

      let formTarget;
      if (dist > 0) {
        formTarget = 1 - THREE.MathUtils.smoothstep(dist, 0, FORM_RANGE);
      } else {
        formTarget = THREE.MathUtils.smoothstep(dist, -10, 0);
      }
      R.form += (formTarget - R.form) * Math.min(1, dt * 3.5);
      const f = R.form;

      const vis = legGate * Math.max(0.15, f);

      for (let bi = 0; bi < blocks.length; bi++) {
        const b = blocks[bi];
        const blockForm = Math.max(0, Math.min(1, (f - b.arrivalOffset) / (1 - b.arrivalOffset + 0.01)));

        if (blockForm < 0.05) {
          const scatterVis = legGate * Math.max(0.6, f);
          b.mesh.visible = scatterVis > 0.05;
          b.blockMat.opacity = scatterVis;
          const dx = Math.sin(elapsed * b.driftSpeed + b.driftPhase) * 0.06;
          const dy = Math.cos(elapsed * b.driftSpeed * 0.7 + b.driftPhase * 1.3) * 0.04;
          const dz = Math.sin(elapsed * b.driftSpeed * 0.9 + b.driftPhase * 0.6) * 0.05;
          springTarget.set(
            b.scatterPos.x + dx,
            b.scatterPos.y + dy,
            b.scatterPos.z + dz
          );
          springForce.copy(springTarget).sub(b.mesh.position).multiplyScalar(SPRING_K);
          b.vel.addScaledVector(springForce, dt);
          b.vel.multiplyScalar(Math.max(0, 1 - SPRING_DAMP * dt));
          b.vel.clampLength(0, 12);
          b.mesh.position.addScaledVector(b.vel, dt);

          tmpEuler.set(
            Math.sin(elapsed * b.tumbleRate + b.tumblePhase) * 0.3,
            Math.cos(elapsed * b.tumbleRate * 0.6 + b.tumblePhase) * 0.25,
            Math.sin(elapsed * b.tumbleRate * 0.8 + b.tumblePhase * 1.5) * 0.2
          );
          tmpQuat.setFromEuler(tmpEuler);
          b.mesh.quaternion.slerp(tmpQuat, Math.min(1, dt * SPRING_K));
        } else {
          b.mesh.visible = true;
          b.blockMat.opacity = vis;
          const t = (blockForm - 0.05) / 0.95;

          const angle = t * Math.PI * 2.5 * (1 - t);
          const orbitRadius = (1 - easeOutCubic(t)) * RING_NATIVE_RADIUS * 0.4;
          orbitOffset.set(
            Math.cos(angle) * orbitRadius,
            Math.sin(angle * 0.7) * orbitRadius * 0.3,
            Math.sin(angle) * orbitRadius
          );

          springTarget.copy(b.homePos).addScaledVector(orbitOffset, 1 - t);

          springForce.copy(springTarget).sub(b.mesh.position).multiplyScalar(SPRING_K);
          b.vel.addScaledVector(springForce, dt);
          b.vel.multiplyScalar(Math.max(0, 1 - SPRING_DAMP * dt));
          b.vel.clampLength(0, 12);
          b.mesh.position.addScaledVector(b.vel, dt);

          tmpQuat.slerpQuaternions(b.scatterQuat, b.homeQuat, easeOutCubic(t));
          b.mesh.quaternion.slerp(tmpQuat, Math.min(1, dt * SPRING_K));
        }
      }

      mat.opacity = vis;

      ring.rotation.y += spec.spin * dt * (1 + energy * 0.3) * (0.3 + f);

      halo.material.opacity = vis * (0.25 + energy * 0.25)
        * (0.85 + 0.15 * Math.sin(elapsed * 2.3 + ri * 2.0));
      halo.scale.setScalar(0.9 + f * 0.15 + energy * 0.08);

      maxForm = Math.max(maxForm, f);
    }

    core.material.opacity = legGate * maxForm * (0.5 + energy * 0.3);
    core.scale.setScalar(0.6 + maxForm * 0.4 + Math.sin(elapsed * 1.7) * 0.05);
  }

  return { group, tick };
}
