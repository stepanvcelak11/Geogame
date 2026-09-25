import * as THREE from 'three';
import { clamp, smoothstep } from '../core/math';
import type { Heightmap } from '../world/Heightmap';
import type { FieldInfo, WaterInfo } from '../world/World';
import { inPolygon } from '../world/WorldGen';
import { canvasTexture } from './textures';

type RGB = [number, number, number];
const C = (hex: number): RGB => {
  // sRGB hex → lineární barva (jako THREE.Color s ColorManagement)
  const f = (v: number): number => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return [f((hex >> 16) & 255), f((hex >> 8) & 255), f(hex & 255)];
};
const PAL = {
  lush: C(0x4d7a2a),
  fresh: C(0x6f9636),
  deep: C(0x3b6424),
  dry: C(0x98934e),
  clover: C(0x5f8f3a),
  dirt: C(0x7d6a4c),
  rock: C(0x85817a),
  site: C(0x8f7f63),
  gravel: C(0x9c968a),
  mud: C(0x5b4d36),
  wheat: C(0xcdb25c),
  plowed: C(0x6e5337),
  rapeseed: C(0xd8cc2e),
};
const lerpTo = (o: RGB, t: RGB, a: number): void => {
  o[0] += (t[0] - o[0]) * a;
  o[1] += (t[1] - o[1]) * a;
  o[2] += (t[2] - o[2]) * a;
};
const scale = (o: RGB, k: number): void => {
  o[0] *= k;
  o[1] *= k;
  o[2] *= k;
};

/** Hodnotový šum pro barevné skvrny (nezávislý na logice). */
function vnoise(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const h = (i: number, j: number): number => {
    let n = Math.imul(i * 374761393 + j * 668265263, 1274126177);
    n ^= n >>> 13;
    return ((Math.imul(n, 1103515245) >>> 0) % 10000) / 10000;
  };
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  return (h(xi, zi) * (1 - u) + h(xi + 1, zi) * u) * (1 - v) + (h(xi, zi + 1) * (1 - u) + h(xi + 1, zi + 1) * u) * v;
}
const fbm = (x: number, z: number): number => vnoise(x, z) * 0.6 + vnoise(x * 2.3 + 17, z * 2.3 - 9) * 0.3 + vnoise(x * 5.1 - 3, z * 5.1 + 7) * 0.1;

export interface Occluder {
  x: number;
  z: number;
  r: number;
  k: number; // síla ztmavení 0…1
}

export interface TerrainPaint {
  occluders?: readonly Occluder[]; // stromy a stavby: zapečený stín / zastínění
  flatRadius: number;
  gravelYard: boolean; // kancelář: štěrkový dvůr místo hlíny
  fields: readonly FieldInfo[];
  water: readonly WaterInfo[];
}

/** Barva terénu v bodě (lineární RGB) – čistá funkce, dá se vykreslit i bez WebGL. */
export function terrainColor(x: number, z: number, h: number, slope: number, paint: TerrainPaint): RGB {
  // Tráva: velké skvrny sytá / světlá / tmavá, drobné skvrny jetele, suchá místa na vršcích.
  const c: RGB = [...PAL.lush];
  const m1 = fbm(x / 60, z / 60);
  const m2 = fbm(x / 17 + 40, z / 17 - 12);
  lerpTo(c, PAL.fresh, smoothstep(0.35, 0.75, m1));
  lerpTo(c, PAL.deep, smoothstep(0.55, 0.85, m2) * 0.6);
  lerpTo(c, PAL.clover, smoothstep(0.7, 0.9, fbm(x / 6, z / 6)) * 0.5);
  lerpTo(c, PAL.dry, clamp((h - 10) / 25, 0, 0.5) * smoothstep(0.3, 0.7, fbm(x / 35 - 5, z / 35)));
  // Svahy: hlína, na strmých kámen.
  lerpTo(c, PAL.dirt, smoothstep(0.38, 0.6, slope));
  lerpTo(c, PAL.rock, smoothstep(0.62, 0.85, slope) * 0.8);
  // Pole.
  for (const f of paint.fields) {
    if (!inPolygon(x, z, f.corners)) continue;
    const base = f.crop === 'wheat' ? PAL.wheat : f.crop === 'plowed' ? PAL.plowed : f.crop === 'rapeseed' ? PAL.rapeseed : PAL.fresh;
    c[0] = base[0];
    c[1] = base[1];
    c[2] = base[2];
    scale(c, 0.9 + 0.2 * fbm(x / 8, z / 8));
    if (f.crop === 'plowed') scale(c, 0.85 + 0.3 * (0.5 + 0.5 * Math.sin(z * 2.2)));
  }
  // Srovnaná plocha: staveniště (hlína) nebo dvůr (štěrk).
  if (paint.flatRadius > 0) {
    const w = (1 - smoothstep(paint.flatRadius * 0.72, paint.flatRadius * 0.98, Math.hypot(x, z))) * 0.9;
    const base: RGB = [...(paint.gravelYard ? PAL.gravel : PAL.site)];
    scale(base, 0.88 + 0.24 * fbm(x / 9, z / 9));
    lerpTo(c, base, w);
  }
  // Břeh rybníka: bahno u hladiny.
  for (const wtr of paint.water) {
    const d = ((x - wtr.x) / wtr.rx) ** 2 + ((z - wtr.z) / wtr.rz) ** 2;
    if (d < 1.8 && h < wtr.level + 0.5) lerpTo(c, PAL.mud, clamp((wtr.level + 0.5 - h) / 0.5, 0, 1));
  }
  return c;
}

