/* ============================================================
   cameraRig.js — smooth scroll-driven camera
   ------------------------------------------------------------
   Camera interpolates between section positions based on
   scroll progress (0 = hero, 1 = footer).
   Mouse parallax is always active (subtle).
   ============================================================ */

import * as THREE from 'three';

/* ---- section cameras with explicit scroll positions ----------- */
const SECTION_CAMERAS = [
  { t: 0.00, pos: new THREE.Vector3( 0.0,   1.6,  11.0), lookAt: new THREE.Vector3( 0.0,   0.0,  0.0) },   // hero
  { t: 0.10, pos: new THREE.Vector3( 0.0,   5.0,  17.0), lookAt: new THREE.Vector3( 0.0,  -1.0,  0.0) },   // hero pullback
  { t: 0.18, pos: new THREE.Vector3( 0.8, -15.0,  12.0), lookAt: new THREE.Vector3(-0.9, -13.5,  0.0) },   // crystal 1
  { t: 0.36, pos: new THREE.Vector3(-0.7, -31.0,  12.0), lookAt: new THREE.Vector3( 1.1, -29.5,  0.0) },   // crystal 2
  { t: 0.48, pos: new THREE.Vector3( 0.0, -38.0,   3.0), lookAt: new THREE.Vector3( 0.0, -42.0,  0.0) },   // portal entry
  { t: 0.58, pos: new THREE.Vector3( 0.0, -41.0,   1.8), lookAt: new THREE.Vector3( 0.0, -47.0,  0.0) },   // ring 0
  { t: 0.68, pos: new THREE.Vector3( 0.0, -46.0,   1.5), lookAt: new THREE.Vector3( 0.0, -52.0,  0.0) },   // ring 1
  { t: 0.78, pos: new THREE.Vector3( 0.0, -51.0,   1.2), lookAt: new THREE.Vector3( 0.0, -57.0,  0.0) },   // ring 2
  { t: 0.88, pos: new THREE.Vector3( 0.0, -56.0,   1.0), lookAt: new THREE.Vector3( 0.0, -62.0,  0.0) },   // ring 3
  { t: 1.00, pos: new THREE.Vector3( 0.0, -67.5,   5.5), lookAt: new THREE.Vector3( 0.0, -68.5,  0.0) },   // footer
];

const SECTION_COUNT = SECTION_CAMERAS.length;

/* ---- lerp between sections using explicit scroll positions --- */
function lerpSections(progress) {
  let i = 0;
  while (i < SECTION_COUNT - 2 && SECTION_CAMERAS[i + 1].t <= progress) i++;
  const a = SECTION_CAMERAS[i];
  const b = SECTION_CAMERAS[i + 1];
  const span = b.t - a.t;
  const t = span > 0 ? clamp01((progress - a.t) / span) : 0;
  const s = t * t * (3 - 2 * t);
  return {
    pos: new THREE.Vector3().lerpVectors(a.pos, b.pos, s),
    lookAt: new THREE.Vector3().lerpVectors(a.lookAt, b.lookAt, s),
  };
}

export function createCameraRig(camera) {
  /* ---- state ---------------------------------------------- */
  const camPos  = SECTION_CAMERAS[0].pos.clone();
  const camLook = SECTION_CAMERAS[0].lookAt.clone();
  const targetPos  = new THREE.Vector3();
  const targetLook = new THREE.Vector3();

  /* ---- mouse parallax ------------------------------------- */
  const mouse = { x: 0, y: 0, smoothX: 0, smoothY: 0 };
  const setNdc = (cx, cy) => {
    mouse.x = (cx / window.innerWidth) * 2 - 1;
    mouse.y = (cy / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('mousemove', (e) => setNdc(e.clientX, e.clientY));
  window.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (t) setNdc(t.clientX, t.clientY);
  }, { passive: true });

  let _currentSection = 0;

  /* ---- per-frame update ----------------------------------- */
  function tick(dt, scrollProgress) {
    const sp = clamp01(scrollProgress);

    // find nearest section
    let nearest = 0;
    let minDist = Infinity;
    for (let i = 0; i < SECTION_COUNT; i++) {
      const d = Math.abs(sp - SECTION_CAMERAS[i].t);
      if (d < minDist) { minDist = d; nearest = i; }
    }
    _currentSection = nearest;

    // compute target from scroll position
    const section = lerpSections(sp);
    targetPos.copy(section.pos);
    targetLook.copy(section.lookAt);

    // exponential smoothing on mouse
    const mk = 1 - Math.exp(-4 * dt);
    mouse.smoothX += (mouse.x - mouse.smoothX) * mk;
    mouse.smoothY += (mouse.y - mouse.smoothY) * mk;

    // lerp camera toward target
    const lk = 1 - Math.exp(-5 * dt);
    camPos.lerp(targetPos, lk);
    camLook.lerp(targetLook, lk);

    // layer mouse parallax (subtle)
    camPos.x += mouse.smoothX * 0.06;
    camPos.y -= mouse.smoothY * 0.04;
    camLook.x -= mouse.smoothX * 0.04;
    camLook.y += mouse.smoothY * 0.03;

    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  return {
    tick,
    get currentSection() { return _currentSection; },
    get SECTION_COUNT() { return SECTION_COUNT; },
    mouse,
  };
}

function clamp01(t) { return Math.max(0, Math.min(1, t)); }
