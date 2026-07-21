/* ============================================================
   particles.js — footer: a sand-swarm that forms the logo
   ------------------------------------------------------------
   Desert variant: sand-colored particles that swarm and settle
   into a logo shape. Click links to morph between logos.
   ============================================================ */

import * as THREE from 'three';

const COUNT = 14000;
const CENTER = new THREE.Vector3(0, -68.5, 0);
const PEDESTAL_Y = -71.5;

const CONE_RADIUS = 2.4;
const CONE_SHARP  = 3.0;
const PULL_ACCEL  = 26;
const DRAG_ACCEL  = 8;
const SPRING_K    = 9;
const DAMP_RATE   = 2.6;
const MAX_DISP    = 5.0;

const CAGE_R = 2.0;
const CAGE_HH = 2.9;
const IMPACT_W = 64, IMPACT_H = 32;
const IMPACT_DECAY = 0.90;
const GRID_U = 26, GRID_V = 14;

const MORPH_SPEED = 1.2; // logo transition speed (slower = more dramatic)

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec3  uCenter;
  uniform float uReveal;
  attribute vec3  aDisp;
  attribute float aSeed;
  varying float vShade;
  varying float vAlpha;
  varying float vEnergy;

  void main() {
    vec3 home = position;

    float t = uTime;
    vec3 hover;
    hover.x = sin(t * 1.6 + aSeed * 40.0) * 0.045 + cos(t * 0.7 + aSeed * 17.0) * 0.03;
    hover.y = sin(t * 1.3 + aSeed * 61.0) * 0.050 + sin(t * 0.6 + aSeed *  8.0) * 0.03;
    hover.z = cos(t * 1.9 + aSeed * 29.0) * 0.045 + cos(t * 0.8 + aSeed * 23.0) * 0.03;

    vec3 pos = uCenter + home + hover + aDisp;
    pos.y -= (1.0 - uReveal) * 2.0;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    vEnergy = length(aDisp);
    gl_PointSize = (1.15 + aSeed * 1.35) * (15.0 / -mv.z);

    vShade = aSeed;
    vAlpha = uReveal;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vShade;
  varying float vAlpha;
  varying float vEnergy;

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(uv, uv);
    if (r2 > 1.0) discard;
    float z = sqrt(1.0 - r2);
    vec3 N = vec3(uv.x, -uv.y, z);
    vec3 L = normalize(vec3(0.35, 0.75, 0.55));
    float diff = clamp(dot(N, L), 0.0, 1.0);
    float spec = pow(diff, 24.0);

    // ICE-colored beads — cool blue-white tones
    vec3 base = mix(vec3(0.55, 0.70, 0.82), vec3(0.80, 0.90, 0.96), vShade);
    vec3 col = base * (0.55 + 0.45 * diff) + spec * 0.5;
    // Pulled particles brighten toward frost white
    col = mix(col, vec3(0.90, 0.96, 1.0), min(vEnergy * 0.5, 0.7));

    float edge = smoothstep(1.0, 0.82, r2);
    gl_FragColor = vec4(col, vAlpha * edge);
  }
