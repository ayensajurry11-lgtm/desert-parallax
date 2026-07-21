/* ============================================================
   terrain.js — procedural desert sand terrain for the hero beat
   ------------------------------------------------------------
   FBM-displaced plane shaped like rolling sand dunes, with a
   raised mound at dead center for the hero object to sit on.
   Vertex colors grade dark rock -> pale sand by height + slope,
   flat shading gives the faceted dune look, and dense fog eats
   the edges so the 90x90 plane reads as an endless desert.

   Also owns:
   - drifting sand-dust particles
   - a permanent ground floor that stays visible even when the
     hero terrain fades out (prevents the sphere bottom from
     showing bare against the sky)

   Exports getHeight(x, z) so other modules (scaffold.js) can sit
   things ON the ground instead of floating randomly.
   ============================================================ */

import * as THREE from 'three';

/* ---- value noise + FBM -------------------------------------- */
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

/* ---- the height field --------------------------------------- */
function getHeight(x, z) {
  const d = Math.hypot(x, z);

  // Large-scale rolling mountains (reduced 30%)
  const dunes = fbm(x * 0.03 + 3.7, z * 0.03 + 9.2) * 5.0;
  // Medium ridges (reduced 30%)
  const dune2 = fbm(x * 0.06 + 1.2, z * 0.06 + 4.5) * 2.4;
  // Sharp peaks (reduced 30%)
  const peaks = fbm(x * 0.015 + 5.5, z * 0.015 + 2.1) * 3.5;

  const damp = smooth(Math.min(Math.max((d - 3) / 10, 0), 1));
  const mound = Math.exp(-((d / 4.0) ** 2)) * 1.2;

  // Fine rocky detail
  const detail = fbm(x * 0.35, z * 0.35) * 0.35;
  // Medium crags
  const crags = fbm(x * 0.15 + 8.3, z * 0.15 + 6.7) * 1.2;

  const rawHeight = (dunes + dune2 * 0.5 + peaks * 0.6 + crags * 0.3) * damp + mound + detail;
  return -2.8 + rawHeight;
}

