import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { matte } from './materials';
import { withCloudShadows } from './TerrainView';
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

/** Sdílený čas a síla větru pro všechny koruny (vertex shader). */
const wind = { uTime: { value: 0 }, uWind: { value: 0.3 } };

/**
 * Pohyb ve větru: posun roste s výškou (lokální y od `base`), fáze podle polohy instance.
 * Koruny i trávu to stojí jen pár instrukcí ve vertex shaderu.
 */
export function swaying(mat: THREE.Material, amp = 0.07, base = 0.6, key = 'sway'): THREE.Material {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = wind.uTime;
    shader.uniforms.uWind = wind.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 wp = instanceMatrix[3].xz;
          float ph = dot(wp, vec2(0.31, 0.17));
          float k = clamp(transformed.y + ${base.toFixed(2)}, 0.0, 1.6);
          float sw = (sin(uTime * 1.4 + ph) * 0.6 + sin(uTime * 2.3 + ph * 1.7) * 0.4) * uWind * ${amp.toFixed(3)} * k;
          transformed.x += sw;
          transformed.z += sw * 0.6;
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

interface Parts {
  trunk: THREE.BufferGeometry;
  cone: THREE.BufferGeometry;
  blob: THREE.BufferGeometry;
}

/** Blízko detailní geometrie, daleko hrubá (koule 80 místo 320 trojúhelníků). */
let partsCache: { near: Parts; far: Parts } | null = null;
function parts(): { near: Parts; far: Parts } {
  if (partsCache) return partsCache;
  partsCache = {
    near: {
      trunk: new THREE.CylinderGeometry(0.7, 1.1, 1, 7, 1).translate(0, 0.5, 0),
      cone: organic(new THREE.ConeGeometry(1, 1, 12, 2).translate(0, 0.5, 0), 0.09, 11),
      blob: organic(new THREE.IcosahedronGeometry(1, 2), 0.16, 5),
    },
    far: {
      trunk: new THREE.CylinderGeometry(0.7, 1.1, 1, 4, 1).translate(0, 0.5, 0),
      cone: organic(new THREE.ConeGeometry(1, 1, 7, 1).translate(0, 0.5, 0), 0.06, 11),
      blob: organic(new THREE.IcosahedronGeometry(1, 1), 0.12, 5),
    },
  };
  return partsCache;
}

const CHUNK = 96; // strana dlaždice vzdáleného lesa [m]
const NEAR_R = 46; // detailní stromy (a stíny) jen v tomto okruhu kolem kamery [m]
const REBUILD_MOVE = 4; // po kolika metrech chůze přeskládat blízké stromy
const FAR_SHRINK = 0.95; // hrubá verze je o chlup menší, ať se schová v detailní

/** Předpočítané matice a barvy jednoho stromu (kmen, části koruny). */
interface TreeParts {
  x: number;
  z: number;
  trunk: THREE.Matrix4;
  cones: { m: THREE.Matrix4; c: THREE.Color }[];
  blobs: { m: THREE.Matrix4; c: THREE.Color }[];
  far: { m: THREE.Matrix4; c: THREE.Color; cone: boolean }; // z dálky jediný tvar koruny
}

function treeParts(t: TreeInstance): TreeParts {
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const crownH = t.height - t.crownBase;
  const trunkTop = t.kind === 'conifer' ? t.crownBase + crownH * 0.55 : t.crownBase + crownH * 0.45;
  q.setFromAxisAngle(yAxis, t.tint * 6.28);
  const trunk = new THREE.Matrix4().compose(p.set(t.x, t.groundY - 0.3, t.z), q, s.set(t.trunkR, trunkTop + 0.3, t.trunkR));
  const cones: TreeParts['cones'] = [];
  const blobs: TreeParts['blobs'] = [];
  if (t.kind === 'conifer') {
    // Tři kužely nad sebou: zubatá silueta smrku.
    const tiers: [number, number, number][] = [
      [0, 1, 0.5],
      [0.3, 0.76, 0.45],
      [0.56, 0.5, 0.44],
    ];
    tiers.forEach(([base, r, hgt], j) => {
      const m = new THREE.Matrix4().compose(p.set(t.x, t.groundY + t.crownBase + crownH * base, t.z), q, s.set(t.crownR * r, crownH * hgt, t.crownR * r));
      cones.push({ m, c: new THREE.Color().setHSL(0.31 + t.tint * 0.04, 0.42, 0.15 + t.tint * 0.06 + j * 0.02) });
    });
  } else {
    const cy = t.groundY + t.crownBase + crownH * 0.5;
    const hue = 0.2 + t.tint * 0.08;
    const parts: [number, number, number, number][] = [
      [0, 0.1, 0, 1],
      [0.45, -0.05, 0.3, 0.72],
      [-0.4, 0.05, -0.35, 0.74],
    ];
    for (const [ox, oy, oz, k] of parts) {
      q.setFromAxisAngle(yAxis, t.tint * 6.28 + ox);
      const m = new THREE.Matrix4().compose(p.set(t.x + ox * t.crownR, cy + oy * crownH, t.z + oz * t.crownR), q, s.set(t.crownR * k, crownH * 0.52 * k, t.crownR * k));
      blobs.push({ m, c: new THREE.Color().setHSL(hue, 0.45, 0.24 + t.tint * 0.08 + k * 0.03) });
    }
    if (t.tint > 0.55) {
      // Keř u paty.
      const a = t.tint * 40;
      const m = new THREE.Matrix4().compose(p.set(t.x + Math.cos(a) * 2.2, t.groundY + 0.35, t.z + Math.sin(a) * 2.2), q, s.set(1.1, 0.8, 1.0));
      blobs.push({ m, c: new THREE.Color().setHSL(0.25, 0.4, 0.22) });
    }
  }
  // Z dálky: smrk jako jeden štíhlý kužel, listnáč jako jedna koruna (o chlup menší, ať se schová v detailní).
  q.setFromAxisAngle(yAxis, t.tint * 6.28);
  const far =
    t.kind === 'conifer'
      ? { m: new THREE.Matrix4().compose(p.set(t.x, t.groundY + t.crownBase, t.z), q, s.set(t.crownR * 1.05 * FAR_SHRINK, crownH * 0.97, t.crownR * 1.05 * FAR_SHRINK)), c: cones[1].c, cone: true }
      : {
          m: new THREE.Matrix4().compose(p.set(t.x, t.groundY + t.crownBase + crownH * 0.5, t.z), q, s.set(t.crownR * 1.12 * FAR_SHRINK, crownH * 0.55 * FAR_SHRINK, t.crownR * 1.12 * FAR_SHRINK)),
          c: blobs[0].c,
          cone: false,
        };
  return { x: t.x, z: t.z, trunk, cones, blobs, far };
}

/**
 * Stromy: celý les hrubě po dlaždicích (kreslí se jen dlaždice v záběru a v dohledu),
 * v okruhu kolem hráče navíc detailní stromy se stíny, které se přeskládají, když hráč
 * ujde pár metrů. Koruny se hýbou ve větru a přes les plují stíny mraků.
 */
export class Vegetation {
  readonly group = new THREE.Group();
  private readonly chunks: { cx: number; cz: number; g: THREE.Group }[] = [];
  private readonly trees: TreeParts[];
  private readonly near: { trunks: THREE.InstancedMesh; cones: THREE.InstancedMesh; blobs: THREE.InstancedMesh };
  private t = 0;
  private lodTimer = 0;
  private lastX = Infinity;
  private lastZ = Infinity;

  constructor(trees: readonly TreeInstance[], shadows: boolean) {
    const trunkMat = withCloudShadows(matte({ color: 0x57432f }));
    const crownMat = withCloudShadows(swaying(matte({ color: 0xffffff, vertexColors: true })));
    this.trees = trees.map(treeParts);
    const P = parts();
    // Vzdálený les po dlaždicích.
    const byChunk = new Map<string, TreeParts[]>();
    for (const t of this.trees) {
      const k = `${Math.floor(t.x / CHUNK)},${Math.floor(t.z / CHUNK)}`;
      const list = byChunk.get(k);
      if (list) list.push(t);
      else byChunk.set(k, [t]);
    }
    for (const [k, list] of byChunk) {
      const [ix, iz] = k.split(',').map(Number);
      const g = new THREE.Group();
      const nc = list.filter((t) => t.far.cone).length;
      const nb = list.length - nc;
      const cones = new THREE.InstancedMesh(P.far.cone, crownMat, Math.max(1, nc));
      const blobs = new THREE.InstancedMesh(P.far.blob, crownMat, Math.max(1, nb));
      let ic = 0;
      let ib = 0;
      for (const t of list) {
        const mesh = t.far.cone ? cones : blobs;
        const i = t.far.cone ? ic++ : ib++;
        mesh.setMatrixAt(i, t.far.m);
        mesh.setColorAt(i, t.far.c);
      }
      cones.count = ic;
      blobs.count = ib;
      for (const mesh of [cones, blobs]) {
        if (!mesh.count) continue;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.matrixAutoUpdate = false;
        g.add(mesh);
      }
      this.group.add(g);
      this.chunks.push({ cx: (ix + 0.5) * CHUNK, cz: (iz + 0.5) * CHUNK, g });
    }
    // Blízké detailní stromy – kapacita podle nejhustšího okruhu.
    const cap = Math.min(this.trees.length, 1200);
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number): THREE.InstancedMesh => {
      const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
      m.count = 0;
      m.castShadow = shadows;
      m.receiveShadow = shadows;
      m.frustumCulled = false; // okruh je kolem kamery, vždy aspoň zčásti v záběru
      m.matrixAutoUpdate = false;
      this.group.add(m);
      return m;
    };
    this.near = { trunks: mk(P.near.trunk, trunkMat, cap), cones: mk(P.near.cone, crownMat, cap * 3), blobs: mk(P.near.blob, crownMat, cap * 4) };
  }

  /** Přeskládá detailní stromy kolem hráče. */
  private rebuildNear(x: number, z: number): void {
    const { trunks, cones, blobs } = this.near;
    let it = 0;
    let ic = 0;
    let ib = 0;
    const r2 = NEAR_R * NEAR_R;
    for (const t of this.trees) {
      if ((t.x - x) ** 2 + (t.z - z) ** 2 > r2) continue;
      if (it >= trunks.instanceMatrix.count) break;
      trunks.setMatrixAt(it++, t.trunk);
      for (const c of t.cones) if (ic < cones.instanceMatrix.count) (cones.setMatrixAt(ic, c.m), cones.setColorAt(ic++, c.c));
      for (const b of t.blobs) if (ib < blobs.instanceMatrix.count) (blobs.setMatrixAt(ib, b.m), blobs.setColorAt(ib++, b.c));
    }
    trunks.count = it;
    cones.count = ic;
    blobs.count = ib;
    for (const m of [trunks, cones, blobs]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  /** Volba detailu podle polohy (jednou za chvíli) a čas větru. */
  update(dt: number, eye: { x: number; z: number }, drawDistance: number, windStrength: number): void {
    this.t += dt;
    wind.uTime.value = this.t;
    wind.uWind.value = 0.25 + windStrength * 1.4;
    if (Math.hypot(eye.x - this.lastX, eye.z - this.lastZ) > REBUILD_MOVE) {
      this.lastX = eye.x;
      this.lastZ = eye.z;
      this.rebuildNear(eye.x, eye.z);
    }
    this.lodTimer -= dt;
    if (this.lodTimer > 0) return;
    this.lodTimer = 0.3;
    const half = CHUNK / 2;
    for (const c of this.chunks) {
      const d = Math.hypot(Math.max(0, Math.abs(eye.x - c.cx) - half), Math.max(0, Math.abs(eye.z - c.cz) - half));
      c.g.visible = d < drawDistance + 20;
    }
  }
}