`;

/* ---- sample particle home slots from a rasterized glyph ------- */
function sampleGlyphOffsets(count, char, widthScale, heightScale, depth) {
  const SIZE = 320;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '900 300px Arial Black, Arial, sans-serif';
  ctx.fillText(char, SIZE / 2, SIZE * 0.74);

  const img = ctx.getImageData(0, 0, SIZE, SIZE).data;
  const valid = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (img[(y * SIZE + x) * 4 + 3] > 128) valid.push(x, y);
    }
  }
  if (valid.length === 0) {
    for (let y = 0; y < SIZE; y += 4) for (let x = 0; x < SIZE; x += 4) valid.push(x, y);
  }

  const positions = new Float32Array(count * 3);
  const px = 1 / SIZE;
  for (let i = 0; i < count; i++) {
    const idx = (Math.random() * (valid.length / 2) | 0) * 2;
    const nx = (valid[idx] / SIZE) * 2 - 1;
    const ny = -((valid[idx + 1] / SIZE) * 2 - 1);
    positions[i * 3 + 0] = nx * widthScale + (Math.random() - 0.5) * px * widthScale;
    positions[i * 3 + 1] = ny * heightScale + (Math.random() - 0.5) * px * heightScale;
    positions[i * 3 + 2] = (Math.random() - 0.5) * depth;
  }
  return positions;
}

/* ---- sample particle home slots from an image file ----------- */
function sampleImageOffsets(count, imageUrl, widthScale, heightScale, depth) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const SIZE = 320;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = SIZE;
      const ctx = canvas.getContext('2d');

      // Center-crop the image to a square
      const srcSize = Math.min(img.width, img.height);
      const sx = (img.width - srcSize) / 2;
      const sy = (img.height - srcSize) / 2;
      ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, SIZE, SIZE);

      const imgData = ctx.getImageData(0, 0, SIZE, SIZE).data;
      const valid = [];
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          if (imgData[(y * SIZE + x) * 4 + 3] > 128) valid.push(x, y);
        }
      }
      if (valid.length === 0) {
        for (let y = 0; y < SIZE; y += 4) for (let x = 0; x < SIZE; x += 4) valid.push(x, y);
      }

      const positions = new Float32Array(count * 3);
      const px = 1 / SIZE;
      for (let i = 0; i < count; i++) {
        const idx = (Math.random() * (valid.length / 2) | 0) * 2;
        const nx = (valid[idx] / SIZE) * 2 - 1;
        const ny = -((valid[idx + 1] / SIZE) * 2 - 1);
        positions[i * 3 + 0] = nx * widthScale + (Math.random() - 0.5) * px * widthScale;
        positions[i * 3 + 1] = ny * heightScale + (Math.random() - 0.5) * px * heightScale;
        positions[i * 3 + 2] = (Math.random() - 0.5) * depth;
      }
      resolve(positions);
    };
    img.onerror = () => {
      // Fallback to a circle if image fails to load
      resolve(sampleGlyphOffsets(count, 'J', widthScale, heightScale, depth));
    };
    img.src = imageUrl;
  });
}

/* ---- create all logo shapes ------------------------------------ */
async function createLogoShapes(count) {
  const janosLogo = await sampleImageOffsets(count, '/models/janos-logo.png', 1.43, 1.63, 0.6);
  return {
    facebook: janosLogo,
    linkedin: sampleGlyphOffsets(count, 'in', 2.0, 2.5, 0.6),
    gmail:    sampleGlyphOffsets(count, 'M', 2.2, 2.5, 0.6),
  };
}

export async function createParticleField(scene, camera) {
  const logos = await createLogoShapes(COUNT);
  const homeArr = new Float32Array(logos.linkedin); // start with LinkedIn
  const seeds = new Float32Array(COUNT);
  const dispArr = new Float32Array(COUNT * 3);
  const velArr = new Float32Array(COUNT * 3);
  const scatterArr = new Float32Array(COUNT * 3);

  // Morph state
  let currentLogo = 'linkedin';
  let targetLogo = 'linkedin';
  let morphProgress = 1.0;
  let prevHomeArr = new Float32Array(logos.linkedin);

  for (let i = 0; i < COUNT; i++) {
    seeds[i] = Math.random();
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const r = 2.5 + Math.random() * 3.5;
    const sx = Math.sin(ph) * Math.cos(th) * r;
    const sy = Math.cos(ph) * r * 1.2;
    const sz = Math.sin(ph) * Math.sin(th) * r;
    scatterArr[i * 3] = sx; scatterArr[i * 3 + 1] = sy; scatterArr[i * 3 + 2] = sz;
    dispArr[i * 3] = sx; dispArr[i * 3 + 1] = sy; dispArr[i * 3 + 2] = sz;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(homeArr, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const dispAttr = new THREE.BufferAttribute(dispArr, 3);
  dispAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aDisp', dispAttr);

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime:   { value: 0 },
      uCenter: { value: CENTER.clone() },
      uReveal: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'particle-field';
  points.frustumCulled = false;
  scene.add(points);

  const pedestal = new THREE.Group();
  pedestal.name = 'pedestal';

  // ---- the invisible CYLINDER cage (desert sand color) --------
  const impactField = new Float32Array(IMPACT_W * IMPACT_H);
  const impactBytes = new Uint8Array(IMPACT_W * IMPACT_H * 4);
  const impactTex = new THREE.DataTexture(impactBytes, IMPACT_W, IMPACT_H);
  impactTex.minFilter = impactTex.magFilter = THREE.LinearFilter;
  impactTex.wrapS = THREE.RepeatWrapping;
  impactTex.needsUpdate = true;

  const cageMat = new THREE.ShaderMaterial({
    uniforms: {
      uImpact: { value: impactTex },
      uReveal: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uImpact;
      uniform float uReveal;
      varying vec3 vPos;
      void main() {
        float u = atan(vPos.z, vPos.x) / 6.2831853 + 0.5;
        float v = clamp(vPos.y / ${(CAGE_HH * 2).toFixed(3)} + 0.5, 0.0, 1.0);
        float hit = texture2D(uImpact, vec2(u, v)).r;

        float fu = fract(u * ${GRID_U}.0), fv = fract(v * ${GRID_V}.0);
        float du = min(fu, 1.0 - fu), dv = min(fv, 1.0 - fv);
        float grid = max(smoothstep(0.05, 0.0, du), smoothstep(0.05, 0.0, dv));

        float a = (grid * hit * 2.4 + hit * 0.3) * uReveal;
        if (a < 0.004) discard;
        vec3 col = mix(vec3(0.85, 0.72, 0.5), vec3(0.98, 0.92, 0.75), hit);
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const cage = new THREE.Mesh(
    new THREE.CylinderGeometry(CAGE_R, CAGE_R, CAGE_HH * 2, 64, 1, true),
    cageMat
  );
  cage.name = 'swarm-cage';
  cage.position.copy(CENTER);
  cage.frustumCulled = false;
  scene.add(cage);

  // ---- 3D plate base (thick cylinder) -------------------------
  const BASE_Y = CENTER.y - CAGE_HH;
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0xc0c8d0, roughness: 0.92, metalness: 0.0,
    transparent: true, opacity: 0,
  });
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(CAGE_R + 0.6, CAGE_R + 0.8, 0.4, 64),
    plateMat
  );
  plate.name = 'base-plate';
  plate.position.set(CENTER.x, BASE_Y - 2.2, CENTER.z);
  plate.castShadow = true;
  plate.receiveShadow = true;
  scene.add(plate);

  // ---- two 3D torus rings around the plate --------------------
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xd0d8e0, roughness: 0.88, metalness: 0.0,
    transparent: true, opacity: 0,
  });
  const ring1 = new THREE.Mesh(
    new THREE.TorusGeometry(CAGE_R + 1.1, 0.12, 12, 64),
    ringMat.clone()
  );
  ring1.name = 'base-ring-1';
  ring1.rotation.x = Math.PI / 2;
  ring1.position.set(CENTER.x, BASE_Y - 2.05, CENTER.z);
  scene.add(ring1);

  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(CAGE_R + 1.8, 0.18, 12, 64),
    ringMat.clone()
  );
  ring2.name = 'base-ring-2';
  ring2.rotation.x = Math.PI / 2;
  ring2.position.set(CENTER.x, BASE_Y - 1.95, CENTER.z);
  scene.add(ring2);

  // ---- vast desert landscape (extends to screen corners) ------
  function _hash(ix, iz) {
    let h = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
    return h - Math.floor(h);
  }
  function _smooth(t) { return t * t * (3 - 2 * t); }
  function _noise2(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = _smooth(x - ix), fz = _smooth(z - iz);
    const a = _hash(ix, iz), b = _hash(ix + 1, iz);
    const c = _hash(ix, iz + 1), d = _hash(ix + 1, iz + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }
  function _fbm(x, z) {
    let v = 0, amp = 0.5, f = 1;
    for (let o = 0; o < 6; o++) {
      v += _noise2(x * f, z * f) * amp;
      f *= 2.0; amp *= 0.5;
    }
    return v;
  }

  const LAND_SIZE = 220, LAND_SEG = 120;
  const lGeo = new THREE.PlaneGeometry(LAND_SIZE, LAND_SIZE, LAND_SEG, LAND_SEG);
  lGeo.rotateX(-Math.PI / 2);
  const lPos = lGeo.attributes.position;
  const lColors = new Float32Array(lPos.count * 3);
  const cDark  = new THREE.Color(0x3a5a70);
  const cMid   = new THREE.Color(0x608aa0);
  const cLight = new THREE.Color(0x90b8d0);
  const cBright = new THREE.Color(0xc0dce8);
  const _lt = new THREE.Color();

  for (let i = 0; i < lPos.count; i++) {
    const x = lPos.getX(i), z = lPos.getZ(i);
    const d = Math.hypot(x, z);

    // multi-octave dune displacement
    const dunes  = _fbm(x * 0.018 + 3.7, z * 0.018 + 9.2) * 3.5;
    const dune2  = _fbm(x * 0.045 + 1.2, z * 0.045 + 4.5) * 1.6;
    const detail = _fbm(x * 0.18 + 7.0, z * 0.18 + 2.0) * 0.45;
    const ripple = _fbm(x * 0.55 + 5.0, z * 0.55 + 3.0) * 0.12;

    // flatten near center for pedestal, fade dunes toward edges
    const flatten = Math.exp(-((d / 3.0) ** 2)) * 0.8;
    const edgeFade = _smooth(Math.min(Math.max((d - 8) / 40, 0), 1));

    const y = BASE_Y - 2.5
      + (dunes * edgeFade + dune2 * 0.5 * edgeFade + detail + ripple)
      - flatten;
    lPos.setY(i, y);

    // vertex color: dark in troughs, bright on crests
    const h = (y - BASE_Y + 1.0) / 4.0;
    const slope = Math.abs(_fbm(x * 0.08, z * 0.08) - 0.5) * 2;
    const grain = _fbm(x * 0.35, z * 0.35) * 0.18;
    const t = Math.min(Math.max(h + grain, 0), 1);
    if (t < 0.25) _lt.copy(cDark).lerp(cMid, t / 0.25);
    else if (t < 0.6) _lt.copy(cMid).lerp(cLight, (t - 0.25) / 0.35);
    else _lt.copy(cLight).lerp(cBright, (t - 0.6) / 0.4);
    _lt.multiplyScalar(1 - slope * 0.14);
    lColors[i * 3] = _lt.r; lColors[i * 3 + 1] = _lt.g; lColors[i * 3 + 2] = _lt.b;
  }
  lGeo.setAttribute('color', new THREE.BufferAttribute(lColors, 3));
  lGeo.computeVertexNormals();

  const lMat = new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true,
    roughness: 0.92, metalness: 0.02,
    transparent: true, opacity: 0,
    depthWrite: false,
  });
  const landscape = new THREE.Mesh(lGeo, lMat);
  landscape.name = 'footer-landscape';
  landscape.receiveShadow = true;
  landscape.renderOrder = -1;
  scene.add(landscape);

  // ---- cursor -> world-space plane hit + velocity -------------

  // ---- cursor -> world-space plane hit + velocity -------------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2(2, 2);
  const plane = new THREE.Plane();
  const camDir = new THREE.Vector3();
  const hit = new THREE.Vector3();
  const prevHit = new THREE.Vector3();
  const instVel = new THREE.Vector3();
  const mouseWorld = new THREE.Vector3().copy(CENTER);
  const mouseVel = new THREE.Vector3();
  let hasPrev = false;

  let mouseInside = false;

  window.addEventListener('mousemove', (e) => {
    ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
    mouseInside = true;
  });

  document.addEventListener('mouseleave', () => {
    ndc.set(2, 2); // outside NDC viewport — raycaster won't intersect
    mouseInside = false;
    hasPrev = false;
    instVel.set(0, 0, 0);
    mouseVel.set(0, 0, 0);
  });

  function tick(dt, elapsed) {
    material.uniforms.uTime.value = elapsed;
    const reveal = material.uniforms.uReveal.value;

    // ---- logo morphing ----------------------------------------
    if (morphProgress < 1.0) {
      morphProgress = Math.min(1.0, morphProgress + dt * MORPH_SPEED);
      const t = morphProgress * morphProgress * (3 - 2 * morphProgress); // smoothstep
      const targetPositions = logos[targetLogo];
      for (let i = 0; i < COUNT; i++) {
        const i3 = i * 3;
        homeArr[i3]     = prevHomeArr[i3]     + (targetPositions[i3]     - prevHomeArr[i3])     * t;
        homeArr[i3 + 1] = prevHomeArr[i3 + 1] + (targetPositions[i3 + 1] - prevHomeArr[i3 + 1]) * t;
        homeArr[i3 + 2] = prevHomeArr[i3 + 2] + (targetPositions[i3 + 2] - prevHomeArr[i3 + 2]) * t;
      }
      geometry.attributes.position.needsUpdate = true;
      if (morphProgress >= 1.0) {
        currentLogo = targetLogo;
      }
    }

    camera.getWorldDirection(camDir);
    plane.setFromNormalAndCoplanarPoint(camDir.negate(), CENTER);
    raycaster.setFromCamera(ndc, camera);
    let hasMouse = false;
    if (raycaster.ray.intersectPlane(plane, hit)) {
      mouseWorld.lerp(hit, 1 - Math.exp(-14 * dt));
      if (hasPrev) {
        instVel.subVectors(hit, prevHit).divideScalar(Math.max(dt, 1 / 240)).clampLength(0, 20);
      }
      prevHit.copy(hit);
      hasPrev = true;
      // only drag if mouse is inside the cylinder cage
      const dxm = mouseWorld.x - CENTER.x;
      const dzm = mouseWorld.z - CENTER.z;
      hasMouse = (dxm * dxm + dzm * dzm) < (CAGE_R * CAGE_R);
    } else {
      instVel.set(0, 0, 0);
    }
    mouseVel.lerp(instVel, 1 - Math.exp(-8 * dt));
    instVel.multiplyScalar(Math.exp(-4 * dt));

    const damp = Math.exp(-DAMP_RATE * dt);
    const rev1 = 1 - reveal;
    const cx = CENTER.x, cy = CENTER.y, cz = CENTER.z;
    const mx = mouseWorld.x, my = mouseWorld.y, mz = mouseWorld.z;
    const mvx = mouseVel.x, mvy = mouseVel.y, mvz = mouseVel.z;

    const caged = reveal > 0.5;
    if (caged) for (let k = 0; k < impactField.length; k++) impactField[k] *= IMPACT_DECAY;

    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      const hx = homeArr[i3], hy = homeArr[i3 + 1], hz = homeArr[i3 + 2];
      let dx = dispArr[i3], dy = dispArr[i3 + 1], dz = dispArr[i3 + 2];

      const rx = scatterArr[i3] * rev1, ry = scatterArr[i3 + 1] * rev1, rz = scatterArr[i3 + 2] * rev1;
      let ax = (rx - dx) * SPRING_K, ay = (ry - dy) * SPRING_K, az = (rz - dz) * SPRING_K;

      if (hasMouse) {
        const wx = cx + hx + dx, wy = cy + hy + dy, wz = cz + hz + dz;
        const tx = mx - wx, ty = my - wy, tz = mz - wz;
        const dist = Math.sqrt(tx * tx + ty * ty + tz * tz) + 1e-4;
        const s = 1 - dist / CONE_RADIUS;
        if (s > 0) {
          const cone = Math.pow(s, CONE_SHARP);
          const k = (cone * PULL_ACCEL) / dist;
          ax += tx * k; ay += ty * k; az += tz * k;
          ax += mvx * cone * DRAG_ACCEL; ay += mvy * cone * DRAG_ACCEL; az += mvz * cone * DRAG_ACCEL;
        }
      }

      let vx = (velArr[i3] + ax * dt) * damp;
      let vy = (velArr[i3 + 1] + ay * dt) * damp;
      let vz = (velArr[i3 + 2] + az * dt) * damp;
      dx += vx * dt; dy += vy * dt; dz += vz * dt;

      const dl = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dl > MAX_DISP) { const s2 = MAX_DISP / dl; dx *= s2; dy *= s2; dz *= s2; }

      if (caged) {
        let ox = hx + dx, oy = hy + dy, oz = hz + dz;
        let hitU = -1, hitV = -1;
        const rr = Math.sqrt(ox * ox + oz * oz);
        if (rr > CAGE_R) {
          const s2 = CAGE_R / rr;
          ox *= s2; oz *= s2;
          dx = ox - hx; dz = oz - hz;
          vx *= 0.35; vz *= 0.35;
          hitU = Math.atan2(oz, ox) / (2 * Math.PI) + 0.5;
          hitV = Math.min(1, Math.max(0, oy / (CAGE_HH * 2) + 0.5));
        }
        if (oy > CAGE_HH) {
          oy = CAGE_HH; dy = oy - hy; vy *= 0.35;
          hitU = Math.atan2(oz, ox) / (2 * Math.PI) + 0.5; hitV = 1;
        } else if (oy < -CAGE_HH) {
          oy = -CAGE_HH; dy = oy - hy; vy *= 0.35;
          hitU = Math.atan2(oz, ox) / (2 * Math.PI) + 0.5; hitV = 0;
        }
        if (hitU >= 0) {
          const ti = (Math.min(IMPACT_H - 1, hitV * IMPACT_H | 0) * IMPACT_W)
                   + Math.min(IMPACT_W - 1, hitU * IMPACT_W | 0);
          impactField[ti] = Math.min(1.7, impactField[ti] + 0.09);
        }
      }

      velArr[i3] = vx; velArr[i3 + 1] = vy; velArr[i3 + 2] = vz;
      dispArr[i3] = dx; dispArr[i3 + 1] = dy; dispArr[i3 + 2] = dz;
    }
    dispAttr.needsUpdate = true;

    if (caged) {
      for (let k = 0; k < impactField.length; k++) {
        const b = Math.min(255, (impactField[k] * 255) | 0);
        const o = k * 4;
        impactBytes[o] = impactBytes[o + 1] = impactBytes[o + 2] = impactBytes[o + 3] = b;
      }
      impactTex.needsUpdate = true;
    }
    cageMat.uniforms.uReveal.value = reveal;

    // fade base plate + rings with reveal
    plateMat.opacity = reveal * 0.9;
    plate.visible = reveal > 0.05;
    ring1.material.opacity = reveal * 0.7;
    ring2.material.opacity = reveal * 0.6;
    // vast landscape fades in with the swarm
    lMat.opacity = reveal * 0.95;
    landscape.visible = reveal > 0.05;

    // ---- burst interpolation (rAF-gated, replaces setInterval) ---
    if (burstActive && burstDir) {
      burstT += dt;
      const ease = Math.min(1, burstT / BURST_DUR);
      const strength = (1 - ease) * 3;
      for (let i = 0; i < COUNT; i++) {
        const i3 = i * 3;
        dispArr[i3]     = burstDir[i3]     * strength + (dispArr[i3]     * (1 - ease * 0.7));
        dispArr[i3 + 1] = burstDir[i3 + 1] * strength + (dispArr[i3 + 1] * (1 - ease * 0.7));
        dispArr[i3 + 2] = burstDir[i3 + 2] * strength + (dispArr[i3 + 2] * (1 - ease * 0.7));
      }
      if (burstT >= BURST_DUR) burstActive = false;
    }
  }

  // ---- burst state (rAF-gated, no setInterval) -----------------
  let eruptionTriggered = false;
  let burstActive = false;
  let burstT = 0;
  const BURST_DUR = 0.5;
  let burstDir = null;

  function setReveal(v) {
    const prev = material.uniforms.uReveal.value;
    material.uniforms.uReveal.value = v;

    // Eruption: when reveal jumps past 0.3 for the first time, scatter particles outward
    if (!eruptionTriggered && v > 0.3 && prev <= 0.3) {
      eruptionTriggered = true;
      burstDir = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        const r = 0.8 + Math.random() * 1.5;
        burstDir[i * 3] = Math.sin(ph) * Math.cos(th) * r;
        burstDir[i * 3 + 1] = Math.cos(ph) * r * 1.5 + 0.5;
        burstDir[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
      }
      burstActive = true;
      burstT = 0;
    }
  }

  /* ---- morph to a different logo ----------------------------- */
  function morphTo(logoName) {
    if (logoName === currentLogo && morphProgress >= 1.0) return;
    if (!logos[logoName]) return;
    targetLogo = logoName;
    morphProgress = 0;
    prevHomeArr = new Float32Array(homeArr);
  }

  return { points, pedestal, cage, tick, setReveal, morphTo };
}
