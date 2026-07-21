/* ============================================================
   objects.js — crystal assets + GLTF swap point
   ------------------------------------------------------------
   Desert variant: diamond crystals with inner objects.

   THE MANIFEST is the single source of truth for what exists in
   the world and where.
   ============================================================ */

import * as THREE from 'three';
import { createHeroShell } from './heroShell.js';
import { makeSandMaps, makeDiamondMaps } from './textures.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ---- diamond material ----------------------------------------
   MeshPhysicalMaterial tuned for "clear diamond" — highly
   refractive with strong chromatic dispersion. */
export function createDiamondMaterial(overrides = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xf5e6d0,
    metalness: 0,
    roughness: 0.05,           // very smooth, clear glass
    transmission: 0.98,        // nearly full transparency
    thickness: 1.0,            // thinner for less distortion
    attenuationColor: new THREE.Color(0xf8ece0), // very faint warm tint
    attenuationDistance: 5.0,
    ior: 2.0,                  // slightly lower for clarity
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    envMapIntensity: 2.0,
    specularIntensity: 1.5,
    specularColor: new THREE.Color(0xffffff),
    sheen: 0.2,
    sheenRoughness: 0.15,
    sheenColor: new THREE.Color(0xfff8f0),
    transparent: true,
    ...overrides,
  });
}

/* ---- THE MANIFEST ------------------------------------------- */
const ASSET_MANIFEST = [
  {
    name: 'mass-hero',
    url: null,
    build: () => createHeroShell(),
    wireGeometry: () => new THREE.IcosahedronGeometry(2.4, 1),
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0.2, 0.4, 0),
    scale: 1,
    spin: 0,
    hud: null,
  },
  {
    name: 'mass-structure',
    url: '/models/crystal-1.glb',
    innerUrl: '/models/inner-crystal-1.glb',
    position: new THREE.Vector3(-0.9, -14, 0),
    rotation: new THREE.Euler(0.1, 0.2, 0.4),
    scale: 0.15,
    spin: 0,
    hud: {
      id: 'PORTFOLIO',
      title: 'BRANDING',
      temp: 21.68,
      date: 'EXPLORE',
    },
    logo: null,
    logoFit: null,
  },
  {
    name: 'mass-core',
    url: '/models/crystal-2.glb',
    innerUrl: '/models/inner-crystal-2.glb',
    position: new THREE.Vector3(1.1, -30, 0),
    rotation: new THREE.Euler(0.3, 0, 0),
    scale: 0.16,
    spin: 0,
    hud: {
      id: 'STUDIO',
      title: '3D VIZ',
      temp: 18.42,
      date: 'VIEW',
    },
    logo: null,
    logoFit: null,
  },
];

/* ---- trapped-logo texture ------------------------------------ */
function makeLogoTexture(monogram) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#3a2a1a';
  x.beginPath();
  x.roundRect(48, 48, 416, 416, 64);
  x.fill();
  x.strokeStyle = 'rgba(255,230,180,0.35)';
  x.lineWidth = 6;
  x.beginPath();
  x.roundRect(72, 72, 368, 368, 48);
  x.stroke();
  x.fillStyle = '#f8eed8';
  x.font = '900 190px Arial Black, Arial, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(monogram, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ---- loader -------------------------------------------------- */
