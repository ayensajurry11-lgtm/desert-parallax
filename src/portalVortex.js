/* ============================================================
   portalVortex.js — sand-storm vortex around portal ring blocks
   ------------------------------------------------------------
   Fine powder particles swirling around each ring's blocks,
   visible before the camera arrives, intensifying as it enters.
   ============================================================ */

import * as THREE from 'three';

const RING_SPECS = [
  { radius: 5.4, y: -42.0 },
  { radius: 4.4, y: -47.0 },
  { radius: 3.4, y: -52.0 },
  { radius: 2.4, y: -57.0 },
];
const RING_COUNT = RING_SPECS.length;
const PER_RING = 3500;
const TOTAL = PER_RING * RING_COUNT;

const vortexVert = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity[4];

  attribute float aAngle;
  attribute float aRadius;
  attribute float aSpeed;
  attribute float aRing;
  attribute float aThickness;
  attribute float aBaseAlpha;

  varying float vAlpha;

  void main() {
    int ring = int(aRing);
    float intensity = uIntensity[ring];

    float ringY[4];
    ringY[0] = -42.0; ringY[1] = -47.0; ringY[2] = -52.0; ringY[3] = -57.0;
    float ringR[4];
    ringR[0] = 5.4; ringR[1] = 4.4; ringR[2] = 3.4; ringR[3] = 2.4;

    float targetR = ringR[ring];
    float targetY = ringY[ring];

    // base swirl is always active — powder drifts around blocks even before camera arrives
    float baseSwirl = 0.15;
    float swirlSpeed = baseSwirl + intensity * 1.2;
    float currentAngle = aAngle + uTime * swirlSpeed * aSpeed + intensity * 6.0;

    // radius: particles start near the ring, tighten with intensity
    float r = mix(aRadius, targetR, 0.3 + intensity * 0.6);

    vec3 targetPos;
    targetPos.x = cos(currentAngle) * r;
    targetPos.z = sin(currentAngle) * r;
    // vertical bob — tighter with intensity
    targetPos.y = targetY + sin(uTime * aSpeed * 0.9 + aAngle * 2.0) * aThickness * (1.0 - intensity * 0.4);

    // fade from scattered positions to vortex — but particles start CLOSE, not far away
    vec3 finalPos = mix(position, targetPos, smoothstep(0.0, 0.25, intensity) + 0.4);

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);

    // sand-grain sizing: tiny, with slight growth on intensity
    float sizeBase = 0.4 + intensity * 0.6;
    gl_PointSize = sizeBase * (30.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    // twinkle is subtle, base alpha always present
    float twinkle = 0.7 + 0.3 * sin(uTime * aSpeed * 4.0 + aAngle * 7.0);
    vAlpha = aBaseAlpha * (0.4 + intensity * 0.6) * twinkle;
  }
`;

const vortexFrag = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    // tiny sharp dot — sand grain, not soft glow
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.45) discard;

    float core = smoothstep(0.45, 0.1, dist);
    gl_FragColor = vec4(uColor, core * vAlpha * 0.7);
  }
`;

export function createPortalVortex(scene) {
  const positions  = new Float32Array(TOTAL * 3);
  const angles     = new Float32Array(TOTAL);
  const radii      = new Float32Array(TOTAL);
  const speeds     = new Float32Array(TOTAL);
  const rings      = new Float32Array(TOTAL);
  const thickness  = new Float32Array(TOTAL);
  const baseAlpha  = new Float32Array(TOTAL);

  for (let r = 0; r < RING_COUNT; r++) {
    const spec = RING_SPECS[r];
    const base = r * PER_RING;
    for (let i = 0; i < PER_RING; i++) {
      const idx = base + i;
      // start positions CLOSE to the ring — powder drifting around blocks
      const a = Math.random() * Math.PI * 2;
      const spread = spec.radius + (Math.random() - 0.5) * 4;
      positions[idx * 3]     = Math.cos(a) * spread;
      positions[idx * 3 + 1] = spec.y + (Math.random() - 0.5) * 4;
      positions[idx * 3 + 2] = Math.sin(a) * spread;

      angles[idx]     = Math.random() * Math.PI * 2;
      radii[idx]      = spec.radius + (Math.random() - 0.5) * 3;
      speeds[idx]     = 0.4 + Math.random() * 1.6;
      rings[idx]      = r;
      thickness[idx]  = 0.3 + Math.random() * 1.5;
      baseAlpha[idx]  = 0.15 + Math.random() * 0.35; // dimmer base
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',    new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aAngle',      new THREE.BufferAttribute(angles, 1));
  geo.setAttribute('aRadius',     new THREE.BufferAttribute(radii, 1));
  geo.setAttribute('aSpeed',      new THREE.BufferAttribute(speeds, 1));
  geo.setAttribute('aRing',       new THREE.BufferAttribute(rings, 1));
  geo.setAttribute('aThickness',  new THREE.BufferAttribute(thickness, 1));
  geo.setAttribute('aBaseAlpha',  new THREE.BufferAttribute(baseAlpha, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:      { value: 0 },
      uIntensity: { value: new Float32Array(RING_COUNT) },
      uColor:     { value: new THREE.Color(0x80e0c0) },  // aurora green-cyan
    },
    vertexShader: vortexVert,
    fragmentShader: vortexFrag,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  points.name = 'portal-vortex';
  points.frustumCulled = false;
  scene.add(points);

  /**
   * @param {number} cameraY - current camera world Y
   * @param {number} dt      - frame delta
   * @param {number} scrollProgress - 0..1 for visibility gating
   */
  function tick(cameraY, dt, scrollProgress) {
    mat.uniforms.uTime.value += dt;

    // visibility: show from scroll 0.35 (blocks assembling) to 0.95
    points.visible = scrollProgress > 0.35 && scrollProgress < 0.95;

    const uInt = mat.uniforms.uIntensity.value;
    for (let r = 0; r < RING_COUNT; r++) {
      const ringY = RING_SPECS[r].y;
      const dist = Math.abs(cameraY - ringY);
      // broader approach range — particles start swirling when camera is 8 units away
      const proximity = 1 - THREE.MathUtils.clamp(dist / 8, 0, 1);
      const target = proximity * proximity;
      uInt[r] += (target - uInt[r]) * Math.min(1, dt * 3);
    }
  }

  return { tick, points };
}
