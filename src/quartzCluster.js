/* ============================================================
   quartzCluster.js — the third shard: a quartz crystal cluster
   ------------------------------------------------------------
   Replaces the torus-knot placeholder with something that
   actually reads as "crystal quartz": several hexagonal spike
   points (six-sided pyramids, quartz's real crystal system)
   splayed outward from a shared base, like a geode cluster.

   Each spike is a plain THREE.ConeGeometry with 6 radial
   segments — a hexagonal pyramid is exactly a low-poly cone.
   Splaying: for spike i, its rest direction is radial-outward
   from the cluster's vertical axis; it's tilted to lean along
   that radial direction (not randomly), which is what makes a
   cone cluster read as "grown outward" instead of "scattered."
   ============================================================ */

import * as THREE from 'three';

const SPIKE_COUNT = 8;

export function createQuartzCluster(material) {
  const group = new THREE.Group();
  group.name = 'mass-core';

  const radial = new THREE.Vector3();
  const tangent = new THREE.Vector3();

  for (let i = 0; i < SPIKE_COUNT; i++) {
    const height = 1.0 + Math.random() * 1.5;
    const radius = 0.20 + Math.random() * 0.16;
    const geo = new THREE.ConeGeometry(radius, height, 6, 1);
    geo.translate(0, height / 2, 0);   // base sits at local origin, tip points +Y

    const spike = new THREE.Mesh(geo, material);

    // scatter the bases in a tight ring around the shared root
    const angle = (i / SPIKE_COUNT) * Math.PI * 2 + Math.random() * 0.5;
    radial.set(Math.cos(angle), 0, Math.sin(angle));
    const baseDist = Math.random() * 0.3;
    spike.position.copy(radial).multiplyScalar(baseDist);
    spike.position.y += -0.5 + Math.random() * 0.25;

    // splay outward: tilt around the tangential axis so the tip
    // leans away from the cluster's core, then spin freely around
    // its own length (hexagonal symmetry makes any twist look natural)
    tangent.set(-radial.z, 0, radial.x);
    const lean = 0.18 + Math.random() * 0.32;
    spike.quaternion.setFromAxisAngle(tangent, lean);
    spike.rotateY(Math.random() * Math.PI * 2);

    group.add(spike);
  }

  // one central taller spike anchors the silhouette so the
  // cluster still reads as one "mass" from a distance
  const anchorGeo = new THREE.ConeGeometry(0.26, 2.1, 6, 1);
  anchorGeo.translate(0, 2.1 / 2, 0);
  const anchor = new THREE.Mesh(anchorGeo, material);
  anchor.position.y = -0.55;
  group.add(anchor);

  return group;
}