/** Mesh terénu ze stejné mříže a triangulace jako logika (Heightmap.heightAt), s detailní texturou. */
export function createTerrainMesh(hm: Heightmap, paint: TerrainPaint): THREE.Mesh {
  const n = hm.n;
  // Mřížka zastiňujících objektů (buňky 8 m) – rychlé dotazy pro každý vrchol.
  const CELL = 8;
  const grid = new Map<number, Occluder[]>();
  const key = (i: number, j: number): number => (i + 1024) * 4096 + (j + 1024);
  for (const o of paint.occluders ?? []) {
    const i0 = Math.floor((o.x - o.r) / CELL);
    const i1 = Math.floor((o.x + o.r) / CELL);
    const j0 = Math.floor((o.z - o.r) / CELL);
    const j1 = Math.floor((o.z + o.r) / CELL);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const k = key(i, j);
        const list = grid.get(k);
        if (list) list.push(o);
        else grid.set(k, [o]);
      }
  }
  const shadowAt = (x: number, z: number): number => {
    let f = 1;
    for (const o of grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? []) {
      const d = Math.hypot(x - o.x, z - o.z);
      if (d < o.r) f *= 1 - o.k * (1 - smoothstep(o.r * 0.35, o.r, d));
    }
    return f;
  };
  const pos = new Float32Array(n * n * 3);
  const col = new Float32Array(n * n * 3);
  const uv = new Float32Array(n * n * 2);

  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const i = iz * n + ix;
      const x = hm.vertexCoord(ix);
      const z = hm.vertexCoord(iz);
      const h = hm.vertexHeight(ix, iz);
      pos[i * 3] = x;
      pos[i * 3 + 1] = h;
      pos[i * 3 + 2] = z;
      uv[i * 2] = x / 5;
      uv[i * 2 + 1] = z / 5;

      const hL = hm.vertexHeight(Math.max(ix - 1, 0), iz);
      const hR = hm.vertexHeight(Math.min(ix + 1, n - 1), iz);
      const hU = hm.vertexHeight(ix, Math.max(iz - 1, 0));
      const hD = hm.vertexHeight(ix, Math.min(iz + 1, n - 1));
      const slope = Math.atan(Math.hypot(hR - hL, hD - hU) / (2 * hm.cell));

      const c = terrainColor(x, z, h, slope, paint);
      const sh = shadowAt(x, z);
      c[0] *= sh;
      c[1] *= sh;
      c[2] *= sh;
      // Detailní textura má průměr ~0,85 – vyrovnat.
      col[i * 3] = Math.min(1, c[0] * 1.15);
      col[i * 3 + 1] = Math.min(1, c[1] * 1.15);
      col[i * 3 + 2] = Math.min(1, c[2] * 1.15);
    }
  }

  const idx = new Uint32Array((n - 1) * (n - 1) * 6);
  let k = 0;
  for (let iz = 0; iz < n - 1; iz++) {
    for (let ix = 0; ix < n - 1; ix++) {
      const a = iz * n + ix;
      const b = a + 1;
      const cc = a + n;
      const d = cc + 1;
      idx[k++] = a;
      idx[k++] = d;
      idx[k++] = b;
      idx[k++] = a;
      idx[k++] = cc;
      idx[k++] = d;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const map = canvasTexture('grass', 256);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true, map: map ?? undefined, bumpMap: map ?? undefined, bumpScale: 1.2 }),
  );
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

/** Hladina rybníka a rákosí kolem. */
export function createWater(water: readonly WaterInfo[]): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color: 0x3f6e84, specular: 0xb8c8d6, shininess: 80, transparent: true, opacity: 0.88, emissive: 0x0b1d28 });
  const reedGeo = new THREE.ConeGeometry(0.03, 1.4, 4).translate(0, 0.7, 0);
  const reedMat = new THREE.MeshLambertMaterial({ color: 0x7a8a3c });
  for (const w of water) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), mat);
    disc.scale.set(w.rx * 1.08, 1, w.rz * 1.08);
    disc.position.set(w.x, w.level, w.z);
    g.add(disc);
    const reeds = new THREE.InstancedMesh(reedGeo, reedMat, 160);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 160; i++) {
      const a = (i / 160) * Math.PI * 2 + Math.sin(i * 7.3) * 0.05;
      const r = 1.0 + Math.sin(i * 12.9) * 0.08;
      const s = 0.7 + ((i * 37) % 10) / 16;
      m.makeScale(s, s, s);
      m.setPosition(w.x + Math.cos(a) * w.rx * r, w.level - 0.1, w.z + Math.sin(a) * w.rz * r);
      reeds.setMatrixAt(i, m);
    }
    reeds.instanceMatrix.needsUpdate = true;
    g.add(reeds);
  }
  return g;
}