export function createTerrain(scene) {
  const group = new THREE.Group();
  group.name = 'terrain';

  // ============================================================
  //  1. HERO TERRAIN — detailed displaced dune mesh
  // ============================================================
  const SIZE = 100, SEG = 220;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const darkSnow   = new THREE.Color(0x8a9aa8);
  const midSnow    = new THREE.Color(0xb0bcc8);
  const lightSnow  = new THREE.Color(0xd0d8e0);
  const brightSnow = new THREE.Color(0xe8ecf0);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = getHeight(x, z);
    pos.setY(i, y);

    // Multi-band height color: dark base → mid → light → bright snow ridges
    const h = (y + 2.5) / 5.5;
    const slope = Math.abs(fbm(x * 0.15, z * 0.15) - 0.5) * 2; // rough slope estimate
    const grain = fbm(x * 0.5, z * 0.5) * 0.2;  // fine grain variation
    const t = Math.min(Math.max(h + grain, 0), 1);

    if (t < 0.3) {
      tmp.copy(darkSnow).lerp(midSnow, t / 0.3);
    } else if (t < 0.65) {
      tmp.copy(midSnow).lerp(lightSnow, (t - 0.3) / 0.35);
    } else {
      tmp.copy(lightSnow).lerp(brightSnow, (t - 0.65) / 0.35);
    }
    // Slope darkening — steep faces are shadowed
    tmp.multiplyScalar(1 - slope * 0.12);

    colors[i * 3]     = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.95,
    metalness: 0.0,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'terrain-mesh';
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  group.add(mesh);

  // ============================================================
  //  2. GROUND FLOOR — permanent, never fades out
  // ============================================================
  const FLOOR_SIZE = 300;
  const FLOOR_Y = -3.0;  // higher to cover sphere underside
  const floorGeo = new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE);
  floorGeo.rotateX(-Math.PI / 2);
  // Vertex colors: ice gradient from center to edge
  const floorPos = floorGeo.attributes.position;
  const floorColors = new Float32Array(floorPos.count * 3);
  const floorCenter = new THREE.Color(0xc8d0d8);
  const floorEdge   = new THREE.Color(0x9aa8b4);
  for (let i = 0; i < floorPos.count; i++) {
    const x = floorPos.getX(i), z = floorPos.getZ(i);
    const d = Math.min(1, Math.hypot(x, z) / (FLOOR_SIZE * 0.4));
    tmp.copy(floorCenter).lerp(floorEdge, d);
    // Add subtle noise so it's not flat
    const n = fbm(x * 0.03 + 7.1, z * 0.03 + 3.9) * 0.08;
    tmp.r = Math.max(0, tmp.r + n);
    tmp.g = Math.max(0, tmp.g + n * 0.8);
    tmp.b = Math.max(0, tmp.b + n * 0.6);
    floorColors[i * 3]     = tmp.r;
    floorColors[i * 3 + 1] = tmp.g;
    floorColors[i * 3 + 2] = tmp.b;
  }
  floorGeo.setAttribute('color', new THREE.BufferAttribute(floorColors, 3));
  floorGeo.computeVertexNormals();
  const floorMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.95,
    metalness: 0.01,
    transparent: true,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.name = 'ground-floor';
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  scene.add(floor);

  // ============================================================
  //  3. INTRO WIREFRAME TWIN (shader-driven light wave)
  // ============================================================
  const wireGeoSrc = new THREE.PlaneGeometry(SIZE, SIZE, 35, 35);
  wireGeoSrc.rotateX(-Math.PI / 2);
  const wp = wireGeoSrc.attributes.position;
  const wireWorldPos = new Float32Array(wp.count * 3);
  for (let i = 0; i < wp.count; i++) {
    const x = wp.getX(i), z = wp.getZ(i);
    const y = getHeight(x, z) + 0.03;
    wp.setY(i, y);
    wireWorldPos[i * 3]     = x;
    wireWorldPos[i * 3 + 1] = y;
    wireWorldPos[i * 3 + 2] = z;
  }
  wireGeoSrc.setAttribute('aWorldPos', new THREE.BufferAttribute(wireWorldPos, 3));

  const wireMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor:      { value: new THREE.Color(0xb0c0d0) },
      uWaveColor:  { value: new THREE.Color(0xd0e0f0) },
      uOpacity:    { value: 0.1 },
      uWaveOrigin: { value: new THREE.Vector3(0, 0, 0) },
      uWaveTime:   { value: -10 },
      uWaveRadius: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aWorldPos;
      uniform vec3 uWaveOrigin;
      uniform float uWaveTime;
      uniform float uWaveRadius;
      varying float vWave;
      void main() {
        float dist = length(aWorldPos.xz - uWaveOrigin.xz);
        float ringDist = abs(dist - uWaveRadius);
        vWave = smoothstep(3.0, 0.0, ringDist);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uWaveColor;
      uniform float uOpacity;
      uniform float uWaveTime;
      varying float vWave;
      void main() {
        float age = uWaveTime > -5.0 ? 1.0 : 0.0;
        vec3 col = mix(uColor, uWaveColor, vWave * age * 0.7);
        float a = uOpacity + vWave * age * 0.5;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(wireGeoSrc), wireMat);
  wire.name = 'terrain-wire';
  group.add(wire);

  const introState = { mesh: 1, wire: 0.1 };

  // ---- wave state for light effect ----------------------------
  const waveState = { origin: new THREE.Vector3(), time: -10, radius: 0 };

  // ============================================================
  //  4. SAND DUST — sparse drifting motes
  // ============================================================
  const DUST = 600;
  const dustPos = new Float32Array(DUST * 3);
  const dustVel = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3]     = (Math.random() - 0.5) * 46;
    dustPos[i * 3 + 1] = -2.2 + Math.random() * 5.5;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 46;
    dustVel[i] = 0.3 + Math.random() * 0.9;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xd8e0e8, size: 0.06, transparent: true, opacity: 0.55,
    depthWrite: false, sizeAttenuation: true,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  group.add(dust);

  scene.add(group);

  function tick(dt, elapsed) {
    // sand dust
    const p = dustGeo.attributes.position;
    for (let i = 0; i < DUST; i++) {
      let x = p.getX(i) + dustVel[i] * dt;
      if (x > 23) x = -23;
      p.setX(i, x);
      p.setY(i, p.getY(i) + Math.sin(elapsed * 0.8 + i) * 0.0015);
    }
    p.needsUpdate = true;

    // wireframe light wave
    const wActive = elapsed - waveState.time < 2.0;
    if (wActive) {
      waveState.radius += dt * 12;
      wireMat.uniforms.uWaveOrigin.value.copy(waveState.origin);
      wireMat.uniforms.uWaveTime.value = waveState.time;
      wireMat.uniforms.uWaveRadius.value = waveState.radius;
    } else {
      wireMat.uniforms.uWaveTime.value = -10;
    }
  }

  function triggerWave(worldX, worldZ) {
    waveState.origin.set(worldX, 0, worldZ);
    waveState.time = performance.now() / 1000;
    waveState.radius = 0;
  }

  function setOpacity(v) {
    mat.opacity = v * introState.mesh;
    wireMat.uniforms.uOpacity.value = v * introState.wire;
    dustMat.opacity = v * 0.55 * introState.mesh;
    group.visible = v > 0.01;

    // Ground floor stays visible longer to cover underside
    const floorVis = Math.max(0, Math.min(1, (v - 0.02) / 0.3));
    floorMat.opacity = floorVis;
    floor.visible = floorVis > 0.01;
  }

  return { group, tick, setOpacity, getHeight, introState, triggerWave };
}
