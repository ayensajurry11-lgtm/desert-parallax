/* ============================================================
   main.js — orchestrator (desert variant, continuous scroll)
   ------------------------------------------------------------
   Simple scroll-driven 3D experience.
   Camera follows scroll position continuously.
   No scroll-jacking, no force-field, no loop.
   ============================================================ */

import * as THREE from 'three';

import { createScene } from './scene.js';
import { loadAssets } from './objects.js';
import { createCameraRig } from './cameraRig.js';
import { createParticleField } from './particles.js';
import { createHud } from './hud.js';
import { createDataLayer } from './dataLayer.js';
import { createTerrain } from './terrain.js';
import { createScaffold } from './scaffold.js';
import { createHeroInteract } from './heroInteract.js';
import { createPortal } from './portal.js';
import { createPostFX } from './postfx.js';
import { initGlitchText } from './glitchText.js';
import { createMountains } from './mountains.js';
import { createPortalEffects } from './portalEffects.js';
import { createPortalVortex } from './portalVortex.js';
import { createCrystalLabels } from './crystalLabels.js';
import { createAmbientAudio } from './audio.js';
import { createSiteManager } from './siteManager.js';

const BASE_FOG = 0.042;

/* ---- reduced motion detection ------------------------------- */
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---- easing helpers ----------------------------------------- */
function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function clamp01(t) { return Math.max(0, Math.min(1, t)); }

/* ---- loader ------------------------------------------------ */
function runLoader(progressSource) {
  const bar = document.querySelector('#loader-bar');
  const CELLS = 8;
  return new Promise((resolve) => {
    const fallback = setTimeout(() => {
      document.querySelector('#loader').classList.add('is-done');
      resolve();
    }, 8000);
    let lastPct = 0;
    const iv = setInterval(() => {
      const real = progressSource ? progressSource.value : 0;
      const floor = Math.min(real + 0.15, 0.95);
      lastPct = Math.max(lastPct + 0.005, Math.min(floor, 1));
      const pct = lastPct;
      const filled = Math.round(pct * CELLS);
      bar.textContent =
        '\u25aa'.repeat(filled) + '\u25ab'.repeat(CELLS - filled) +
        ' ' + String(Math.round(pct * 100)).padStart(3, '0') + '%';
      if (pct >= 1) {
        clearInterval(iv);
        clearTimeout(fallback);
        document.querySelector('#loader').classList.add('is-done');
        resolve();
      }
    }, 80);
  });
}

/* ---- shard intro (RAF) ------------------------------------- */
function runShardIntro(assets, terrain, onComplete) {
  const DURATION = 5.0;
  const start = performance.now();

  const shards = assets.assets.slice(1).map(({ object, wire }) => {
    const targetRot = object.rotation.clone();
    const startRotX = object.rotation.x + 1.4;
    const startRotZ = object.rotation.z - 0.9;
    object.rotation.x = startRotX;
    object.rotation.z = startRotZ;
    object.scale.setScalar(0.25);
    const mats = new Set();
    object.traverse((c) => {
      if (c.isMesh && c.name !== 'hero-core' && !c.name.endsWith('-logo')) mats.add(c.material);
    });
    mats.forEach((m) => { m.opacity = 0; });
    return { object, wire, targetRot, mats };
  });

  terrain.introState.mesh = 0;
  terrain.introState.wire = 0.55;

  function tick() {
    const elapsed = (performance.now() - start) / 1000;
    const t = clamp01(elapsed / DURATION);

    terrain.introState.mesh = easeInOutQuad(t);
    terrain.introState.wire = 0.55 - 0.49 * easeInOutQuad(clamp01((t - 0.24) / 0.76));

    shards.forEach(({ object, targetRot, mats, wire }, i) => {
      const se = easeOutCubic(clamp01((elapsed - (i + 1) * 0.25) / 2.6));
      object.scale.setScalar(0.25 + 0.75 * se);
      object.rotation.x = (targetRot.x + 1.4) - 1.4 * se;
      object.rotation.z = (targetRot.z - 0.9) + 0.9 * se;
      const me = easeInOutQuad(clamp01((elapsed - 1.4 - i * 0.25) / 3.0));
      mats.forEach((m) => { m.opacity = me; });
      if (wire) {
        wire.material.opacity = easeInOutQuad(clamp01((elapsed - 0.9 - i * 0.12) / 2.0)) * 0.12;
      }
    });

    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      if (onComplete) onComplete();
    }
  }
  requestAnimationFrame(tick);
}

