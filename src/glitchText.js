/* ============================================================
   glitchText.js — hover scramble for [data-glitch] elements
   ------------------------------------------------------------
   Pure DOM/CSS stand-in for igloo's MSDF shader text. On hover,
   characters cycle through a glyph pool and lock in left→right;
   the .is-glitching class (style.css) adds an RGB-split shadow
   while it runs.

   Zero dependencies, zero canvas — cheap enough to put on every
   nav link. If you later want TRUE shader text, the upgrade path
   is troika-three-text (SDF text in the WebGL scene).
   ============================================================ */

const GLYPHS = '!<>-_\\/[]{}—=+*^?#________'; // trailing _ weights toward "digital"
const FPS = 30;                                // scramble tick rate
const LOCK_PER_TICK = 0.34;                    // chars locked in per tick (speed dial)

function scramble(el) {
  // guard: don't stack animations on rapid re-hovers
  if (el.dataset.glitchRunning) return;
  el.dataset.glitchRunning = '1';

  const original = el.dataset.glitchText ?? el.textContent;
  el.dataset.glitchText = original;             // remember pristine copy
  el.classList.add('is-glitching');

  let locked = 0;
  const interval = setInterval(() => {
    locked += LOCK_PER_TICK * original.length * (1 / FPS) * 10;

    let out = '';
    for (let i = 0; i < original.length; i++) {
      if (original[i] === ' ') { out += ' '; continue; }
      out += i < locked
        ? original[i]                                        // resolved
        : GLYPHS[(Math.random() * GLYPHS.length) | 0];       // still scrambling
    }
    el.textContent = out;

    if (locked >= original.length) {
      clearInterval(interval);
      el.textContent = original;
      el.classList.remove('is-glitching');
      delete el.dataset.glitchRunning;
    }
  }, 1000 / FPS);
}

/* initGlitchText() — call once; safe to re-call after injecting
   new [data-glitch] nodes (listeners attach per element). */
export function initGlitchText(root = document) {
  root.querySelectorAll('[data-glitch]').forEach((el) => {
    if (el.dataset.glitchBound) return;
    el.dataset.glitchBound = '1';
    el.addEventListener('mouseenter', () => scramble(el));
  });
}

/* glitchOnce(el) — exported so you can trigger it manually, e.g.
   scrambling a heading when its section scrolls into view:
   ScrollTrigger.create({ trigger: '#section-core',
     onEnter: () => glitchOnce(document.querySelector('#section-core .beat__title')) }) */
export const glitchOnce = scramble;
