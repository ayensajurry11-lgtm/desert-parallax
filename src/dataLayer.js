/* ============================================================
   dataLayer.js — giant blurred data-text drifting in the fog
   ------------------------------------------------------------
   J-Anos Graphix variant: agency-themed telemetry strings.
   ============================================================ */

import { glitchOnce } from './glitchText.js';

const TOKENS = [
  'WORLD_041', '[55] BUILD 00 001 22', 'D 2026', 'RENDER 60FPS',
  'VECTOR_09 // STUDIO', 'CREATIVE INDEX 041', 'NON LINEAR 07',
  'SIGNAL STRONG', '/// 88 PROJECT DATA', 'DEPTH -37.0M', 'PIXELS OK',
  'RENDER PASS 03', '0x2F4A SEED', 'FRAME DELTA -05',
  'POLYCOUNT 2.4M', 'SCENE GRAPH OK', 'CAMERA TRACK 07',
  'LIGHT RIG v3', 'MOTION BLUR ON', 'POST FX ACTIVE',
  'ASSET PIPELINE', 'TEXTURE 4K', 'SHADER COMPILE',
  'GEOMETRY INSTANCED', 'PHYSICS BAKED', 'AUDIO SYNC',
];

const SLOTS = [
  [6, 18, 34, 12, 30], [58, 9, 26, 14, 55], [78, 30, 40, 10, 22],
  [12, 46, 24, 16, 60], [66, 55, 30, 13, 35], [30, 70, 38, 11, 28],
  [84, 74, 24, 15, 70], [4, 84, 28, 12, 40], [44, 28, 22, 18, 80],
  [22, 8, 30, 11, 26], [70, 88, 34, 14, 32], [40, 90, 24, 16, 65],
  [88, 50, 26, 13, 48], [14, 62, 44, 10, 18],
];

export function createDataLayer(rig) {
  const layer = document.querySelector('#data-layer');
  const spans = TOKENS.map((token, i) => {
    const [x, y, size, blur, parallax] = SLOTS[i % SLOTS.length];
    const el = document.createElement('span');
    el.className = 'data-layer__token';
    el.textContent = token;
    el.style.left = `${x}vw`;
    el.style.top = `${y}vh`;
    el.style.fontSize = `${size}px`;
    el.style.filter = `blur(${blur}px)`;
    el.dataset.parallax = parallax;
    layer.appendChild(el);
    return el;
  });

  setInterval(() => {
    glitchOnce(spans[(Math.random() * spans.length) | 0]);
  }, 1500);

  function tick() {
    const section = rig.currentSection;
    const total = rig.SECTION_COUNT;
    const base = section === 0 || section === total - 1 ? 0.03 : 0.08;
    layer.style.opacity = (base).toFixed(3);

    const mx = rig.mouse.smoothX, my = rig.mouse.smoothY;
    const scrollDrift = (section / Math.max(1, total - 1)) * 400;
    for (const el of spans) {
      const p = +el.dataset.parallax;
      el.style.transform =
        `translate(${-mx * p}px, ${-my * p * 0.6 - (scrollDrift % (p * 8))}px)`;
    }
  }

  return { tick };
}
