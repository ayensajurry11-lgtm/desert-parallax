/* ============================================================
   audio.js — procedural ambient audio (Web Audio API)
   ------------------------------------------------------------
   Ambient wind, portal drone, scroll transitions,
   crystal reveals, morph sounds, portal entry.
   All procedural — zero files.
   ============================================================ */

export function createAmbientAudio() {
  let ctx = null;
  let master = null;
  let windNode = null;
  let windGain = null;
  let portalNode = null;
  let portalGain = null;
  let ringGain = null;
  let running = false;

  // Track section transitions for scroll sounds
  let lastSection = -1;
  let lastScrollTime = 0;

  /* ---- ensure context (must be after user gesture) ---------- */
  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);

    // ---- wind/sand drone: filtered noise ---------------------
    const bufLen = ctx.sampleRate * 2;
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    windNode = ctx.createBufferSource();
    windNode.buffer = noiseBuf;
    windNode.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 300;
    windFilter.Q.value = 0.7;

    windGain = ctx.createGain();
    windGain.gain.value = 0;

    windNode.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    windNode.start();

    // ---- portal drone: low oscillator ------------------------
    portalNode = ctx.createOscillator();
    portalNode.type = 'sine';
    portalNode.frequency.value = 55;

    const portalFilter = ctx.createBiquadFilter();
    portalFilter.type = 'lowpass';
    portalFilter.frequency.value = 120;

    portalGain = ctx.createGain();
    portalGain.gain.value = 0;

    portalNode.connect(portalFilter);
    portalFilter.connect(portalGain);
    portalGain.connect(master);
    portalNode.start();

    // ---- ring passage thump ----------------------------------
    ringGain = ctx.createGain();
    ringGain.gain.value = 0;
    ringGain.connect(master);

    running = true;
  }

  /* ---- play a single bass thump (ring passage) -------------- */
  function playThump() {
    if (!ctx || !running) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.2);
    g.gain.setValueAtTime(0.6, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(g);
    g.connect(ringGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
    ringGain.gain.setValueAtTime(1, ctx.currentTime);
    ringGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  }

  /* ---- scroll transition whoosh ----------------------------- */
  function playScrollWhoosh() {
    if (!ctx || !running) return;

    const now = ctx.currentTime;

    // White noise burst
    const bufLen = ctx.sampleRate * 0.4;
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(2000, now + 0.15);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.35);
    filter.Q.value = 0.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start(now);
    noise.stop(now + 0.4);

    // Subtle pitch riser
    const riser = ctx.createOscillator();
    riser.type = 'sine';
    riser.frequency.setValueAtTime(200, now);
    riser.frequency.exponentialRampToValueAtTime(600, now + 0.2);
    riser.frequency.exponentialRampToValueAtTime(150, now + 0.35);

    const riserGain = ctx.createGain();
    riserGain.gain.setValueAtTime(0, now);
    riserGain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    riserGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    riser.connect(riserGain);
    riserGain.connect(master);
    riser.start(now);
    riser.stop(now + 0.35);
  }

  /* ---- crystal label reveal ping ---------------------------- */
  function playCrystalPing() {
    if (!ctx || !running) return;

    const now = ctx.currentTime;

    // Crystalline bell tone
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 1200;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 1800;

    const osc3 = ctx.createOscillator();
    osc3.type = 'triangle';
    osc3.frequency.value = 2400;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.06, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    const gain3 = ctx.createGain();
    gain3.gain.setValueAtTime(0.04, now);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc1.connect(gain);
    osc2.connect(gain2);
    osc3.connect(gain3);
    gain.connect(master);
    gain2.connect(master);
    gain3.connect(master);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.4);
    osc3.stop(now + 0.3);
  }

  /* ---- footer morph sound ----------------------------------- */
  function playMorphSound() {
    if (!ctx || !running) return;

    const now = ctx.currentTime;

    // Digital warp sweep
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(2000, now + 0.1);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.35);
    filter.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.4);

    // Sparkle layer
    const spark = ctx.createOscillator();
    spark.type = 'sine';
    spark.frequency.setValueAtTime(2000, now);
    spark.frequency.exponentialRampToValueAtTime(4000, now + 0.1);
    spark.frequency.exponentialRampToValueAtTime(1500, now + 0.25);

    const sparkGain = ctx.createGain();
    sparkGain.gain.setValueAtTime(0.04, now);
    sparkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    spark.connect(sparkGain);
    sparkGain.connect(master);
    spark.start(now);
    spark.stop(now + 0.25);
  }

  /* ---- portal entry swell ----------------------------------- */
  function playPortalEntry() {
    if (!ctx || !running) return;

    const now = ctx.currentTime;

    // Deep sub bass swell
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(40, now);
    sub.frequency.linearRampToValueAtTime(25, now + 1.5);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(0.25, now + 0.5);
    subGain.gain.linearRampToValueAtTime(0.15, now + 1.2);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

    sub.connect(subGain);
    subGain.connect(master);
    sub.start(now);
    sub.stop(now + 2.0);

    // Mid-range riser
    const riser = ctx.createOscillator();
    riser.type = 'sawtooth';
    riser.frequency.setValueAtTime(100, now);
    riser.frequency.exponentialRampToValueAtTime(400, now + 0.8);
    riser.frequency.exponentialRampToValueAtTime(80, now + 1.8);

    const riserFilter = ctx.createBiquadFilter();
    riserFilter.type = 'lowpass';
    riserFilter.frequency.setValueAtTime(200, now);
    riserFilter.frequency.exponentialRampToValueAtTime(1500, now + 0.6);
    riserFilter.frequency.exponentialRampToValueAtTime(150, now + 1.5);

    const riserGain = ctx.createGain();
    riserGain.gain.setValueAtTime(0, now);
    riserGain.gain.linearRampToValueAtTime(0.08, now + 0.3);
    riserGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

    riser.connect(riserFilter);
    riserFilter.connect(riserGain);
    riserGain.connect(master);
    riser.start(now);
    riser.stop(now + 1.8);

    // Noise wash
    const bufLen = ctx.sampleRate * 2;
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(300, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(1200, now + 0.7);
    noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 1.5);
    noiseFilter.Q.value = 0.3;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.1, now + 0.4);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(now);
    noise.stop(now + 2.0);
  }

  /* ---- per-frame update (call from main loop) --------------- */
  function tick(scrollProgress, dt, currentSection) {
    if (!ctx || !running) return;

    const now = ctx.currentTime;

    // Wind intensity: peaks in portal zone (0.45–0.9), quiet at hero/footer
    const portalZone = scrollProgress > 0.45 && scrollProgress < 0.9;
    const windTarget = portalZone ? 0.18 : 0.04;
    windGain.gain.value += (windTarget - windGain.gain.value) * dt * 2;

    // Portal drone: fades in at portal entry, out at footer
    const portalTarget = portalZone ? 0.12 : 0;
    portalGain.gain.value += (portalTarget - portalGain.gain.value) * dt * 1.5;

    // Scroll transition sounds
    if (currentSection !== undefined && currentSection !== lastSection) {
      const timeSinceLastScroll = performance.now() - lastScrollTime;
      if (timeSinceLastScroll > 800) { // debounce
        playScrollWhoosh();
        lastScrollTime = performance.now();
      }
      lastSection = currentSection;
    }
  }

  function start() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    running = true;
  }
  function stop() { running = false; if (ctx && ctx.state === 'running') ctx.suspend(); }

  return {
    start, stop, tick,
    playThump,
    playScrollWhoosh,
    playCrystalPing,
    playMorphSound,
    playPortalEntry,
    ensure,
  };
}
