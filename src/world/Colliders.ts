import { clamp, type Vec3 } from '../core/math';

export type ColliderTag = 'trunk' | 'crown' | 'vehicle' | 'prop';

/** Svislý válec (kmen, koruna). */
export interface CircleCollider {
  kind: 'circle';
  x: number;
  z: number;
  r: number;
  yMin: number;
  yMax: number;
  tag: ColliderTag;
}

/** Osově zarovnaný kvádr (auto, bedny). */
export interface BoxCollider {
  kind: 'box';
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  yMin: number;
  yMax: number;
  tag: ColliderTag;
}

export type Collider = CircleCollider | BoxCollider;

export interface ColliderHit {
  t: number;
  collider: Collider;
}

/** Tagy, do kterých hráč narazí. Koruny slouží jen pro line-of-sight. */
export const SOLID_TAGS: ReadonlySet<ColliderTag> = new Set(['trunk', 'vehicle', 'prop']);

/** Kolizní objekty v prostorové mřížce (v rovině XZ). */
export class ColliderSet {
  private readonly grid = new Map<number, Collider[]>();
  readonly all: Collider[] = [];

  constructor(private readonly cellSize = 8) {}

  private key(ix: number, iz: number): number {
    return (ix + 4096) * 8192 + (iz + 4096);
  }

  add(c: Collider): void {
    this.all.push(c);
    const [minX, minZ, maxX, maxZ] =
      c.kind === 'circle' ? [c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r] : [c.minX, c.minZ, c.maxX, c.maxZ];
    const s = this.cellSize;
    for (let iz = Math.floor(minZ / s); iz <= Math.floor(maxZ / s); iz++) {
      for (let ix = Math.floor(minX / s); ix <= Math.floor(maxX / s); ix++) {
        const k = this.key(ix, iz);
        let list = this.grid.get(k);
        if (!list) {
          list = [];
          this.grid.set(k, list);
        }
        list.push(c);
      }
    }
  }

  queryArea(minX: number, minZ: number, maxX: number, maxZ: number, out: Set<Collider>): void {
    const s = this.cellSize;
    for (let iz = Math.floor(minZ / s); iz <= Math.floor(maxZ / s); iz++) {
      for (let ix = Math.floor(minX / s); ix <= Math.floor(maxX / s); ix++) {
        const list = this.grid.get(this.key(ix, iz));
        if (list) for (const c of list) out.add(c);
      }
    }
  }

  /**
   * Vytlačí kruh (hráč, pokládaný předmět) z pevných překážek. Mění p.
   * Vrací průměrnou normálu kontaktu pro ořezání rychlosti.
   */
  resolveCircle(
    p: { x: number; z: number },
    r: number,
    yFeet: number,
    yHead: number,
    tags: ReadonlySet<ColliderTag> = SOLID_TAGS,
  ): { hit: boolean; nx: number; nz: number } {
    const found = new Set<Collider>();
    this.queryArea(p.x - r - 1, p.z - r - 1, p.x + r + 1, p.z + r + 1, found);
    let hit = false;
    let nx = 0;
    let nz = 0;
    for (const c of found) {
      if (!tags.has(c.tag) || yHead <= c.yMin || yFeet >= c.yMax) continue;
      if (c.kind === 'circle') {
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        const minD = r + c.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= minD * minD) continue;
        const d = Math.sqrt(d2);
        const ux = d > 1e-6 ? dx / d : 1;
        const uz = d > 1e-6 ? dz / d : 0;
        p.x += ux * (minD - d);
        p.z += uz * (minD - d);
        nx += ux;
        nz += uz;
        hit = true;
      } else {
        const cx = clamp(p.x, c.minX, c.maxX);
        const cz = clamp(p.z, c.minZ, c.maxZ);
        const dx = p.x - cx;
        const dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 > 1e-12) {
          if (d2 >= r * r) continue;
          const d = Math.sqrt(d2);
          p.x += (dx / d) * (r - d);
          p.z += (dz / d) * (r - d);
          nx += dx / d;
          nz += dz / d;
        } else {
          // Střed uvnitř kvádru: nejkratší cesta ven.
          const exits = [
            { d: p.x - c.minX, x: c.minX - r, z: p.z, nx: -1, nz: 0 },
            { d: c.maxX - p.x, x: c.maxX + r, z: p.z, nx: 1, nz: 0 },
            { d: p.z - c.minZ, x: p.x, z: c.minZ - r, nx: 0, nz: -1 },
            { d: c.maxZ - p.z, x: p.x, z: c.maxZ + r, nx: 0, nz: 1 },
          ];
          const e = exits.reduce((a, b) => (b.d < a.d ? b : a));
          p.x = e.x;
          p.z = e.z;
          nx += e.nx;
          nz += e.nz;
        }
        hit = true;
      }
    }
    const l = Math.hypot(nx, nz);
    return { hit, nx: l > 0 ? nx / l : 0, nz: l > 0 ? nz / l : 0 };
  }

  /** Nejbližší zásah paprsku (jednotkový směr) do maxDist, nebo null. */
  raycast(o: Vec3, d: Vec3, maxDist: number): ColliderHit | null {
    const found = new Set<Collider>();
    const hl = Math.hypot(d.x, d.z) * maxDist;
    const samples = Math.max(1, Math.ceil(hl / (this.cellSize * 0.5)));
    for (let i = 0; i <= samples; i++) {
      const t = (maxDist * i) / samples;
      const x = o.x + d.x * t;
      const z = o.z + d.z * t;
      this.queryArea(x - 1, z - 1, x + 1, z + 1, found);
    }
    let best: ColliderHit | null = null;
    for (const c of found) {
      const t = c.kind === 'circle' ? rayCylinder(o, d, c) : rayBox(o, d, c);
      if (t !== null && t <= maxDist && (!best || t < best.t)) best = { t, collider: c };
    }
    return best;
  }
}

