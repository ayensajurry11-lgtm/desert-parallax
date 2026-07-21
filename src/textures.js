/* ============================================================
   textures.js — procedural canvas textures (no external files)
   ------------------------------------------------------------
   Arctic Ice Cave variant: frost patterns, ice crystal surfaces,
   translucent frozen materials.

     makeIceMaps()       — frost/ice surface for hero shell bricks
     makeFrozenStoneMaps() — frozen rock for portal rings
     makeDiamondMaps()    — ice crystal refraction patterns

     Each returns { map, bump }.
   ============================================================ */

import * as THREE from 'three';

/* per-pixel speckle noise via ImageData */
function speckle(ctx, size, base, variance) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 2 * variance;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

function canvasPair(w, h) {
  const make = () => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
  };
  return [make(), make()];
}

function toTexture(canvas, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ---- ice: frost surface for hero shell bricks --------------- */
export function makeIceMaps() {
  const [[mapC, mx], [bumpC, bx]] = canvasPair(512, 512);

  // albedo: pale blue-white base with frost mottling
  mx.fillStyle = '#d0e4f0';
  mx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 30; i++) {
    const g = mx.createRadialGradient(
      Math.random() * 512, Math.random() * 512, 8,
      Math.random() * 512, Math.random() * 512, 40 + Math.random() * 120);
    const r = 180 + Math.random() * 40;
    const gr = 210 + Math.random() * 30;
    const b = 230 + Math.random() * 25;
    g.addColorStop(0, `rgba(${r},${gr},${b},${0.05 + Math.random() * 0.08})`);
    g.addColorStop(1, `rgba(${r},${gr},${b},0)`);
    mx.fillStyle = g;
    mx.fillRect(0, 0, 512, 512);
  }
  // frost crystalline streaks
  mx.strokeStyle = 'rgba(220,240,255,0.12)';
  mx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    mx.beginPath();
    let x = Math.random() * 512, y = Math.random() * 512;
    mx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (Math.random() - 0.5) * 80;
      y += (Math.random() - 0.3) * 60;
      mx.lineTo(x, y);
    }
    mx.stroke();
  }
  speckle(mx, 512, 0, 8);

  // bump: fine ice grain
  bx.fillStyle = '#a0b8c8';
  bx.fillRect(0, 0, 512, 512);
  speckle(bx, 512, 0, 16);
  // ice fracture lines
  bx.strokeStyle = 'rgba(80,110,140,0.3)';
  bx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    bx.beginPath();
    let x = Math.random() * 512, y = Math.random() * 512;
    bx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (Math.random() - 0.5) * 120;
      y += (Math.random() - 0.5) * 120;
      bx.lineTo(x, y);
    }
    bx.stroke();
  }

  return { map: toTexture(mapC), bump: toTexture(bumpC, false) };
}

/* ---- frozen stone (portal rings) ----------------------------
   Dark frozen rock with ice veins. */
export function makeFrozenStoneMaps() {
  const [[mapC, mx], [bumpC, bx]] = canvasPair(512, 512);

  // dark frozen base
  mx.fillStyle = '#4a6070';
  mx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 24; i++) {
    const g = mx.createRadialGradient(
      Math.random() * 512, Math.random() * 512, 6,
      Math.random() * 512, Math.random() * 512, 50 + Math.random() * 110);
    g.addColorStop(0, `rgba(60,80,100,${0.04 + Math.random() * 0.06})`);
    g.addColorStop(1, 'rgba(60,80,100,0)');
    mx.fillStyle = g;
    mx.fillRect(0, 0, 512, 512);
  }
  speckle(mx, 512, 0, 10);

  // ice veins
  mx.strokeStyle = 'rgba(160,210,240,0.15)';
  mx.lineWidth = 1.5;
  for (let i = 0; i < 10; i++) {
    mx.beginPath();
    let x = Math.random() * 512, y = Math.random() * 512;
    mx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (Math.random() - 0.5) * 130;
      y += (Math.random() - 0.5) * 130;
      mx.lineTo(x, y);
    }
    mx.stroke();
  }

  // bump: rough frozen surface
  bx.fillStyle = '#3a5060';
  bx.fillRect(0, 0, 512, 512);
  speckle(bx, 512, 0, 20);
  bx.strokeStyle = 'rgba(40,60,80,0.4)';
  bx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    bx.beginPath();
    let x = Math.random() * 512, y = Math.random() * 512;
    bx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (Math.random() - 0.5) * 140;
      y += (Math.random() - 0.5) * 140;
      bx.lineTo(x, y);
    }
    bx.stroke();
  }

  return { map: toTexture(mapC), bump: toTexture(bumpC, false) };
}

/* ---- snow stone (light rough blocks for portal rings) --------
   Light gray-white rough stone with subtle grain. */