export async function loadAssets(scene, progress = null) {
  const group = new THREE.Group();
  group.name = 'assets';
  scene.add(group);

  const sandMaps = makeSandMaps();
  const diamondMaps = makeDiamondMaps();
  const diamondMaterial = createDiamondMaterial({
    map: diamondMaps.map, bumpMap: diamondMaps.bump, bumpScale: 0.01,
  });
  const gltfLoader = new GLTFLoader();

  const assets = [];
  const total = ASSET_MANIFEST.length;
  let loaded = 0;

  for (const def of ASSET_MANIFEST) {
    let object;

    // Clear diamond for shards with trapped logos
    const clearDiamond = def.logo
      ? createDiamondMaterial({
          transmission: 0.99,
          roughness: 0.02,
          thickness: 0.8,
          ior: 1.8,
          map: diamondMaps.map, bumpMap: diamondMaps.bump, bumpScale: 0.005,
        })
      : null;

    let wireParent;

    if (def.build) {
      object = def.build({ iceMaterial: diamondMaterial, clearMat: clearDiamond });
      wireParent = object;
    } else if (def.url) {
      const gltf = await gltfLoader.loadAsync(def.url);
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          child.material = clearDiamond || diamondMaterial;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      gltf.scene.position.sub(center);
      object = new THREE.Group();
      object.add(gltf.scene);
      wireParent = gltf.scene;

      // Load inner object if specified
      if (def.innerUrl) {
        // Compute crystal max before try so it's available in catch
        const crystalBox = new THREE.Box3().setFromObject(gltf.scene);
        const crystalSize = crystalBox.getSize(new THREE.Vector3());
        const crystalMax = Math.max(crystalSize.x, crystalSize.y, crystalSize.z);

        try {
          const innerGltf = await gltfLoader.loadAsync(def.innerUrl);

          // Get inner object size
          const innerBox = new THREE.Box3().setFromObject(innerGltf.scene);
          const innerSize = innerBox.getSize(new THREE.Vector3());
          const innerMax = Math.max(innerSize.x, innerSize.y, innerSize.z);
          const innerCenter = innerBox.getCenter(new THREE.Vector3());

          // Scale inner to 40% of crystal size, centered at origin
          const s = (crystalMax * 0.4) / innerMax;
          innerGltf.scene.scale.setScalar(s);
          innerGltf.scene.position.set(
            -innerCenter.x * s,
            -innerCenter.y * s,
            -innerCenter.z * s
          );

          // Solid white material — opaque, visible through the crystal
          innerGltf.scene.traverse((child) => {
            if (child.isMesh) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                roughness: 0.3,
                metalness: 0.0,
                emissive: 0xffffff,
                emissiveIntensity: 0.3,
                map: sandMaps.map,
                bumpMap: sandMaps.bump,
                bumpScale: 0.02,
              });
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          // Reset inner root rotation so it aligns with parent crystal spin
          innerGltf.scene.rotation.set(0, 0, 0);
          object.add(innerGltf.scene);
        } catch (e) {
          console.warn('Inner model load failed:', def.innerUrl, e);
          // Fallback: create a visible placeholder gem
          const fallback = new THREE.Mesh(
            new THREE.OctahedronGeometry(crystalMax * 0.25),
            new THREE.MeshStandardMaterial({
              color: 0xffffff, roughness: 0.3, metalness: 0.0,
              emissive: 0xffffff, emissiveIntensity: 0.3,
              transparent: true, opacity: 0.8,
            })
          );
          object.add(fallback);
        }
      }
    } else {
      object = new THREE.Mesh(def.geometry(), clearDiamond || diamondMaterial);
      wireParent = object;
    }

    /* ---- mesh-in-mesh: the trapped logo --------------------- */
    if (def.logo) {
      const fit = def.logoFit ?? { size: def.logo.size ?? 1.2, position: [0, 0, 0], rotationY: 0.3 };
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(fit.size, fit.size),
        new THREE.MeshBasicMaterial({
          map: makeLogoTexture(def.logo.monogram),
          side: THREE.DoubleSide,
          toneMapped: false,
        })
      );
      tile.name = `${def.name}-logo`;
      tile.position.set(...fit.position);
      tile.rotation.y = fit.rotationY;
      object.add(tile);
    }

    object.name = def.name;
    object.position.copy(def.position);
    object.rotation.copy(def.rotation);
    object.scale.setScalar(def.scale);
    group.add(object);

    /* ---- wireframe overlay ----------------------------------- */
    let wire = null;
    const edgeGeo = def.wireGeometry
      ? new THREE.EdgesGeometry(def.wireGeometry(), 12)
      : (() => {
          let m = null;
          object.traverse((c) => { if (!m && c.isMesh) m = c; });
          return m ? new THREE.EdgesGeometry(m.geometry, 12) : null;
        })();
    if (edgeGeo) {
      wire = new THREE.LineSegments(
        edgeGeo,
        new THREE.LineBasicMaterial({ color: 0xd0e8f4, transparent: true, opacity: 0.9 })
      );
      wire.name = `${def.name}-wire`;
      wireParent.add(wire);
    }

    assets.push({ def, object, wire });
    loaded++;
    if (progress) progress.value = loaded / total;
  }

  // Ensure we hit 100% — some assets may have built synchronously
  if (progress) progress.value = 1.0;

  function tick(dt, elapsed) {
    for (const { def, object } of assets) {
      object.rotation.y += def.spin * dt;
      object.position.y =
        def.position.y + Math.sin(elapsed * 0.4 + def.position.x) * 0.15;
    }
  }

  return { group, assets, tick };
}
