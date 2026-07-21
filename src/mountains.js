/* ============================================================
   mountains.js — distant mountain range on the horizon
   ------------------------------------------------------------
   A displaced ridge mesh sitting far behind the scene, creating
   a desert mountain silhouette against the sky gradient. Procedural
   FBM displacement, vertex-colored by height (dark base → pale peaks).
   ============================================================ */

import * as THREE from 'three';

/* ---- noise helpers ------------------------------------------ */
function hash(ix, iz) {
  let h = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function smooth(t) { return t * t * (3 - 2 * t); }
function noise2(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = smooth(x - ix), fz = smooth(z - iz);
  const a = hash(ix, iz), b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
function fbm(x, z) {
  let v = 0, amp = 0.5, f = 1;
  for (let o = 0; o < 5; o++) {
    v += noise2(x * f, z * f) * amp;
    f *= 2.0; amp *= 0.5;
  }
  return v;
}

export function createMountains(scene) {
  const group = new THREE.Group();
  group.name = 'mountains';

  const WIDTH = 160, DEPTH = 30, SEG_X = 120, SEG_Z = 16;
  const geo = new THREE.PlaneGeometry(WIDTH, DEPTH, SEG_X, SEG_Z);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const darkRock = new THREE.Color(0x3a5a70);
  const midRock = new THREE.Color(0x5a8098);
  const paleRock = new THREE.Color(0x8ab0c8);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);

    const xNorm = x / (WIDTH * 0.5);
    const ridgeProfile = Math.exp(-xNorm * xNorm * 1.5);

    const peaks = fbm(x * 0.025 + 5.3, z * 0.06 + 1.7) * 14.0;
    const detail = fbm(x * 0.08 + 2.1, z * 0.12 + 3.9) * 4.0;

    const height = (peaks + detail) * ridgeProfile + 2.0;
    pos.setY(i, height);

    const t = Math.min(Math.max(height / 18, 0), 1);
    if (t < 0.4) {
      tmp.copy(darkRock).lerp(midRock, t / 0.4);
    } else {
      tmp.copy(midRock).lerp(paleRock, (t - 0.4) / 0.6);
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.95,
    metalness: 0.01,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, -2.6, -80);
  mesh.receiveShadow = true;
  group.add(mesh);

  const WIDTH2 = 180, DEPTH2 = 20, SEG_X2 = 100, SEG_Z2 = 10;
  const geo2 = new THREE.PlaneGeometry(WIDTH2, DEPTH2, SEG_X2, SEG_Z2);
  geo2.rotateX(-Math.PI / 2);
  const pos2 = geo2.attributes.position;
  const colors2 = new Float32Array(pos2.count * 3);
  const darkDune = new THREE.Color(0x4a6878);
  const lightDune = new THREE.Color(0x7aa0b8);

  for (let i = 0; i < pos2.count; i++) {
    const x = pos2.getX(i), z = pos2.getZ(i);
    const xNorm = x / (WIDTH2 * 0.5);
    const ridgeProfile = Math.exp(-xNorm * xNorm * 2.0);
    const dunes = fbm(x * 0.03 + 8.1, z * 0.05 + 2.3) * 7.0;
    const detail2 = fbm(x * 0.1 + 1.5, z * 0.15 + 5.2) * 2.0;
    const height = (dunes + detail2) * ridgeProfile + 1.0;
    pos2.setY(i, height);
    const t = Math.min(Math.max(height / 9, 0), 1);
    tmp.copy(darkDune).lerp(lightDune, t);
    colors2[i * 3] = tmp.r;
    colors2[i * 3 + 1] = tmp.g;
    colors2[i * 3 + 2] = tmp.b;
  }
  geo2.setAttribute('color', new THREE.BufferAttribute(colors2, 3));
  geo2.computeVertexNormals();

  const mat2 = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.93,
    metalness: 0.01,
    transparent: true,
  });
  const mesh2 = new THREE.Mesh(geo2, mat2);
  mesh2.position.set(0, -2.6, -55);
  group.add(mesh2);

  // ice haze particles between ridges
  const HAZE = 250;
  const hazePos = new Float32Array(HAZE * 3);
  for (let i = 0; i < HAZE; i++) {
    hazePos[i * 3]     = (Math.random() - 0.5) * 120;
    hazePos[i * 3 + 1] = -1 + Math.random() * 6;
    hazePos[i * 3 + 2] = -55 - Math.random() * 40;
  }
  const hazeGeo = new THREE.BufferGeometry();
  hazeGeo.setAttribute('position', new THREE.BufferAttribute(hazePos, 3));
  const hazeMat = new THREE.PointsMaterial({
    color: 0xc0d8e8,
    size: 0.20,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const haze = new THREE.Points(hazeGeo, hazeMat);
  haze.frustumCulled = false;
  group.add(haze);

  scene.add(group);

  function tick(dt, elapsed) {
    const p = hazeGeo.attributes.position;
    for (let i = 0; i < HAZE; i++) {
      let x = p.getX(i) + 0.15 * dt;
      if (x > 60) x = -60;
      p.setX(i, x);
      p.setY(i, p.getY(i) + Math.sin(elapsed * 0.25 + i * 0.4) * 0.002);
    }
    p.needsUpdate = true;
  }

  function setOpacity(v) {
    mat.opacity = v;
    mat2.opacity = v;
    hazeMat.opacity = v * 0.25;
    group.visible = v > 0.01;
  }

  return { group, tick, setOpacity };
}
