import * as THREE from 'three';
import { baseTop, designTop, PAVING, type PaverSim } from '../jobs/Paving';
import { HIGHWAY } from '../world/WorldGen';
import type { Heightmap } from '../world/Heightmap';
import { lambert, matte } from './materials';
import { mergeStatic } from './mergeStatic';
import { canvasTexture } from './textures';

/** Poloha 360° hranolu na stožáru desky (vlevo, 3 m nad deskou). */
export function paverPrism(x: number): { x: number; y: number; z: number } {
  return { x: x + 0.3, y: designTop(x, -PAVING.halfWidth - 0.3) + 3.0, z: -PAVING.halfWidth - 0.3 };
}

const LAT = [-PAVING.halfWidth, -PAVING.halfWidth / 2, 0, PAVING.halfWidth / 2, PAVING.halfWidth];

/** Pás (ribbon) podél x s příčnými body `zs` a výškou z funkce. */
function strip(x0: number, x1: number, step: number, zs: readonly number[], y: (x: number, z: number) => number, uvScale = 6): THREE.BufferGeometry {
  const nx = Math.floor((x1 - x0) / step) + 1;
  const pos = new Float32Array(nx * zs.length * 3);
  const uv = new Float32Array(nx * zs.length * 2);
  const idx: number[] = [];
  for (let i = 0; i < nx; i++) {
    const x = x0 + i * step;
    zs.forEach((z, j) => {
      const k = i * zs.length + j;
      pos.set([x, y(x, z), z], k * 3);
      uv.set([x / uvScale, z / uvScale], k * 2);
    });
  }
  for (let i = 0; i + 1 < nx; i++)
    for (let j = 0; j + 1 < zs.length; j++) {
      const a = i * zs.length + j;
      const b = a + 1;
      const c = a + zs.length;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Stavba dálnice: podkladní vrstva, hotový protější pás se značením, finišer s deskou
 * a 360° hranolem na stožáru, válec a nová ložná vrstva, která roste za deskou.
 */
export class PavingView {
  readonly group = new THREE.Group();
  private readonly paver = new THREE.Group();
  private readonly roller = new THREE.Group();
  private readonly fresh: THREE.Mesh;
  private shown = 0;
  private readonly sprays: { x: number; z: number; m: THREE.Object3D }[] = [];

  constructor(hm: Heightmap) {
    const asphalt = canvasTexture('asphalt', 256);
    const baseMat = matte({ color: 0x8a8781, map: asphalt ?? undefined, polygonOffset: true, polygonOffsetFactor: -1 });
    const finMat = matte({ color: 0x3c3f42, map: asphalt ?? undefined, polygonOffset: true, polygonOffsetFactor: -1 });
    const paint = matte({ color: 0xe8e8e2, polygonOffset: true, polygonOffsetFactor: -2 });
    const H = HIGHWAY;
    // Podklad celého pásu.
    const base = new THREE.Mesh(strip(H.xMin, H.xMax, 2, [-H.paveHalf, ...LAT, H.paveHalf], (x, z) => baseTop(x, Math.max(-4.6, Math.min(4.6, z))) + 0.004), baseMat);
    // Hotový protější pás (obrusná vrstva) se značením.
    const farY = (x: number, z: number): number => hm.heightAt(x, z) + 0.012;
    const far = new THREE.Mesh(strip(H.xMin, H.xMax, 2, [H.farZ0, H.farZ0 + 3.75, H.farZ0 + 7.5, H.farZ1 - 0.5], farY), finMat);
    const marks = new THREE.Group();
    for (const z of [H.farZ0 + 0.35, H.farZ1 - 0.85]) marks.add(new THREE.Mesh(strip(H.xMin, H.xMax, 4, [z, z + 0.25], (x, zz) => farY(x, zz) + 0.004), paint));
    for (let x = H.xMin; x < H.xMax; x += 12) marks.add(new THREE.Mesh(strip(x, x + 6, 6, [H.farZ0 + 3.68, H.farZ0 + 3.83], (xx, zz) => farY(xx, zz) + 0.004), paint));
    for (const m of [base, far]) m.receiveShadow = true;
    this.group.add(base, far, mergeStatic(marks));

    // Nová ložná vrstva: pás po metru, výšky se doplňují podle pokládky.
    const geo = strip(PAVING.x0, PAVING.x1, 1, LAT, (x, z) => designTop(x, z));
    geo.setDrawRange(0, 0);
    this.fresh = new THREE.Mesh(geo, matte({ color: 0x1f2123, map: asphalt ?? undefined, polygonOffset: true, polygonOffsetFactor: -3 }));
    this.fresh.receiveShadow = true;
    this.fresh.frustumCulled = false;
    this.group.add(this.fresh);

    // Sprejové značky kontrolních profilů (objeví se na položeném asfaltu).
    const sprayMat = matte({ color: 0xf5f5f0, polygonOffset: true, polygonOffsetFactor: -4 });
    const cross = new THREE.PlaneGeometry(0.5, 0.06).rotateX(-Math.PI / 2);
    for (const x of PAVING.checkX)
      for (const z of PAVING.checkZ) {
        const g = new THREE.Group();
        const a = new THREE.Mesh(cross, sprayMat);
        a.rotation.y = Math.PI / 4;
        const b = new THREE.Mesh(cross, sprayMat);
        b.rotation.y = -Math.PI / 4;
        g.add(a, b);
        g.visible = false;
        this.group.add(g);
        this.sprays.push({ x, z, m: g });
      }
    this.buildPaver();
    this.buildRoller();
    this.group.add(this.paver, this.roller);
  }

  private buildPaver(): void {
    const yellow = lambert(0xf2b705, 'paverYellow');
    const dark = lambert(0x2b2e31, 'paverDark');
    const steel = lambert(0x8f969c, 'paverSteel');
    const tmp = new THREE.Group();
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number): void => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      b.castShadow = true;
      tmp.add(b);
    };
    // Deska (za finišerem, šíře pokládky), podvozek s pásy, motor, stříška, násypka vpředu.
    box(1.2, 0.45, PAVING.halfWidth * 2 + 0.3, yellow, 0.1, 0.35, 0);
    box(0.3, 0.9, PAVING.halfWidth * 2 + 0.4, dark, -0.45, 0.6, 0);
    box(3.6, 0.55, 0.55, dark, 2.6, 0.3, -1.2);
    box(3.6, 0.55, 0.55, dark, 2.6, 0.3, 1.2);
    box(3.2, 1.3, 2.6, yellow, 2.6, 1.2, 0);
    box(1.6, 0.9, 2.4, yellow, 1.6, 2.1, 0);
    box(1.9, 0.08, 3.0, dark, 1.4, 3.4, 0);
    for (const [x, z] of [[0.6, -1.3], [2.2, -1.3], [0.6, 1.3], [2.2, 1.3]]) box(0.08, 1.4, 0.08, dark, x, 2.7, z);
    box(1.6, 0.9, 3.4, yellow, 5.0, 0.9, 0);
    box(0.12, 0.8, 3.4, yellow, 5.8, 1.2, 0);
    // Šnek rozdělující směs před deskou.
    const auger = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, PAVING.halfWidth * 2, 10).rotateX(Math.PI / 2), steel);
    auger.position.set(0.9, 0.25, 0);
    tmp.add(auger);
    // Stožár s 360° hranolem na levém boku desky.
    const mz = -PAVING.halfWidth - 0.3;
    box(0.08, 3.0, 0.08, steel, 0.3, 1.5 + 0.35, mz);
    const prism = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 1), lambert(0xd9dde2, 'prism360'));
    prism.position.set(0.3, 3.0 + 0.35, mz);
    tmp.add(prism);
    box(0.25, 0.25, 0.25, lambert(0xf2b705, 'paverSensor'), 0.3, 0.6, mz);
    const merged = mergeStatic(tmp);
    merged.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).castShadow = true) : null));
    this.paver.add(merged);
  }

  private buildRoller(): void {
    const tmp = new THREE.Group();
    const yellow = lambert(0xf2b705, 'paverYellow');
    const steel = lambert(0x8f969c, 'paverSteel');
    for (const x of [-1.3, 1.3]) {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.0, 16).rotateX(Math.PI / 2), steel);
      drum.position.set(x, 0.6, 0);
      tmp.add(drum);
    }
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.6), yellow);
    body.position.set(0, 1.4, 0);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 1.4), lambert(0x2b2e31, 'paverDark'));
    cab.position.set(0, 2.4, 0);
    tmp.add(body, cab);
    this.roller.add(mergeStatic(tmp));
  }

  /** Poloha strojů a doplnění nově položeného asfaltu. */
  update(sim: PaverSim, t: number): void {
    const x = sim.x;
    this.paver.position.set(x, designTop(x, 0) - 0.02, 0);
    // Válec jezdí sem a tam 15–30 m za finišerem po položeném.
    const rx = Math.max(PAVING.x0 + 2, x - 22 + Math.sin(t * 0.25) * 7);
    this.roller.visible = sim.started;
    this.roller.position.set(rx, designTop(rx, 1.5), 1.5);
    for (const sp of this.sprays) {
      const top = sim.laidTop(sp.x, sp.z);
      sp.m.visible = top !== null && sp.x < sim.x - 8;
      if (top !== null) sp.m.position.set(sp.x, top + 0.006, sp.z);
    }
    const n = sim.laid.length;
    if (n === this.shown) return;
    const geo = this.fresh.geometry;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = this.shown; i < n; i++) {
      const lx = PAVING.x0 + i;
      LAT.forEach((z, j) => pos.setY(i * LAT.length + j, (sim.laidTop(lx, z) ?? designTop(lx, z)) + 0.003));
    }
    pos.needsUpdate = true;
    this.shown = n;
    geo.setDrawRange(0, Math.max(0, n - 1) * (LAT.length - 1) * 6);
  }
}
