# DESERT PARALLAX — scroll-driven 3D desert experience

A golden-hour desert-themed scroll-driven 3D landing page: dot-matrix loader →
wireframe assemble intro → corner UI → sandstorm whiteout transitions between
beats → three faceted desert crystals with 3D-anchored HUD callouts over
drifting data-text → transitional descent → portal dive through 4 assembling
stone rings → sand-swarm particle logo reveal. Built with Three.js + GSAP + Vite.

## Quick start

```bash
npm install
npm run dev        # -> http://localhost:5175
```

`npm run build` produces a static bundle in `dist/`.

## File map

| File | Owns |
|---|---|
| `index.html` | Beat spacers + corner UI + loader + whiteout/HUD/data layers |
| `src/style.css` | Warm sand theme; structural rules marked `[REQUIRED]` |
| `src/scene.js` | Renderer, camera, desert golden-hour lights, procedural sky + env map, fog |
| `src/objects.js` | **Asset manifest** — desert crystals (GLBs), HUD metadata, inner models, wire twins |
| `src/terrain.js` | Procedural FBM sand dunes + dust (hero beat); exports `getHeight` |
| `src/scaffold.js` | Moving geometric construction lines: flowing-dash cages + runner streaks |
| `src/textures.js` | Procedural canvas textures: sand grain, desert stone, diamond refraction |
| `src/mountains.js` | Distant desert mountain silhouette (FBM-displaced ridge) |
| `src/heroShell.js` | Hero as ~80 spring-driven sandstone bricks + warm core glow |
| `src/heroInteract.js` | Cursor/touch raycast → drives the shell physics |
| `src/portal.js` | 4-ring dive tunnel: stone blocks MAGNET-assemble per ring, sequenced by scroll |
| `src/portalEffects.js` | Heat haze, depth vignette, bass thump (lazy AudioContext) |
| `src/cameraRig.js` | ScrollTrigger → camera spline + `getBeatInfo()` (whiteout drive) |
| `src/particles.js` | Footer sand-swarm (CPU physics): bursts into logo shape, cursor/touch pull, cage wireframe |
| `src/hud.js` | 3D-anchored callout labels, leader lines, live TEMP jitter |
| `src/dataLayer.js` | Blurred telemetry text drifting in the sand fog |
| `src/glitchText.js` | Hover-scramble text for `[data-glitch]` elements |
| `src/postfx.js` | Post-processing pipeline: warp distortion + film grain vignette |
| `src/main.js` | Orchestrator: real-progress loader → wireframe intro → rAF loop → lazy portal load |
| `public/models/*.glb` | Blender assets: 3 desert crystals, 3 inner objects, portal ring |

## The journey (scroll beats)

| Beat | Scene |
|---|---|
| 0 | Hero — sandstone fractured shell on sand dune terrain |
| 1 | Crystal 01 — "MONOLITH" (faceted shard with inner rock) |
| 2 | Crystal 02 — "DRIFTWORKS" (second crystal) |
| 3 | Crystal 03 — "SUNSTONE" (third crystal, deepest) |
| 4 | Transition descent — camera pulls back, drops into portal |
| 5-8 | Portal dive — 4 stone rings, assembling from scattered blocks |
| 9 | Footer — sand-swarm logo reveal with social links |

## Key design decisions

- **Warm palette**: sand-amber tones (`#c4a87c`), golden-hour lighting, bronze
  fog. Everything tuned for desert atmosphere rather than arctic ice.
- **Diamond crystals**: `MeshPhysicalMaterial` with high transmission (0.95),
  IOR 2.42 (real diamond), warm attenuation tint, and clearcoat.
- **Procedural textures**: Zero external image files — sand grain, stone, and
  diamond refraction patterns are all canvas-generated at init.
- **Lazy portal load**: The portal GLB (~700 KB) loads asynchronously when the
  user scrolls past the hero beat, so page load is instant.
- **Real loader progress**: The dot-matrix bar tracks actual GLB download
  progress with a minimum floor, so it never stalls visually.
- **Touch support**: Camera parallax, hero interaction, and particle cursor
  pull all respond to touch events for mobile browsing.
- **Lazy AudioContext**: Bass thump audio context is created on first user
  gesture, respecting browser autoplay policies.

## Adding a scroll beat

1. Add a `<section class="beat">` in `index.html`.
2. Add one waypoint to each spline in `cameraRig.js`.
3. (Optional) add an asset at that depth in `objects.js`'s manifest.

The scroll length is `sections × 100vh`, everything stays in sync.

## Tuning cheat-sheet

| Feel | Dial |
|---|---|
| Sand fog density | `FogExp2` density in `scene.js` (0.03–0.06) |
| Scroll weight | `scrub` value in `cameraRig.js` (higher = heavier) |
| Journey shape | `POSITION_WAYPOINTS` / `LOOKAT_WAYPOINTS` splines |
| Diamond clarity | `roughness` / `thickness` / `transmission` in `createDiamondMaterial()` |
| Diamond tint | `attenuationColor` + `attenuationDistance` in `objects.js` |
| Particle punch | repulsion radius/strength in `particles.js` |
| Portal assembly speed | lerp factor in `portal.js` `R.form += (target - R.form) * dt * 8` |
| Warp distortion | `postfx.setDistortion()` intensity curve in `main.js` |

## Swapping models

1. Export as `.glb` → drop in `public/models/`.
2. In `src/objects.js`, add or update `ASSET_MANIFEST` entry with `url:`.
3. For inner trapped objects, add `innerUrl:` — the loader auto-scales to 40%
   of the crystal's bounding box.
4. Run `scripts/inspect_assets.py` (Blender headless) to measure bounding
   boxes for `logoFit` positioning if using trapped logos.

## Debugging

- `window.__DESERT__` exposes renderer/scene/camera/rig/assets in DevTools.
- Uncomment `markers: true` in `cameraRig.js` while authoring waypoints.