/* ============================================================ */
async function init() {
  window.addEventListener('error', (e) => {
    console.error('[ERROR]', e.message, e.filename, e.lineno);
  });

  const canvas = document.querySelector('#webgl');
  const { renderer, scene, camera, resize } = createScene(canvas);
  const progress = { value: 0 };

  const assets = await loadAssets(scene, progress);
  const rig = createCameraRig(camera);
  const field = await createParticleField(scene, camera);
  const hud = createHud(assets.assets, camera, rig);
  const crystalLabels = createCrystalLabels(assets.assets, camera, rig, () => {
    ambientAudio.playCrystalPing();
  });
  const dataLayer = createDataLayer(rig);
  const terrain = createTerrain(scene);
  const scaffold = createScaffold(scene, terrain.getHeight);
  const mountains = createMountains(scene);
  const interact = createHeroInteract(assets, camera, scene, scaffold, terrain);

  let portal = null;
  let portalFx = null;
  let portalVortex = null;
  let portalLoading = false;
  function ensurePortal() {
    if (portal) return;
    if (portalLoading) return;
    portalLoading = true;
    createPortal(scene, camera).then((p) => {
      portal = p;
      portalFx = createPortalEffects(scene);
      portalVortex = createPortalVortex(scene);
    }).catch((err) => {
      console.warn('Portal load failed:', err);
      portal = { tick: () => {}, group: { visible: true } };
      portalFx = { tick: () => {} };
      portalVortex = { tick: () => {}, setOpacity: () => {} };
    });
  }

  const postfx = createPostFX(renderer, scene, camera);
  initGlitchText();

  // ---- DOM refs -----------------------------------------------
  const scrollContent = document.querySelector('#scroll-content');
  const scrollProgressBar = document.querySelector('#scroll-progress');
  const ambientAudio = createAmbientAudio();

  let introDone = false;
  let heroBaseOpacitiesCaptured = false;
  let scrollProgress = 0;  // 0 = hero, 1 = footer
  let crystalFixDone = false;

  // ---- section scroll thresholds (must match cameraRig.js) ----
  // ---- dynamic LOD: frame time monitoring ----------------------
  const lod = { level: 0, frames: 0, avgDt: 0 };

  // ---- scroll tracking ----------------------------------------
  function onScroll() {
    const maxScroll = scrollContent.scrollHeight - window.innerHeight;
    scrollProgress = maxScroll > 0 ? clamp01(window.scrollY / maxScroll) : 0;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- sound toggle -------------------------------------------
  const soundBtn = document.querySelector('#sound-toggle');
  let soundOn = false;
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    soundBtn.querySelector('[data-glitch]').textContent = soundOn ? 'SOUND: ON' : 'SOUND: OFF';
    if (soundOn) {
      ambientAudio.start();
    } else {
      ambientAudio.stop();
    }
  });

  // ---- footer tooltip -----------------------------------------
  const footerTooltip = document.querySelector('#footer-tooltip');
  const tooltipName = footerTooltip.querySelector('.footer-tooltip__name');
  const tooltipUrl = footerTooltip.querySelector('.footer-tooltip__url');
  const tooltipCard = footerTooltip.querySelector('.footer-tooltip__card');
  const tooltipLine = footerTooltip.querySelector('.footer-tooltip__line');

  const tooltipData = {
    'FACEBOOK': {
      name: 'JURRY ANOS',
      url: 'facebook.com/in/jurryanos',
      link: 'https://web.facebook.com/profile.php?fb_profile_edit_entry_point=%7B%22click_point%22%3A%22edit_profile_button%22%2C%22feature%22%3A%22profile_header%22%7D&id=61568439451882&sk=about',
    },
    'LINKEDIN': {
      name: 'JURRY ANOS',
      url: 'linkedin.com/in/jurry-anos-ba1103421',
      link: 'https://www.linkedin.com/in/jurry-anos-ba1103421',
    },
    'GMAIL': {
      name: 'AYENSA JURRY',
      url: 'ayensajurry11@gmail.com',
      link: 'mailto:ayensajurry11@gmail.com',
    },
  };

  const logoMap = { 'FACEBOOK': 'facebook', 'LINKEDIN': 'linkedin', 'GMAIL': 'gmail' };
  const footerLinks = document.querySelectorAll('.footer__links a');
  let tooltipTimeout = null;

  footerLinks.forEach((link) => {
    // Hover: show tooltip
    link.addEventListener('mouseenter', () => {
      clearTimeout(tooltipTimeout);
      const text = link.textContent.trim();
      const data = tooltipData[text];
      if (!data) return;

      tooltipName.textContent = data.name;
      tooltipUrl.textContent = data.url;
      tooltipCard.href = data.link;

      // Position tooltip above the link
      const rect = link.getBoundingClientRect();
      const tooltipX = rect.left + rect.width / 2;
      const tooltipY = rect.top - 20;

      footerTooltip.style.left = `${tooltipX}px`;
      footerTooltip.style.top = `${tooltipY}px`;
      footerTooltip.style.transform = 'translate(-50%, -100%)';

      // Update connecting line
      tooltipLine.setAttribute('y1', '100');
      tooltipLine.setAttribute('x1', '100');

      footerTooltip.classList.add('is-visible');
    });

    link.addEventListener('mouseleave', () => {
      // Delay hide — allows mouse to move to tooltip
      tooltipTimeout = setTimeout(() => {
        footerTooltip.classList.remove('is-visible');
      }, 200);
    });

    // Click: morph particles
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const text = link.textContent.trim();
      const logoName = logoMap[text];
      if (logoName) field.morphTo(logoName);
      ambientAudio.playMorphSound();
      footerLinks.forEach(l => l.classList.remove('is-active'));
      link.classList.add('is-active');
    });
  });

  // Keep tooltip visible when hovering over it
  footerTooltip.addEventListener('mouseenter', () => {
    clearTimeout(tooltipTimeout);
  });

  footerTooltip.addEventListener('mouseleave', () => {
    footerTooltip.classList.remove('is-visible');
  });

  // ---- render loop ---------------------------------------------
  const shell = assets.assets[0].object.userData.shell;
  const clock = new THREE.Clock();
  const introCam = { t: 1 };
  const TOP_DOWN = new THREE.Vector3(0, 15, 0.001);
  const SPHERE_TOP = 3.2;
  const waveState = { front: SPHERE_TOP, glow: 0, active: false };

  function frame() {
    try {
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      const animDt = REDUCED_MOTION ? dt * 0.3 : dt; // slow all animations

      assets.tick(animDt, elapsed);

      // one-shot: force crystal materials to full opacity after intro
      if (!crystalFixDone && elapsed > 6) {
        crystalFixDone = true;
        for (let i = 1; i < assets.assets.length; i++) {
          assets.assets[i].object.traverse((c) => {
            if (c.isMesh && c.material) {
              c.material.opacity = 1;
              c.material.needsUpdate = true;
            }
          });
        }
      }

      // intro camera override
      if (introCam.t < 1) {
        rig.tick(dt, scrollProgress);
        const beat0 = camera.position.clone();
        const e = introCam.t * introCam.t * (3 - 2 * introCam.t);
        camera.position.lerpVectors(TOP_DOWN, beat0, e);
        camera.lookAt(0, 0, 0);
      } else {
        rig.tick(animDt, scrollProgress);
      }

      field.setReveal(clamp01((scrollProgress - 0.7) / 0.2));
      field.tick(animDt, elapsed);
      hud.tick(animDt);
      crystalLabels.tick(animDt);
      dataLayer.tick();

      // hero terrain + scaffold — slow fade as camera descends
      const heroVis = !introDone ? 1 : (scrollProgress < 0.10 ? 1 : Math.max(0, 1 - (scrollProgress - 0.10) / 0.08));
      terrain.setOpacity(heroVis);
      scaffold.setOpacity(heroVis);
      mountains.setOpacity(1);
      if (heroVis > 0.01) { terrain.tick(animDt, elapsed); scaffold.tick(animDt, elapsed); }
      mountains.tick(animDt, elapsed);
      interact.tick(animDt, heroVis, rig.currentSection);

      // fade hero sphere — slow fade as camera descends
      const heroFade = 1 - clamp01((scrollProgress - 0.10) / 0.08);
      const heroGroup = assets.assets[0]?.object;
      if (heroGroup && introDone) {
        // one-time: capture each brick's post-intro opacity
        if (!heroBaseOpacitiesCaptured) {
          heroBaseOpacitiesCaptured = true;
          heroGroup.traverse((c) => {
            if (c.isMesh && c.material && c.material.transparent) {
              c.material.userData._baseOp = c.material.opacity;
            }
          });
        }
        heroGroup.traverse((c) => {
          if (c.isMesh && c.material && c.material.transparent) {
            c.material.opacity = (c.material.userData._baseOp ?? 1) * heroFade;
          }
        });
        heroGroup.visible = heroFade > 0.01;
      }
      const heroWire = assets.assets[0]?.wire;
      if (heroWire && introDone) heroWire.material.opacity = heroFade * 0.9;

      if (waveState.active) shell.setWave(waveState.front, waveState.glow);

      // portal
      const portalLegPos = Math.max(0, (scrollProgress - 0.25) * 6);
      if (scrollProgress > 0.4) ensurePortal();
      if (portal) portal.tick(animDt, elapsed, portalLegPos, 0.3);
      if (portalFx) portalFx.tick(animDt, elapsed, camera);
      if (portalVortex) {
        portalVortex.tick(camera.position.y, animDt, scrollProgress);
      }

      // idle breathing + warp transitions
      const idle = Math.sin(elapsed * 0.7) * 0.012 + Math.sin(elapsed * 1.3) * 0.006;

      // warp 1: hero pullback — heavy distortion to hide sphere underside
      let warpTrans = 0;
      if (scrollProgress > 0.08 && scrollProgress < 0.19) {
        const warpIn  = clamp01((scrollProgress - 0.08) / 0.04);
        const warpOut = 1 - clamp01((scrollProgress - 0.14) / 0.05);
        warpTrans = warpIn * warpOut * 1.2;
      }

      // warp 2: last crystal → portal entry (hide scene transition)
      // ramps 0.36→0.42, holds, fades 0.44→0.50
      let warpPortal = 0;
      if (scrollProgress > 0.36 && scrollProgress < 0.50) {
        const wIn  = clamp01((scrollProgress - 0.36) / 0.06);
        const wOut = 1 - clamp01((scrollProgress - 0.44) / 0.06);
        warpPortal = wIn * wOut * 0.30;
      }

      postfx.setDistortion(Math.max(idle, warpTrans, warpPortal));

      // radial blur: strong during pullback transition, fades after
      let radialHero = Math.max(0, 1 - scrollProgress * 4) * 0.04;
      if (scrollProgress > 0.08 && scrollProgress < 0.19) {
        const rIn  = clamp01((scrollProgress - 0.08) / 0.04);
        const rOut = 1 - clamp01((scrollProgress - 0.14) / 0.05);
        radialHero = Math.max(radialHero, rIn * rOut * 0.2);
      }
      postfx.setRadialBlur(radialHero);

      postfx.render(elapsed);

      // ---- scroll progress bar ---------------------------------
      scrollProgressBar.style.height = (scrollProgress * 100).toFixed(1) + '%';

      // ---- ambient audio ---------------------------------------
      ambientAudio.tick(scrollProgress, dt, rig.currentSection);

      // ---- portal entry swell ----------------------------------
      if (scrollProgress > 0.44 && scrollProgress < 0.50 && !frame._portalPlayed) {
        ambientAudio.playPortalEntry();
        frame._portalPlayed = true;
      }
      if (scrollProgress < 0.40) frame._portalPlayed = false;

      // ---- ring passage thump ----------------------------------
      const RING_T = [0.53, 0.63, 0.73, 0.83];
      for (let i = 0; i < RING_T.length; i++) {
        const rd = Math.abs(scrollProgress - RING_T[i]);
        if (rd < 0.015 && !frame._ringPlayed?.[i]) {
          ambientAudio.playThump();
          if (!frame._ringPlayed) frame._ringPlayed = {};
          frame._ringPlayed[i] = true;
        }
        if (rd > 0.04 && frame._ringPlayed?.[i]) {
          delete frame._ringPlayed[i];
        }
      }

      // ---- dynamic LOD: reduce render resolution on low FPS -----
      lod.frames++;
      lod.avgDt += (dt - lod.avgDt) / Math.min(lod.frames, 60);
      if (lod.frames % 60 === 0) {
        const newLevel = lod.avgDt > 0.04 ? 1 : lod.avgDt > 0.06 ? 2 : 0;
        if (newLevel !== lod.level) {
          lod.level = newLevel;
          const scale = lod.level === 2 ? 0.5 : lod.level === 1 ? 0.75 : 1;
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1) * scale);
          resize();
          console.log(`[LOD] Level ${lod.level} (avg: ${(lod.avgDt * 1000).toFixed(1)}ms, px: ${scale})`);
        }
      }
    } catch (err) {
      console.error('[FRAME] error:', err);
    }
    requestAnimationFrame(frame);
  }
  frame();

  window.__DESERT__ = {
    renderer, scene, camera, assets, rig, field, hud,
    dataLayer, terrain, scaffold, interact, portal, postfx, resize,
  };

  // ---- boot sequence -------------------------------------------
  await runLoader(progress);
  scaffold.burst();

  // ---- site manager (Ctrl+Shift+S to open) --------------------
  createSiteManager();

  // intro shard animation (skip if reduced motion)
  if (REDUCED_MOTION) {
    waveState.active = false;
    shell.assemble();
    interact.enable();
    introDone = true;
  } else {
    runShardIntro(assets, terrain, () => {});

    const heroWire = assets.assets[0].wire;
    if (heroWire) heroWire.material.opacity = 0.9;
    waveState.front = SPHERE_TOP;
    waveState.glow = 0;
    waveState.active = true;
    introCam.t = 0;

    // wave animation (RAF)
    const introStart = performance.now();
    function introTick() {
      const e = (performance.now() - introStart) / 1000;
      const glowT = clamp01((e - 0.2) / 0.8);
      const frontT = clamp01((e - 0.5) / 4.4);
      const fadeT = clamp01((e - 4.0) / 1.2);
      const camT = clamp01((e - 0.8) / 5.0);

      waveState.glow = glowT < 1 ? glowT : (1 - fadeT);
      waveState.front = SPHERE_TOP * (1 - 2 * frontT);

      if (heroWire) {
        heroWire.material.opacity = 0.9 - 0.8 * easeInOutQuad(clamp01((e - 2.2) / 3.0));
      }

      introCam.t = easeInOutQuad(camT);

      if (camT < 1) {
        requestAnimationFrame(introTick);
      } else {
        waveState.active = false;
        shell.assemble();
        interact.enable();
        introDone = true;
      }
    }
    requestAnimationFrame(introTick);
  }
}

init();
