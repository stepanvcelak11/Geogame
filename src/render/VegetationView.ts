import * as THREE from 'three';
import type { TreeInstance } from '../world/World';

/** Stromy jako instancované meshe: 3 draw cally pro celý les. */
export function createVegetation(trees: readonly TreeInstance[], shadows: boolean): THREE.Group {
  const group = new THREE.Group();
  const conifers = trees.filter((t) => t.kind === 'conifer');
  const broadleaves = trees.filter((t) => t.kind === 'broadleaf');

  const trunkGeo = new THREE.CylinderGeometry(0.7, 1.1, 1, 7, 1).translate(0, 0.5, 0);
  const coneGeo = new THREE.ConeGeometry(1, 1, 9, 1).translate(0, 0.5, 0);
  const blobGeo = new THREE.IcosahedronGeometry(1, 1);
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });

  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x57432f }), trees.length);
  const cones = new THREE.InstancedMesh(coneGeo, white, Math.max(1, conifers.length * 3));
  // Listnáč = tři koule koruny + keř u paty u části stromů.
  const blobs = new THREE.InstancedMesh(blobGeo, white, Math.max(1, broadleaves.length * 4));

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const col = new THREE.Color();
  const yAxis = new THREE.Vector3(0, 1, 0);

  trees.forEach((t, i) => {
    const crownH = t.height - t.crownBase;
    const trunkTop = t.kind === 'conifer' ? t.crownBase + crownH * 0.55 : t.crownBase + crownH * 0.45;
    q.setFromAxisAngle(yAxis, t.tint * 6.28);
    m.compose(p.set(t.x, t.groundY - 0.3, t.z), q, s.set(t.trunkR, trunkTop + 0.3, t.trunkR));
    trunks.setMatrixAt(i, m);
  });

  conifers.forEach((t, i) => {
    const crownH = t.height - t.crownBase;
    q.setFromAxisAngle(yAxis, t.tint * 6.28);
    // Tři kužely nad sebou: zubatá silueta smrku.
    const tiers: [number, number, number][] = [
      [0, 1, 0.5],
      [0.3, 0.76, 0.45],
      [0.56, 0.5, 0.44],
    ];
    tiers.forEach(([base, r, hgt], j) => {
      m.compose(p.set(t.x, t.groundY + t.crownBase + crownH * base, t.z), q, s.set(t.crownR * r, crownH * hgt, t.crownR * r));
      cones.setMatrixAt(i * 3 + j, m);
      col.setHSL(0.31 + t.tint * 0.04, 0.42, 0.15 + t.tint * 0.06 + j * 0.02);
      cones.setColorAt(i * 3 + j, col);
    });
  });

  let nb = 0;
  broadleaves.forEach((t) => {
    const crownH = t.height - t.crownBase;
    const cy = t.groundY + t.crownBase + crownH * 0.5;
    const hue = 0.2 + t.tint * 0.08;
    const parts: [number, number, number, number][] = [
      [0, 0.1, 0, 1],
      [0.45, -0.05, 0.3, 0.72],
      [-0.4, 0.05, -0.35, 0.74],
    ];
    for (const [ox, oy, oz, k] of parts) {
      q.setFromAxisAngle(yAxis, t.tint * 6.28 + ox);
      m.compose(
        p.set(t.x + ox * t.crownR, cy + oy * crownH, t.z + oz * t.crownR),
        q,
        s.set(t.crownR * k, crownH * 0.52 * k, t.crownR * k),
      );
      blobs.setMatrixAt(nb, m);
      col.setHSL(hue, 0.45, 0.24 + t.tint * 0.08 + k * 0.03);
      blobs.setColorAt(nb++, col);
    }
    if (t.tint > 0.55) {
      const a = t.tint * 40;
      m.compose(p.set(t.x + Math.cos(a) * 2.2, t.groundY + 0.35, t.z + Math.sin(a) * 2.2), q, s.set(1.1, 0.8, 1.0));
      blobs.setMatrixAt(nb, m);
      col.setHSL(0.25, 0.4, 0.22);
      blobs.setColorAt(nb++, col);
    }
  });

  cones.count = conifers.length * 3;
  blobs.count = nb;

  for (const mesh of [trunks, cones, blobs]) {
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}
