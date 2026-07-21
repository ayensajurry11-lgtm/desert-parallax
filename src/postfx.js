/* ============================================================
   postfx.js — lean post-processing pipeline
   ------------------------------------------------------------
   Stripped back: warp distortion + film grain only.
   Bloom and heat haze removed for performance.
   ============================================================ */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/* ---- Film Grain Shader --------------------------------------- */
const FilmGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime:    { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p.yx + 19.19);
      return fract((p.x + p.y) * p.x);
    }

    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      float grain = (hash(vUv * 600.0 + uTime * 97.0) - 0.5) * 0.08;
      col.rgb += grain;
      // deeper vignette for atmospheric depth
      vec2 c = vUv - 0.5;
      col.rgb *= 1.0 - dot(c, c) * 0.6;
      // stronger contrast + slight S-curve
      col.rgb = col.rgb * (1.0 - 0.18) + col.rgb * col.rgb * 0.18;
      // color grade: lift shadows blue, warm highlights slightly
      col.r = col.r * 1.02 + 0.01;
      col.g = col.g * 1.0;
      col.b = col.b * 1.04 + 0.02;
      // subtle saturation boost
      float luma = dot(col.rgb, vec3(0.299, 0.587, 0.114));
      col.rgb = mix(vec3(luma), col.rgb, 1.15);
      gl_FragColor = vec4(col.rgb, 1.0);
    }
  `,
};

/* ---- Radial Blur Shader (zoom blur from center) -------------- */
const RadialBlurShader = {
  uniforms: {
    tDiffuse:   { value: null },
    uStrength:  { value: 0.0 },
    uCenter:    { value: new THREE.Vector2(0.5, 0.5) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform vec2 uCenter;
    varying vec2 vUv;

    void main() {
      vec2 dir = vUv - uCenter;
      float dist = length(dir);
      // Only blur outside the center sphere area — keep sphere sharp
      float mask = smoothstep(0.05, 0.35, dist);
      float strength = uStrength * mask;
      vec4 col = vec4(0.0);
      const int SAMPLES = 16;
      float total = 0.0;
      for (int i = 0; i < SAMPLES; i++) {
        float t = float(i) / float(SAMPLES - 1);
        float w = 1.0 - t * 0.5;
        vec2 off = dir * t * strength;
        col += texture2D(tDiffuse, vUv - off) * w;
        total += w;
      }
      col /= total;
      gl_FragColor = vec4(col.rgb, 1.0);
    }
  `,
};

/* ---- Warp Shader (chromatic + zoom blur + glass) ------------- */
const WarpShader = {
  uniforms: {
    tDiffuse:    { value: null },
    uDistortion: { value: 0 },
    uTime:       { value: 0 },
    uAspect:     { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uDistortion;
    uniform float uTime;
    uniform float uAspect;
    varying vec2 vUv;

    float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

    void main() {
      vec2 uv = vUv;
      vec2 center = vec2(0.5);
      vec2 dir = uv - center;
      dir.x *= uAspect;
      float dist = length(dir);
      float d = uDistortion;

      /* ---- 1. RADIAL ZOOM BLUR (strong, center-biased) -------- */
      vec3 col = vec3(0.0);
      float blurStr = d * 0.55;
      float radialFalloff = smoothstep(0.0, 0.8, dist);
      float sampleBlur = blurStr * (0.3 + radialFalloff * 0.7);
      const int SAMPLES = 14;
      for (int i = 0; i < SAMPLES; i++) {
        float t = float(i) / float(SAMPLES - 1);
        vec2 off = dir * (t * sampleBlur);
        vec3 s;
        s.r = texture2D(tDiffuse, uv - off * 1.05).r;
        s.g = texture2D(tDiffuse, uv - off).g;
        s.b = texture2D(tDiffuse, uv - off * 0.95).b;
        col += s;
      }
      col /= float(SAMPLES);

      /* ---- 2. CHROMATIC ABERRATION (radial, stronger) --------- */
      float ca = d * 0.04;
      vec2 caDir = normalize(dir + 1e-6) * ca * radialFalloff;
      col.r = texture2D(tDiffuse, uv + caDir).r;
      col.b = texture2D(tDiffuse, uv - caDir).b;

      /* ---- 3. PIXEL GLASS (stronger) -------------------------- */
      float glass = d * 0.06;
      float b1 = floor(uv.y * 80.0);
      float b2 = floor(uv.y * 37.0 + 13.0);
      float b3 = floor(uv.y * 120.0 + 7.0);
      float tear = (hash(b1 + floor(uTime * 12.0)) - 0.5) * glass
                 + (hash(b2 + floor(uTime * 7.0))  - 0.5) * glass * 0.6
                 + (hash(b3 + floor(uTime * 22.0)) - 0.5) * glass * 0.3;
      vec2 gUv = uv + vec2(tear, 0.0);
      vec3 glassCol;
      glassCol.r = texture2D(tDiffuse, gUv + vec2(ca * 0.5, 0.0)).r;
      glassCol.g = texture2D(tDiffuse, gUv).g;
      glassCol.b = texture2D(tDiffuse, gUv - vec2(ca * 0.5, 0.0)).b;
      col = mix(col, glassCol, smoothstep(0.0, 0.3, d));

      /* ---- 4. RADIAL DARKEN (vignette boost at high dist) ----- */
      float vig = 1.0 - smoothstep(0.3, 1.2, dist) * d * 0.4;
      col *= vig;

      /* ---- output -------------------------------------------- */
      col += d * d * 0.08;
      gl_FragColor = vec4(col.rgb, 1.0);
    }
  `,
};

/* ============================================================
   MAIN: lean pipeline — render → warp → grain
   ============================================================ */
export function createPostFX(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);

  composer.addPass(new RenderPass(scene, camera));

  // Radial blur pass (zoom blur from center)
  const radialPass = new ShaderPass(RadialBlurShader);
  composer.addPass(radialPass);

  // Warp pass (distortion + portal hex)
  const warpPass = new ShaderPass(WarpShader);
  composer.addPass(warpPass);

  // Film grain + vignette (final)
  const grainPass = new ShaderPass(FilmGrainShader);
  grainPass.renderToScreen = true;
  composer.addPass(grainPass);

  const u = {
    warp:   warpPass.uniforms,
    grain:  grainPass.uniforms,
    radial: radialPass.uniforms,
  };

  function setSize() {
    const w = window.innerWidth, h = window.innerHeight;
    composer.setSize(w, h);
    composer.setPixelRatio(renderer.getPixelRatio());
    u.warp.uAspect.value = w / h;
  }
  window.addEventListener('resize', setSize);
  setSize();

  function render(elapsed) {
    u.warp.uTime.value = elapsed;
    u.grain.uTime.value = elapsed;
    composer.render();
  }

  function setDistortion(v) { u.warp.uDistortion.value = v; }
  function setRadialBlur(v) { u.radial.uStrength.value = v; }

  return {
    composer, warpPass, render, setSize,
    setDistortion, setRadialBlur,
    get distortion() { return u.warp.uDistortion.value; },
    get radialBlur() { return u.radial.uStrength.value; },
  };
}
