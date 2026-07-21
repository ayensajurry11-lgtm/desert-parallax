/* ============================================================
   hud.js — 3D-anchored callout labels (the igloo HUD treatment)
   ------------------------------------------------------------
   Each portfolio shard gets a cluster of DOM labels that track
   its projected screen position every frame:

     ┌ PORTFOLIO_CO_01          TEMP  21.68 ┐
     │ NORTH SIGNAL      \          -05.74  │
     │              \     [shard]           │
     │                        D 03.14.2025  │
     └                    CLICK TO EXPLORE ─┘

   - Leader lines live in one full-screen SVG overlay.
   - TEMP digits jitter every few frames (live-readout feel).
   - Visibility = "am I the active beat?" × "not mid-whiteout".
   - The title scrambles (glitchText) each time its beat locks in.

   All styling hooks are in style.css under `.hud`.
   ============================================================ */

import * as THREE from 'three';
import { glitchOnce } from './glitchText.js';

// px offsets of each label from the shard's projected center
const OFFSETS = {
  label: { x: -240, y: -150 },
  temp:  { x:  150, y: -110 },
  cta:   { x:  120, y:   90 },
};

export function createHud(assets, camera, rig) {
  const svg = document.querySelector('#hud-lines');
  const layer = document.querySelector('#hud');
  const world = new THREE.Vector3();

  // Build one callout cluster per shard that carries hud metadata.
  // beatIndex = position in the manifest (hero is beat 0).
  const callouts = [];
  assets.forEach(({ def, object }, i) => {
    if (!def.hud) return;

    const root = document.createElement('div');
    root.className = 'hud__callout';
    root.innerHTML = `
      <div class="hud__label">
        <span class="hud__id">${def.hud.id}</span>
        <span class="hud__title" data-glitch>${def.hud.title}</span>
      </div>
      <div class="hud__temp">
        <span>TEMP</span>
        <span class="hud__temp-a">${def.hud.temp.toFixed(2)}</span>
        <span class="hud__temp-b">-05.74</span>
      </div>
      <div class="hud__cta">
        <span class="hud__date">${def.hud.date}</span>
        <span data-glitch>SCROLL TO EXPLORE</span>
      </div>`;
    layer.appendChild(root);

    // two leader lines: label->shard and cta->shard
    const lineA = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const lineB = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    [lineA, lineB].forEach((l) => { l.setAttribute('class', 'hud__line'); svg.appendChild(l); });

    callouts.push({
      def, object, root, lineA, lineB,
      beat: i,                       // manifest order == beat order
      label: root.querySelector('.hud__label'),
      temp:  root.querySelector('.hud__temp'),
      cta:   root.querySelector('.hud__cta'),
      tempA: root.querySelector('.hud__temp-a'),
      tempB: root.querySelector('.hud__temp-b'),
      title: root.querySelector('.hud__title'),
      wasActive: false,
      jitterT: 0,
    });
  });

  function tick(dt) {
    const activeSection = rig.currentSection;
    // beat → section index (hero=0, pullback=1, crystal1=2, crystal2=3)
    const beatToSection = [0, 2, 3];

    for (const c of callouts) {
      // visible only when this callout's section is active
      const active = activeSection === beatToSection[c.beat];
      const alpha = active ? 1 : 0;
      c.root.style.opacity = alpha.toFixed(3);

      const lineAlpha = (alpha * 0.8).toFixed(3);
      c.lineA.style.opacity = lineAlpha;
      c.lineB.style.opacity = lineAlpha;

      if (alpha <= 0.01) { c.wasActive = c.wasActive && active; continue; }

      // scramble the title once each time the beat locks in
      if (active && !c.wasActive) { glitchOnce(c.title); c.wasActive = true; }
      if (!active) c.wasActive = false;

      // project shard center -> screen px
      c.object.getWorldPosition(world).project(camera);
      const sx = (world.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-world.y * 0.5 + 0.5) * window.innerHeight;

      c.label.style.transform = `translate(${sx + OFFSETS.label.x}px, ${sy + OFFSETS.label.y}px)`;
      c.temp.style.transform  = `translate(${sx + OFFSETS.temp.x}px,  ${sy + OFFSETS.temp.y}px)`;
      c.cta.style.transform   = `translate(${sx + OFFSETS.cta.x}px,   ${sy + OFFSETS.cta.y}px)`;

      // leader lines: from label/cta toward the shard, stopping short
      c.lineA.setAttribute('x1', sx + OFFSETS.label.x + 150);
      c.lineA.setAttribute('y1', sy + OFFSETS.label.y + 18);
      c.lineA.setAttribute('x2', sx - 30);
      c.lineA.setAttribute('y2', sy - 20);
      c.lineB.setAttribute('x1', sx + OFFSETS.cta.x);
      c.lineB.setAttribute('y1', sy + OFFSETS.cta.y + 10);
      c.lineB.setAttribute('x2', sx + 20);
      c.lineB.setAttribute('y2', sy + 20);

      // live TEMP jitter, throttled to ~6Hz so it reads as telemetry
      c.jitterT += dt;
      if (c.jitterT > 0.16) {
        c.jitterT = 0;
        c.tempA.textContent = (c.def.hud.temp + (Math.random() - 0.5) * 0.9).toFixed(2);
        c.tempB.textContent = (-5.74 + (Math.random() - 0.5) * 1.6).toFixed(2);
      }
    }
  }

  return { tick };
}