function rayCylinder(o: Vec3, d: Vec3, c: CircleCollider): number | null {
  const ox = o.x - c.x;
  const oz = o.z - c.z;
  const cc = ox * ox + oz * oz - c.r * c.r;
  if (cc < 0) return null; // počátek uvnitř válce (v půdorysu) – ignorujeme
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-12) return null;
  const b = 2 * (ox * d.x + oz * d.z);
  const disc = b * b - 4 * a * cc;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const t0 = (-b - sq) / (2 * a);
  const t1 = (-b + sq) / (2 * a);
  if (t1 < 0) return null;
  if (t0 >= 0) {
    const y = o.y + d.y * t0;
    if (y >= c.yMin && y <= c.yMax) return t0;
  }
  // Průchod podstavou nebo vrcholem válce.
  if (Math.abs(d.y) > 1e-9) {
    for (const yc of [c.yMax, c.yMin]) {
      const t = (yc - o.y) / d.y;
      if (t >= Math.max(0, t0) && t <= t1) return t;
    }
  }
  return null;
}

function rayBox(o: Vec3, d: Vec3, c: BoxCollider): number | null {
  let tmin = 0;
  let tmax = Infinity;
  const axes: [number, number, number, number][] = [
    [o.x, d.x, c.minX, c.maxX],
    [o.y, d.y, c.yMin, c.yMax],
    [o.z, d.z, c.minZ, c.maxZ],
  ];
  for (const [oo, dd, lo, hi] of axes) {
    if (Math.abs(dd) < 1e-12) {
      if (oo < lo || oo > hi) return null;
      continue;
    }
    let t1 = (lo - oo) / dd;
    let t2 = (hi - oo) / dd;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}

/** Otočený kvádr v půdorysu (dodávka). Délka podél směru jízdy. */
export interface Obb {
  cx: number;
  cz: number;
  yaw: number; // směr jízdy: (−sin yaw, −cos yaw)
  halfL: number;
  halfW: number;
  yMin: number;
  yMax: number;
}

/** Vytlačí kruh z otočeného kvádru. Mění p. */
export function resolveCircleObb(
  p: { x: number; z: number },
  r: number,
  yFeet: number,
  yHead: number,
  b: Obb,
): { hit: boolean; nx: number; nz: number } {
  const none = { hit: false, nx: 0, nz: 0 };
  if (yHead <= b.yMin || yFeet >= b.yMax) return none;
  const fx = -Math.sin(b.yaw);
  const fz = -Math.cos(b.yaw);
  const rx = Math.cos(b.yaw);
  const rz = -Math.sin(b.yaw);
  const dx = p.x - b.cx;
  const dz = p.z - b.cz;
  const lf = dx * fx + dz * fz; // lokálně podél
  const lr = dx * rx + dz * rz; // lokálně napříč
  const cf = clamp(lf, -b.halfL, b.halfL);
  const cr = clamp(lr, -b.halfW, b.halfW);
  let nf = lf - cf;
  let nr = lr - cr;
  const d = Math.hypot(nf, nr);
  if (d >= r) return none;
  let push: number;
  if (d > 1e-9) {
    nf /= d;
    nr /= d;
    push = r - d;
  } else {
    // Střed uvnitř: nejkratší cesta ven.
    const exits = [
      { d: b.halfL - lf, f: 1, r: 0 },
      { d: lf + b.halfL, f: -1, r: 0 },
      { d: b.halfW - lr, f: 0, r: 1 },
      { d: lr + b.halfW, f: 0, r: -1 },
    ];
    const e = exits.reduce((a, c) => (c.d < a.d ? c : a));
    nf = e.f;
    nr = e.r;
    push = e.d + r;
  }
  const nx = nf * fx + nr * rx;
  const nz = nf * fz + nr * rz;
  p.x += nx * push;
  p.z += nz * push;
  return { hit: true, nx, nz };
}

/** Průsečík paprsku s otočeným kvádrem (slab test v lokálních osách). Vrací t nebo null. */
export function rayObb(o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, b: Obb, maxT: number): number | null {
  const fx = -Math.sin(b.yaw);
  const fz = -Math.cos(b.yaw);
  const rx = Math.cos(b.yaw);
  const rz = -Math.sin(b.yaw);
  const ox = o.x - b.cx;
  const oz = o.z - b.cz;
  const axes: [number, number, number, number][] = [
    [ox * fx + oz * fz, d.x * fx + d.z * fz, -b.halfL, b.halfL],
    [ox * rx + oz * rz, d.x * rx + d.z * rz, -b.halfW, b.halfW],
    [o.y, d.y, b.yMin, b.yMax],
  ];
  let t0 = 0;
  let t1 = maxT;
  for (const [p, v, lo, hi] of axes) {
    if (Math.abs(v) < 1e-12) {
      if (p < lo || p > hi) return null;
      continue;
    }
    let a = (lo - p) / v;
    let c = (hi - p) / v;
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, c);
    if (t0 > t1) return null;
  }
  return t0;
}
