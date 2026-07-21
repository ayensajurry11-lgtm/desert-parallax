/* ============================================================
   scene.js — renderer, camera, lights, environment, fog
   ------------------------------------------------------------
   Arctic Ice Cave variant: cold blue-white fog, icy lighting,
   pale aurora sky gradient.
   ============================================================ */

import * as THREE from 'three';

/* ---- procedural arctic sky gradient --------------------------
   Deep navy zenith → pale ice blue → white at horizon. */
function makeSkyGradient() {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.0,  '#2a3e58');   // deep blue-gray zenith
  g.addColorStop(0.20, '#4a6a88');   // mid dark blue
  g.addColorStop(0.45, '#7a9cb8');   // blue
  g.addColorStop(0.65, '#a8c4d8');   // pale blue
  g.addColorStop(0.80, '#c8d8e4');   // light
  g.addColorStop(0.92, '#dce6ee');   // near-white
  g.addColorStop(1.0,  '#eef2f6');   // white horizon
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---- procedural arctic environment map -----------------------
   Cool ambient with subtle aurora green streaks. */
function makeArcticEnvironment(renderer) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const ctx = c.getContext('2d');

  // Sky half: richer gradient
  const skyG = ctx.createLinearGradient(0, 0, 0, 256);
  skyG.addColorStop(0.0, '#3a5a7a');
  skyG.addColorStop(0.5, '#7aaccc');
  skyG.addColorStop(1.0, '#b8d4e8');
  ctx.fillStyle = skyG;
  ctx.fillRect(0, 0, 1024, 256);

  // Ground half: pale ice
  ctx.fillStyle = '#c0d8ea';
  ctx.fillRect(0, 256, 1024, 256);

  // Aurora streaks — more vivid
  const auroraG = ctx.createLinearGradient(0, 0, 1024, 0);
  auroraG.addColorStop(0.0, 'rgba(60,220,150,0)');
  auroraG.addColorStop(0.3, 'rgba(60,220,150,0.3)');
  auroraG.addColorStop(0.5, 'rgba(80,200,240,0.35)');
  auroraG.addColorStop(0.7, 'rgba(60,220,150,0.3)');
  auroraG.addColorStop(1.0, 'rgba(60,220,150,0)');
  ctx.fillStyle = auroraG;
  ctx.fillRect(0, 40, 1024, 80);

  // Sun glow — warmer, more prominent
  const sunG = ctx.createRadialGradient(512, 180, 0, 512, 180, 220);
  sunG.addColorStop(0, 'rgba(255,248,235,0.95)');
  sunG.addColorStop(0.3, 'rgba(240,240,245,0.5)');
  sunG.addColorStop(1, 'rgba(200,220,240,0)');
  ctx.fillStyle = sunG;
  ctx.fillRect(312, 0, 400, 360);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new THREE.Scene());
  const envTexture = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  return envTexture;
}

export function createScene(canvas) {
  // ---- renderer --------------------------------------------
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.55;

  // ---- scene + fog -----------------------------------------
  const STAGE = 0xb0c0d0;
  const scene = new THREE.Scene();
  scene.background = makeSkyGradient();
  scene.fog = new THREE.FogExp2(STAGE, 0.022);

  // ---- camera ----------------------------------------------
  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );
  camera.position.set(0, 2, 14);

  // ---- environment map (arctic) ----------------------------
  scene.environment = makeArcticEnvironment(renderer);

  // ---- lights ----------------------------------------------
  // Key light — bright warm-white from above-right
  const keyLight = new THREE.DirectionalLight(0xf0e8d8, 3.2);
  keyLight.position.set(4, 14, 6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 50;
  keyLight.shadow.camera.left = -15;
  keyLight.shadow.camera.right = 15;
  keyLight.shadow.camera.top = 15;
  keyLight.shadow.camera.bottom = -15;
  keyLight.shadow.bias = -0.001;
  scene.add(keyLight);

  // Fill light — cool blue bounce from left
  const fillLight = new THREE.DirectionalLight(0x90b8d8, 0.8);
  fillLight.position.set(-5, -3, -8);
  scene.add(fillLight);

  // Rim / aurora light — cyan edge from behind
  const rimLight = new THREE.DirectionalLight(0x70e8c0, 0.8);
  rimLight.position.set(-4, 6, -12);
  scene.add(rimLight);

  // Warm accent — low golden fill from below-right
  const warmAccent = new THREE.DirectionalLight(0xffe0a0, 0.35);
  warmAccent.position.set(6, -2, 4);
  scene.add(warmAccent);

  // Soft top fill — smooths shadows on sphere blocks from above
  const topFill = new THREE.DirectionalLight(0xe0e8f0, 0.6);
  topFill.position.set(0, 18, 0);
  scene.add(topFill);

  // Front soft fill — reduces harsh shadows on front-facing blocks
  const frontFill = new THREE.DirectionalLight(0xd8e0e8, 0.4);
  frontFill.position.set(0, 4, 12);
  scene.add(frontFill);

  // Side accent — subtle light from right for block definition
  const sideAccent = new THREE.DirectionalLight(0xc8d0e0, 0.3);
  sideAccent.position.set(10, 2, 0);
  scene.add(sideAccent);

  // Ambient — enough to keep shadows alive
  scene.add(new THREE.AmbientLight(0xb0c8e0, 0.55));

  // Portal zone — bright cold light deep in the tunnel
  const portalLight = new THREE.PointLight(0xc0e0ff, 22, 50, 1.2);
  portalLight.position.set(0, -50, 2);
  scene.add(portalLight);

  // Portal zone — extra directional for ring visibility
  const portalDir = new THREE.DirectionalLight(0xd0e4f0, 1.2);
  portalDir.position.set(2, -48, 8);
  scene.add(portalDir);

  // ---- resize ----------------------------------------------
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);
  resize();

  return { renderer, scene, camera, resize };
}