export function makeSnowStoneMaps() {
  const [[mapC, mx], [bumpC, bx]] = canvasPair(512, 512);

  // light gray-white base
  mx.fillStyle = '#c8d0d8';
  mx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 28; i++) {
    const g = mx.createRadialGradient(
      Math.random() * 512, Math.random() * 512, 6,
      Math.random() * 512, Math.random() * 512, 40 + Math.random() * 100);
    const r = 190 + Math.random() * 30;
    const gr = 200 + Math.random() * 25;
    const b = 210 + Math.random() * 20;
    g.addColorStop(0, `rgba(${r},${gr},${b},${0.04 + Math.random() * 0.06})`);
    g.addColorStop(1, `rgba(${r},${gr},${b},0)`);
    mx.fillStyle = g;
    mx.fillRect(0, 0, 512, 512);
  }
  speckle(mx, 512, 0, 12);

  // subtle white veins
  mx.strokeStyle = 'rgba(240,245,250,0.18)';
  mx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    mx.beginPath();
    let x = Math.random() * 512, y = Math.random() * 512;
    mx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (Math.random() - 0.5) * 100;
      y += (Math.random() - 0.5) * 100;
      mx.lineTo(x, y);
    }
    mx.stroke();
  }

  // bump: rough grainy surface
  bx.fillStyle = '#b0b8c0';
  bx.fillRect(0, 0, 512, 512);
  speckle(bx, 512, 0, 22);

  return { map: toTexture(mapC), bump: toTexture(bumpC, false) };
}

/* ---- light gray stone (hero shell bricks) --------------------
   Clean light gray stone with varied grain and cracks. */
export function makeRockSnowMaps() {
  const [[mapC, mx], [bumpC, bx]] = canvasPair(512, 512);

  // light gray base
  mx.fillStyle = '#c0c8d0';
  mx.fillRect(0, 0, 512, 512);

  // stone grain patches — varied gray tones
  for (let i = 0; i < 50; i++) {
    const g = mx.createRadialGradient(
      Math.random() * 512, Math.random() * 512, 3,
      Math.random() * 512, Math.random() * 512, 20 + Math.random() * 60);
    const v = 170 + Math.random() * 60;
    g.addColorStop(0, `rgba(${v},${v + 3},${v + 6},${0.06 + Math.random() * 0.1})`);
    g.addColorStop(1, `rgba(${v},${v + 3},${v + 6},0)`);
    mx.fillStyle = g;
    mx.fillRect(0, 0, 512, 512);
  }

  // subtle darker mottling
  for (let i = 0; i < 15; i++) {
    const g = mx.createRadialGradient(
      Math.random() * 512, Math.random() * 512, 4,
      Math.random() * 512, Math.random() * 512, 30 + Math.random() * 50);
    g.addColorStop(0, `rgba(150,155,162,${0.06 + Math.random() * 0.08})`);
    g.addColorStop(1, 'rgba(150,155,162,0)');
    mx.fillStyle = g;
    mx.fillRect(0, 0, 512, 512);
  }

  speckle(mx, 512, 0, 8);

  // bump: stone grain + cracks
  bx.fillStyle = '#a0a8b0';
  bx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 55; i++) {
    const g = bx.createRadialGradient(
      Math.random() * 512, Math.random() * 512, 2,
      Math.random() * 512, Math.random() * 512, 12 + Math.random() * 40);
    const v = 140 + Math.random() * 70;
    g.addColorStop(0, `rgba(${v},${v + 5},${v + 8},${0.06 + Math.random() * 0.1})`);
    g.addColorStop(1, `rgba(${v},${v + 5},${v + 8},0)`);
    bx.fillStyle = g;
    bx.fillRect(0, 0, 512, 512);
  }

  // stone cracks
  bx.strokeStyle = 'rgba(100,108,115,0.35)';
  bx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    bx.beginPath();
    let x = Math.random() * 512, y = Math.random() * 512;
    bx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (Math.random() - 0.5) * 90;
      y += (Math.random() - 0.5) * 90;
      bx.lineTo(x, y);
    }
    bx.stroke();
  }

  speckle(bx, 512, 0, 14);

  return { map: toTexture(mapC), bump: toTexture(bumpC, false) };
}

/* ---- diamond: ice crystal internal refraction ---------------
   Bright white-blue mottling with prismatic aurora streaks. */
export function makeDiamondMaps() {
  const [[mapC, mx], [bumpC, bx]] = canvasPair(512, 512);

  // base: bright ice-white with blue mottling
  mx.fillStyle = '#e8f4ff';
  mx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 18; i++) {
    const g = mx.createRadialGradient(
      Math.random() * 512, Math.random() * 512, 4,
      Math.random() * 512, Math.random() * 512, 35 + Math.random() * 90);
    g.addColorStop(0, `rgba(180,220,250,${0.06 + Math.random() * 0.08})`);
    g.addColorStop(1, 'rgba(180,220,250,0)');
    mx.fillStyle = g;
    mx.fillRect(0, 0, 512, 512);
  }

  // prismatic aurora streaks — green/cyan/blue refractions
  const auroraHues = [140, 160, 180, 200, 220]; // green to blue range
  for (let i = 0; i < 6; i++) {
    const hue = auroraHues[Math.floor(Math.random() * auroraHues.length)];
    mx.strokeStyle = `hsla(${hue}, 70%, 75%, 0.12)`;
    mx.lineWidth = 2 + Math.random() * 3;
    mx.beginPath();
    let x = Math.random() * 512, y = Math.random() * 512;
    mx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (Math.random() - 0.5) * 100;
      y += (Math.random() - 0.5) * 100;
      mx.lineTo(x, y);
    }
    mx.stroke();
  }

  // bump: fine ice facet detail
  bx.fillStyle = '#c0d4e4';
  bx.fillRect(0, 0, 512, 512);
  speckle(bx, 512, 0, 8);

  return { map: toTexture(mapC), bump: toTexture(bumpC, false) };
}

/* ---- legacy aliases ----------------------------------------- */
export const makeSandMaps = makeIceMaps;
export const makeDesertStoneMaps = makeSnowStoneMaps;
export const makeRockPlainMaps = makeFrozenStoneMaps;
