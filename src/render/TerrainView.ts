import * as THREE from 'three';
import { matte } from './materials';
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
  // Tlumenější, přírodní zelené (skutečná tráva není neonová) a víc suchých skvrn.
  lush: C(0x51702e),
  fresh: C(0x6b8a3a),
  deep: C(0x3a5424),
  dry: C(0x9a9259),
  clover: C(0x587c35),
  straw: C(0x8a8a4c),
  dirt: C(0x7d6a4c),
  rock: C(0x85817a),
  site: C(0x8f7f63),
  gravel: C(0x9c968a),
  mud: C(0x5b4d36),
  wheat: C(0xcdb25c),
  plowed: C(0x6e5337),
  rapeseed: C(0xd8cc2e),
  needles: C(0x6a5236),
  moss: C(0x4c5f2a),
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
  forestEdgeX?: number; // les: od této x na východ jehličí a mech místo trávy
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
  // Vyšlapaná a přeschlá místa všude po louce, drobná zrnitost.
  lerpTo(c, PAL.straw, smoothstep(0.6, 0.85, fbm(x / 23 + 7, z / 23 + 3)) * 0.45);
  scale(c, 0.9 + 0.2 * vnoise(x * 0.9, z * 0.9));
  // Svahy: hlína, na strmých kámen.
  lerpTo(c, PAL.dirt, smoothstep(0.38, 0.6, slope));
  lerpTo(c, PAL.rock, smoothstep(0.62, 0.85, slope) * 0.8);
  // Lesní půda: jehličí, mech, u okraje přechod do trávy.
  if (paint.forestEdgeX !== undefined) {
    const w = smoothstep(paint.forestEdgeX - 4, paint.forestEdgeX + 10, x + (fbm(x / 9, z / 9) - 0.5) * 10);
    if (w > 0) {
      const f: RGB = [...PAL.needles];
      lerpTo(f, PAL.moss, smoothstep(0.5, 0.8, fbm(x / 7 + 3, z / 7 - 9)) * 0.7);
      scale(f, 0.8 + 0.35 * vnoise(x * 1.3, z * 1.3));
      lerpTo(c, f, w);
    }
  }
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
export function createTerrainMesh(hm: Heightmap, paint: TerrainPaint): TerrainTiles {
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

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(fullIndex(n), 1));
  geo.computeVertexNormals();

  const map = canvasTexture('grass', 256);
  const mat = withCloudShadows(matte({ vertexColors: true, map: map ?? undefined, bumpMap: map ?? undefined, bumpScale: 1.2 }));
  return new TerrainTiles(geo, mat, n, hm);
}

function fullIndex(n: number): Uint32Array {
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
  return idx;
}

/** Stíny mraků na terénu: sdílené uniformy (posun s větrem a síla podle oblačnosti). */
export const cloudShadow = {
  uShadowTex: { value: null as THREE.Texture | null },
  uShadowOff: { value: new THREE.Vector2() },
  uShadowK: { value: 0 },
};

/** Přidá do materiálu tmavé skvrny od mraků, které plují po krajině (jedno čtení textury). */
export function withCloudShadows(mat: THREE.Material): THREE.Material {
  cloudShadow.uShadowTex.value ??= canvasTexture('cloudShadow', 128);
  if (!cloudShadow.uShadowTex.value) return mat;
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey();
  mat.onBeforeCompile = (shader, r) => {
    prev.call(mat, shader, r);
    Object.assign(shader.uniforms, cloudShadow);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCsXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCsXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCsXZ;\nuniform sampler2D uShadowTex;\nuniform vec2 uShadowOff;\nuniform float uShadowK;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 1.0 - uShadowK * texture2D(uShadowTex, vCsXZ / 340.0 + uShadowOff).r;');
  };
  mat.customProgramCacheKey = () => `${prevKey}+cloudShadow`;
  return mat;
}

const TILE = 64; // buněk na stranu dlaždice (2 m → 128 m)
const COARSE = 4; // hrubá dlaždice: vrchol každé 4. buňky (8 m)
const DETAIL_DIST = 56; // do této vzdálenosti od kamery plné rozlišení [m]
const SKIRT = 2.5; // „sukně“ po obvodu dlaždice zakryje spáry mezi úrovněmi detailu [m]

/**
 * Terén po dlaždicích se dvěma úrovněmi detailu. Blízko hráče plné rozlišení (přesně
 * podle Heightmap), dál každý 4. vrchol. Na hranách mezi úrovněmi by vznikly škvíry –
 * zakrývá je svislý pruh („sukně“) spuštěný po obvodu každé dlaždice.
 */
