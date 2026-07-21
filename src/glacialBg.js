/* ============================================================
   glacialBg.js — fullscreen GLSL noise background
   ------------------------------------------------------------
   Domain-warped FBM noise, reactive to mouse + scroll.
   Igloo.inc aesthetic: pale ice blue base, dark blue undulations,
   organic movement, always alive.
   ============================================================ */

import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.999, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uScroll;
  uniform vec2 uResolution;
  varying vec2 vUv;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                            + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                             dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    for (int i = 0; i < 5; i++) {
      v += a * snoise(p);
      p = p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  float pattern(vec2 p) {
    vec2 q = vec2(
      fbm(p + vec2(0.0, 0.0)),
      fbm(p + vec2(5.2, 1.3))
    );
    vec2 r = vec2(
      fbm(p + 4.0 * q + vec2(1.7, 9.2) + 0.15 * uTime),
      fbm(p + 4.0 * q + vec2(8.3, 2.8) + 0.126 * uTime)
    );
    return fbm(p + 3.5 * r);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;

    vec2 mouseOffset = uMouse * 0.15;
    float scrollDepth = uScroll * 0.4;

    vec2 p = vec2(uv.x * aspect, uv.y) + mouseOffset;
    float f = pattern(p * 2.0 + scrollDepth);

    // color palette: light ice blue → dark navy
    vec3 iceLight  = vec3(0.82, 0.92, 0.97);  // #d0ebf8
    vec3 iceMid    = vec3(0.55, 0.72, 0.85);  // #8cb8d9
    vec3 iceDeep   = vec3(0.12, 0.22, 0.38);  // #1e3860
    vec3 aurora    = vec3(0.40, 0.78, 0.62);  // subtle green

    vec3 col = iceLight;
    col = mix(col, iceMid, smoothstep(-0.2, 0.4, f));
    col = mix(col, iceDeep, smoothstep(0.3, 0.9, f));

    // subtle aurora tint in the mid-tones
    float auroraMask = smoothstep(0.1, 0.5, f) * (1.0 - smoothstep(0.5, 0.8, f));
    col = mix(col, aurora, auroraMask * 0.12);

    // vignette
    vec2 center = uv - 0.5;
    col *= 1.0 - dot(center, center) * 0.3;

    // scroll-driven darkening at depth
    col *= 1.0 - scrollDepth * 0.3;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createGlacialBg() {
  const geo = new THREE.PlaneGeometry(2, 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:       { value: 0 },
      uMouse:      { value: new THREE.Vector2(0, 0) },
      uScroll:     { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    },
    vertexShader,
    fragmentShader,
    depthWrite: false,
    depthTest: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;

  let mouseX = 0, mouseY = 0;
  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  function tick(time, scrollProgress) {
    mat.uniforms.uTime.value = time;
    mat.uniforms.uMouse.value.set(mouseX, mouseY);
    mat.uniforms.uScroll.value = scrollProgress;
  }

  function resize() {
    mat.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  return { mesh, tick, resize };
}
