import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { matte } from './materials';
import type { TreeInstance } from '../world/World';

/**
 * Nepravidelný tvar koruny: vrcholy posunuté šumem po normále (hladké stínování)
 * a vertex barvy ztmavené dole a uvnitř – koruna si sama stíní (levné AO).
 */
function organic(geo: THREE.BufferGeometry, amp: number, seed: number): THREE.BufferGeometry {
  // Sloučit vrcholy (koule z three je bez indexu), jinak by normály zůstaly ploché.
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const g = mergeVertices(geo);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const box = new THREE.Box3().setFromBufferAttribute(pos);
  const n = (x: number, y: number, z: number): number =>
    Math.sin(x * 5.1 + seed) * Math.cos(z * 4.3 - seed) * 0.6 + Math.sin(y * 7.7 + x * 3.1 + seed * 2) * 0.4;
  const v = new THREE.Vector3();
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.hypot(v.x, v.z);
    const d = 1 + n(v.x, v.y, v.z) * amp;
    // Kužel: posun jen do stran (špička zůstane), koule: celý vektor.
    if (box.min.y >= -0.01) {
      v.x *= d;
      v.z *= d;
    } else v.multiplyScalar(d);
    pos.setXYZ(i, v.x, v.y, v.z);
    const t = (v.y - box.min.y) / Math.max(1e-6, box.max.y - box.min.y); // 0 dole … 1 nahoře
    const ao = 0.55 + 0.45 * Math.min(1, t * 1.3) * (0.8 + 0.2 * Math.min(1, r));
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = ao;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/** Stromy jako instancované meshe: 3 draw cally pro celý les. */
export function createVegetation(trees: readonly TreeInstance[], shadows: boolean): THREE.Group {
  const group = new THREE.Group();
  const conifers = trees.filter((t) => t.kind === 'conifer');
  const broadleaves = trees.filter((t) => t.kind === 'broadleaf');

  const trunkGeo = new THREE.CylinderGeometry(0.7, 1.1, 1, 9, 1).translate(0, 0.5, 0);
  const coneGeo = organic(new THREE.ConeGeometry(1, 1, 16, 3).translate(0, 0.5, 0), 0.09, 11);
  const blobGeo = organic(new THREE.IcosahedronGeometry(1, 3), 0.16, 5);
  const white = matte({ color: 0xffffff, vertexColors: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, matte({ color: 0x57432f }), trees.length);
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