export class TerrainTiles {
  readonly group = new THREE.Group();
  private readonly tiles: { cx: number; cz: number; half: number; fine: THREE.Mesh; coarse: THREE.Mesh }[] = [];
  private timer = 0;

  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, n: number, hm: Heightmap) {
    const cells = n - 1;
    for (let tz = 0; tz < cells; tz += TILE) {
      for (let tx = 0; tx < cells; tx += TILE) {
        const w = Math.min(TILE, cells - tx);
        const h = Math.min(TILE, cells - tz);
        const mk = (step: number): THREE.Mesh => {
          const m = new THREE.Mesh(tileGeometry(geo, n, tx, tz, w, h, step), mat);
          m.receiveShadow = true;
          m.matrixAutoUpdate = false;
          return m;
        };
        const fine = mk(1);
        const coarse = mk(w % COARSE || h % COARSE ? 1 : COARSE);
        coarse.visible = false;
        this.group.add(fine, coarse);
        this.tiles.push({ cx: hm.vertexCoord(tx) + (w * hm.cell) / 2, cz: hm.vertexCoord(tz) + (h * hm.cell) / 2, half: (Math.max(w, h) * hm.cell) / 2, fine, coarse });
      }
    }
  }

  /** Blízké dlaždice jemně, vzdálené hrubě (kontrola jen několikrát za sekundu). */
  update(dt: number, eye: { x: number; z: number }): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.2;
    for (const t of this.tiles) {
      const d = Math.hypot(Math.max(0, Math.abs(eye.x - t.cx) - t.half), Math.max(0, Math.abs(eye.z - t.cz) - t.half));
      const near = d < DETAIL_DIST;
      t.fine.visible = near;
      t.coarse.visible = !near;
    }
  }
}

/** Geometrie jedné dlaždice (mříž po `step` buňkách) se sukní po obvodu. */
function tileGeometry(src: THREE.BufferGeometry, n: number, tx: number, tz: number, w: number, h: number, step: number): THREE.BufferGeometry {
  const P = src.getAttribute('position') as THREE.BufferAttribute;
  const C = src.getAttribute('color') as THREE.BufferAttribute;
  const N = src.getAttribute('normal') as THREE.BufferAttribute;
  const U = src.getAttribute('uv') as THREE.BufferAttribute;
  const gw = w / step + 1;
  const gh = h / step + 1;
  const border = 2 * (gw + gh) - 4;
  const count = gw * gh + border;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  let v = 0;
  const copy = (si: number, drop: number): number => {
    pos[v * 3] = P.getX(si);
    pos[v * 3 + 1] = P.getY(si) - drop;
    pos[v * 3 + 2] = P.getZ(si);
    col[v * 3] = C.getX(si) * (drop ? 0.7 : 1);
    col[v * 3 + 1] = C.getY(si) * (drop ? 0.7 : 1);
    col[v * 3 + 2] = C.getZ(si) * (drop ? 0.7 : 1);
    nor[v * 3] = N.getX(si);
    nor[v * 3 + 1] = N.getY(si);
    nor[v * 3 + 2] = N.getZ(si);
    uv[v * 2] = U.getX(si);
    uv[v * 2 + 1] = U.getY(si);
    return v++;
  };
  const src_ = (gx: number, gz: number): number => (tz + gz * step) * n + tx + gx * step;
  for (let gz = 0; gz < gh; gz++) for (let gx = 0; gx < gw; gx++) copy(src_(gx, gz), 0);
  const at = (gx: number, gz: number): number => gz * gw + gx;
  const idx: number[] = [];
  for (let gz = 0; gz < gh - 1; gz++) {
    for (let gx = 0; gx < gw - 1; gx++) {
      const a = at(gx, gz);
      const b = at(gx + 1, gz);
      const cc = at(gx, gz + 1);
      const d = at(gx + 1, gz + 1);
      idx.push(a, d, b, a, cc, d);
    }
  }
  // Obvod po směru: horní hrana, pravá, dolní, levá – ke každému vrcholu spuštěná kopie.
  const ring: [number, number][] = [];
  for (let gx = 0; gx < gw; gx++) ring.push([gx, 0]);
  for (let gz = 1; gz < gh; gz++) ring.push([gw - 1, gz]);
  for (let gx = gw - 2; gx >= 0; gx--) ring.push([gx, gh - 1]);
  for (let gz = gh - 2; gz >= 1; gz--) ring.push([0, gz]);
  const low = ring.map(([gx, gz]) => copy(src_(gx, gz), SKIRT));
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const a = at(ring[i][0], ring[i][1]);
    const b = at(ring[j][0], ring[j][1]);
    // Oboustranně – sukně je vidět z obou stran spáry.
    idx.push(a, b, low[i], b, low[j], low[i], a, low[i], b, b, low[i], low[j]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/** Hladina rybníka a rákosí kolem. */
export function createWater(water: readonly WaterInfo[]): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color: 0x3f6e84, specular: 0xb8c8d6, shininess: 80, transparent: true, opacity: 0.88, emissive: 0x0b1d28 });
  const reedGeo = new THREE.ConeGeometry(0.03, 1.4, 4).translate(0, 0.7, 0);
  const reedMat = matte({ color: 0x7a8a3c });
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
