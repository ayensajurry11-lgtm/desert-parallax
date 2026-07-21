/* ============================================================
   portalEffects.js — heat haze, vignette, bass thump
   ------------------------------------------------------------
   Enhances the portal dive experience with screen distortion,
   edge darkening, and audio feedback.
   ============================================================ */

import * as THREE from 'three';

const RING_Y_POSITIONS = [-42, -47, -52, -57];
const PORTAL_START = -38;
const PORTAL_END = -62;

/* ---- HEAZE HAZE WARP --------------------------------------- */
function createHeatHaze() {
  const el = document.createElement('div');
  el.id = 'heat-haze';
  el.style.cssText = `
    position: fixed; inset: 0; z-index: 3; pointer-events: none;
    opacity: 0;
    background: radial-gradient(ellipse at 50% 50%,
      rgba(140, 200, 230, 0.15) 0%,
      rgba(100, 170, 210, 0.05) 100%);
  `;
  document.body.appendChild(el);

  let intensity = 0;

  function tick(dt, camera) {
    const y = camera.position.y;
    // Intensity peaks near crystals (-14 to -30) and fades toward portal
    const crystalDist = Math.min(
      Math.abs(y - (-14)),
      Math.abs(y - (-30))
    );
    const crystalIntensity = Math.max(0, 1 - crystalDist / 12);

    // Also add subtle intensity in portal
    const portalIntensity = (y < PORTAL_START && y > PORTAL_END)
      ? 0.3 + 0.2 * Math.sin(y * 0.5)
      : 0;

    const target = Math.max(crystalIntensity * 0.8, portalIntensity);
    intensity += (target - intensity) * dt * 4;

    // Only animate opacity — no backdrop-filter per frame (GPU compositor killer)
    el.style.opacity = intensity.toFixed(3);
  }

  return { tick };
}

/* ---- DEPTH VIGNETTE ---------------------------------------- */
function createVignette() {
  const el = document.createElement('div');
  el.id = 'depth-vignette';
  el.style.cssText = `
    position: fixed; inset: 0; z-index: 4; pointer-events: none;
    opacity: 0;
    background: radial-gradient(ellipse at 50% 50%,
      transparent 30%,
      rgba(40, 30, 20, 0.7) 100%);
  `;
  document.body.appendChild(el);

  let intensity = 0;

  function tick(dt, camera) {
    const y = camera.position.y;
    // Vignette active during portal dive
    const target = (y < PORTAL_START && y > PORTAL_END) ? 0.8 : 0;
    intensity += (target - intensity) * dt * 3;
    el.style.opacity = intensity.toFixed(3);
  }

  return { tick };
}

/* ---- BASS THUMP (lazy AudioContext — created on first click) - */
function createBassThump() {
  let audioCtx = null;
  const ringFlashed = new Set();

  function ensureCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playThump() {
    const ctx = ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  }

  function tick(camera) {
    const y = camera.position.y;
    for (const ringY of RING_Y_POSITIONS) {
      const dist = Math.abs(y - ringY);
      if (dist < 1.5 && !ringFlashed.has(ringY)) {
        playThump();
        ringFlashed.add(ringY);
      }
      if (dist > 3) ringFlashed.delete(ringY);
    }
  }

  return { tick };
}

/* ---- MAIN EXPORT ------------------------------------------- */
export function createPortalEffects(scene) {
  const heatHaze = createHeatHaze();
  const vignette = createVignette();
  const bassThump = createBassThump();

  function tick(dt, elapsed, camera) {
    heatHaze.tick(dt, camera);
    vignette.tick(dt, camera);
    bassThump.tick(camera);
  }

  return { tick };
}
