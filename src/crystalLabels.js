/* ============================================================
   crystalLabels.js — typewriter labels for crystal sections
   ------------------------------------------------------------
   Appears when a crystal is centered in camera view.
   Digital typewriter text + SVG leader line connecting to crystal.
   Now clickable with links to portfolio.
   ============================================================ */

import * as THREE from 'three';
import { glitchOnce } from './glitchText.js';

const CRYSTAL_LABELS = [
  {
    title: 'BRANDING PORTFOLIO',
    subtitle: 'VISUAL IDENTITY & BRAND SYSTEMS',
    beat: 1,
    link: 'https://ayensajurry11.wixstudio.com/jurry11',
  },
  {
    title: '3D VISUALIZATION',
    subtitle: 'ARCHITECTURAL & PRODUCT RENDERING',
    beat: 2,
    link: 'https://ayensajurry11-lgtm.github.io/J-Anos/',
  },
];

const TYPE_SPEED = 55;      // ms per character
const LINE_OFFSET_X = -180; // text offset from crystal screen pos
const LINE_OFFSET_Y = -60;

export function createCrystalLabels(assets, camera, rig, onReveal) {
  const svg = document.querySelector('#hud-lines');
  const world = new THREE.Vector3();

  const labels = [];

  CRYSTAL_LABELS.forEach((cfg) => {
    const asset = assets[cfg.beat]; // beat 1 = crystal 1, beat 2 = crystal 2
    if (!asset) return;

    // DOM elements
    const root = document.createElement('div');
    root.className = 'crystal-label';
    root.innerHTML = `
      <a href="${cfg.link}" target="_blank" rel="noopener" class="crystal-label__link">
        <span class="crystal-label__title" data-glitch></span>
        <span class="crystal-label__sub">${cfg.subtitle}</span>
        <span class="crystal-label__cta">[ EXPLORE ]</span>
      </a>
    `;
    document.body.appendChild(root);

    // SVG leader line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'crystal-label__line');
    svg.appendChild(line);

    labels.push({
      cfg,
      asset,
      root,
      line,
      titleEl: root.querySelector('.crystal-label__title'),
      linkEl: root.querySelector('.crystal-label__link'),
      fullText: cfg.title,
      typedChars: 0,
      typeTimer: 0,
      isActive: false,
      wasActive: false,
    });
  });

  function tick(dt) {
    const activeSection = rig.currentSection;

    // beat → section index mapping (hero=0, pullback=1, crystal1=2, crystal2=3, ...)
    const beatToSection = [0, 2, 3];

    for (const lb of labels) {
      const active = activeSection === beatToSection[lb.cfg.beat];

      // typewriter: start typing when crystal becomes active
      if (active && !lb.wasActive) {
        lb.typedChars = 0;
        lb.typeTimer = 0;
        lb.titleEl.textContent = '';
        lb.isActive = true;
        if (onReveal) onReveal(lb.cfg.beat);
      }
      if (!active) {
        lb.isActive = false;
        lb.wasActive = false;
        lb.root.style.opacity = '0';
        lb.root.style.pointerEvents = 'none';
        lb.line.style.opacity = '0';
        continue;
      }
      lb.wasActive = true;
      lb.root.style.pointerEvents = 'auto';

      // typewriter progression
      if (lb.isActive && lb.typedChars < lb.fullText.length) {
        lb.typeTimer += dt * 1000;
        if (lb.typeTimer >= TYPE_SPEED) {
          lb.typeTimer -= TYPE_SPEED;
          lb.typedChars++;
          lb.titleEl.textContent = lb.fullText.slice(0, lb.typedChars);
          // glitch on each new character
          if (lb.typedChars % 3 === 0) glitchOnce(lb.titleEl);
        }
      }

      // project crystal to screen
      lb.asset.object.getWorldPosition(world).project(camera);
      const sx = (world.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-world.y * 0.5 + 0.5) * window.innerHeight;

      // position text label
      const tx = sx + LINE_OFFSET_X;
      const ty = sy + LINE_OFFSET_Y;
      lb.root.style.transform = `translate(${tx}px, ${ty}px)`;
      lb.root.style.opacity = '1';

      // leader line: from label edge to crystal
      lb.line.setAttribute('x1', tx + lb.fullText.length * 11 + 10);
      lb.line.setAttribute('y1', ty + 18);
      lb.line.setAttribute('x2', sx);
      lb.line.setAttribute('y2', sy);
      lb.line.style.opacity = '0.5';
    }
  }

  return { tick };
}
