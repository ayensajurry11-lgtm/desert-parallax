/* ============================================================
   scrollField.js — force-field scroll-jacking controller
   ------------------------------------------------------------
   Intercepts wheel + touch events. The viewport is LOCKED to
   the current section like a force field.

   To break free:
   - Scroll 2+ times within 400ms (rapid notches)
   - OR one heavy scroll (deltaY > 150)

   Light single scrolls drive within-section parallax only.
   ============================================================ */

export function createScrollField({ onBreak, onParallax }) {
  let enabled = false;          // true = intercepting events
  let scrollCount = 0;
  let lastScrollTime = 0;
  const SCROLL_WINDOW = 400;    // ms — count scrolls within this window
  const REQUIRED_SCROLLS = 2;
  const HEAVY_SCROLL = 150;     // single-scroll instant break

  /* ---- wheel ----------------------------------------------- */
  function handleWheel(e) {
    if (!enabled) return;
    e.preventDefault();

    const now = performance.now();
    // normalize deltaY across deltaMode (0=pixels, 1=lines, 2=pages)
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16;   // lines → px rough estimate
    if (e.deltaMode === 2) delta *= 100;  // pages → px

    // instant break: one heavy scroll
    if (Math.abs(delta) > HEAVY_SCROLL) {
      onBreak(Math.sign(delta));
      scrollCount = 0;
      return;
    }

    // count rapid scrolls
    if (now - lastScrollTime > SCROLL_WINDOW) {
      scrollCount = 0;
    }
    scrollCount++;
    lastScrollTime = now;

    // threshold met — break the lock
    if (scrollCount >= REQUIRED_SCROLLS) {
      onBreak(Math.sign(delta));
      scrollCount = 0;
      return;
    }

    // light scroll — drive parallax within section
    onParallax(delta * 0.003);
  }

  /* ---- touch (swipe) --------------------------------------- */
  let touchStartY = 0;

  function handleTouchStart(e) {
    if (!enabled) return;
    touchStartY = e.touches[0].clientY;
  }

  function handleTouchMove(e) {
    if (!enabled) return;
    e.preventDefault();

    const dy = touchStartY - e.touches[0].clientY;
    touchStartY = e.touches[0].clientY;

    // fast swipe (large delta in one move) = instant break
    if (Math.abs(dy) > 40) {
      onBreak(Math.sign(dy));
      return;
    }

    // slow drag = parallax
    onParallax(dy * 0.01);
  }

  function handleTouchEnd() {
    onParallax(0);
  }

  /* ---- bind ----------------------------------------------- */
  window.addEventListener('wheel', handleWheel, { passive: false });
  window.addEventListener('touchstart', handleTouchStart, { passive: true });
  window.addEventListener('touchmove', handleTouchMove, { passive: false });
  window.addEventListener('touchend', handleTouchEnd, { passive: true });

  function enable()  { enabled = true; scrollCount = 0; }
  function disable() { enabled = false; scrollCount = 0; }

  function destroy() {
    window.removeEventListener('wheel', handleWheel);
    window.removeEventListener('touchstart', handleTouchStart);
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('touchend', handleTouchEnd);
  }

  return { enable, disable, destroy };
}
