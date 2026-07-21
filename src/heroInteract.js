/* ============================================================
   heroInteract.js — cursor drives the fractured hero shell
   ------------------------------------------------------------
   Raycasts the cursor against the hero's bricks every frame and
   feeds heroShell.js three signals:

   - the HIT POINT on the shell (which bricks should react)
   - the cursor's WORLD-SPACE VELOCITY (sweep the mouse and the
     bricks smear in that direction — the "explodes the way you
     move" behavior)
   - a smoothed HOVER value (everything eases in/out)

   Velocity is derived from screen-space mouse deltas mapped onto
   the camera's right/up axes, so it stays correct no matter
   where the camera is. Also flares the wire twin + scaffold and
   flips the CSS cursor.

   enable() gates everything — main.js flips it on when the
   assemble intro fires, so springs and intro never fight.
   ============================================================ */

import * as THREE from 'three';

export function createHeroInteract(assets, camera, scene, scaffold, terrain) {
  const heroEntry = assets.assets[0];         // manifest slot 0 = hero
  const hero = heroEntry.object;
  const wire = heroEntry.wire;
  const shell = hero.userData.shell;          // physics API from heroShell.js

  // crystal references (beats 1 & 2)
  const crystal1 = assets.assets[1]?.object;
  const crystal2 = assets.assets[2]?.object;
  const crystalBaseRots = [
    new THREE.Euler().copy(assets.assets[1]?.def.rotation || new THREE.Euler()),
    new THREE.Euler().copy(assets.assets[2]?.def.rotation || new THREE.Euler()),
  ];

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2(2, 2);        // offscreen until first move
  const ndcDelta = new THREE.Vector2();       // per-event screen motion

  const setNdc = (cx, cy) => {
    const nx = (cx / window.innerWidth) * 2 - 1;
    const ny = -(cy / window.innerHeight) * 2 + 1;
    ndcDelta.x += nx - ndc.x;
    ndcDelta.y += ny - ndc.y;
    ndc.set(nx, ny);
    ndcDirty = true;
    mouseNdc.x = nx;
    mouseNdc.y = ny;
  };

  window.addEventListener('mousemove', (e) => setNdc(e.clientX, e.clientY));
  window.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (t) setNdc(t.clientX, t.clientY);
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (t) setNdc(t.clientX, t.clientY);
  }, { passive: true });

  // cursor velocity in world units, smoothed
  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const velInstant = new THREE.Vector3();
  const velSmooth = new THREE.Vector3();

  let enabled = false;
  let hover = 0;
  let waveCooldown = 0;
  const hitPoint = new THREE.Vector3();
  let hasHit = false;
  let ndcDirty = false;        // true when mouse/touch moved since last tick

  // mouse-driven rotation
  const targetRot = new THREE.Euler();
  const baseRot = new THREE.Euler();
  const mouseNdc = { x: 0, y: 0 };
  let baseCaptured = false;
  const crystalMouseOffset = [new THREE.Vector2(), new THREE.Vector2()];

  function enable() { enabled = true; }

  function tick(dt, heroVisible, currentSection) {
    // ---- world-space cursor velocity -------------------------
    camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    camUp.setFromMatrixColumn(camera.matrixWorld, 1);
    const dist = camera.position.distanceTo(hero.position);
    velInstant.set(0, 0, 0)
      .addScaledVector(camRight, ndcDelta.x * dist * 0.6)
      .addScaledVector(camUp, ndcDelta.y * dist * 0.6)
      .divideScalar(Math.max(dt, 1 / 240));
    velInstant.clampLength(0, 30);
    ndcDelta.set(0, 0);
    velSmooth.lerp(velInstant, 1 - Math.exp(-8 * dt));

    // ---- hover raycast (skip if mouse hasn't moved) -----------
    let target = 0;
    hasHit = false;
    if (enabled && heroVisible > 0.3 && ndcDirty) {
      ndcDirty = false;
      raycaster.setFromCamera(ndc, camera);
      const rawHits = raycaster.intersectObject(hero, true);
      for (let i = 0; i < rawHits.length; i++) {
        const h = rawHits[i];
        if (h.object.isMesh && h.object.name !== 'hero-core') {
          target = 1;
          hasHit = true;
          hitPoint.copy(h.point);
          break;
        }
      }
    }
    hover += (target - hover) * (1 - Math.exp(-7 * dt));

    // ---- drive the shell --------------------------------------
    shell.setPointer(hasHit ? hitPoint : null, velSmooth, hover);
    shell.tick(dt);

    // ---- secondary responses ----------------------------------
    if (wire) wire.material.opacity = 0.12 + hover * 0.45;
    scaffold.setFlare(hover);
    document.body.style.cursor = hover > 0.5 ? 'pointer' : '';

    // ---- mouse-driven rotation (hero shell follows cursor) ----
    if (enabled && heroVisible > 0.3) {
      if (!baseCaptured) {
        baseRot.copy(hero.rotation);
        baseCaptured = true;
      }
      const goalY = baseRot.y + mouseNdc.x * 0.4;
      const goalX = baseRot.x + mouseNdc.y * 0.2;
      hero.rotation.y += (goalY - hero.rotation.y) * (1 - Math.exp(-4 * dt));
      hero.rotation.x += (goalX - hero.rotation.x) * (1 - Math.exp(-4 * dt));
    } else {
      baseCaptured = false;
    }

    // ---- mouse-driven rotation on crystals (beats 1 & 2) ------
    if (enabled) {
      const crystals = [crystal1, crystal2];
      // beat → section index (hero=0, pullback=1, crystal1=2, crystal2=3)
      const beatToSection = [0, 2, 3];
      for (let i = 0; i < 2; i++) {
        const c = crystals[i];
        if (!c) continue;
        if (currentSection === beatToSection[i + 1]) {
          // active crystal — accumulate mouse offset
          const off = crystalMouseOffset[i];
          off.x += (mouseNdc.x * 0.5 - off.x) * (1 - Math.exp(-3 * dt));
          off.y += (mouseNdc.y * 0.3 - off.y) * (1 - Math.exp(-3 * dt));
          c.rotation.y = crystalBaseRots[i].y + off.x;
          c.rotation.x = crystalBaseRots[i].x + off.y;
        }
      }
    }

    // ---- terrain wireframe light wave on hover -----------------
    waveCooldown = Math.max(0, waveCooldown - dt);
    if (hasHit && hover > 0.5 && waveCooldown <= 0 && terrain) {
      terrain.triggerWave(hitPoint.x, hitPoint.z);
      waveCooldown = 1.5; // min interval between waves
    }
  }

  return { tick, enable, get hover() { return hover; } };
}
