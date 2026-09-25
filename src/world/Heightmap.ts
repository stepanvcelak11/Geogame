import { clamp, type Vec3 } from '../core/math';

/**
 * Pravidelná mříž výšek. Interpolace kopíruje přesně triangulaci meshe
 * (úhlopříčka 00→11), takže nohy hráče ani značky nikdy „neplavou“.
 * Herní rámec: x = východ, z = jih, střed mapy v počátku.
 */
export class Heightmap {
  readonly n: number;
  readonly half: number;

  constructor(
    readonly size: number,
    readonly cell: number,
    readonly heights: Float32Array,
  ) {
    this.n = Math.round(size / cell) + 1;
    this.half = size / 2;
    if (heights.length !== this.n * this.n) throw new Error('Heightmap: nesouhlasí počet vzorků');
  }

  static generate(size: number, cell: number, fn: (x: number, z: number) => number): Heightmap {
    const n = Math.round(size / cell) + 1;
    const half = size / 2;
    const h = new Float32Array(n * n);
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) h[iz * n + ix] = fn(-half + ix * cell, -half + iz * cell);
    }
    return new Heightmap(size, cell, h);
  }

  vertexHeight(ix: number, iz: number): number {
    return this.heights[iz * this.n + ix];
  }

  vertexCoord(i: number): number {
    return -this.half + i * this.cell;
  }

  /** Buňka a lokální poloha (fx, fz ∈ ⟨0,1⟩) pro bod v rovině. */
  private locate(x: number, z: number): { ix: number; iz: number; fx: number; fz: number } {
    const max = this.n - 1 - 1e-9;
    const gx = clamp((x + this.half) / this.cell, 0, max);
    const gz = clamp((z + this.half) / this.cell, 0, max);
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    return { ix, iz, fx: gx - ix, fz: gz - iz };
  }

  heightAt(x: number, z: number): number {
    const { ix, iz, fx, fz } = this.locate(x, z);
    const h00 = this.vertexHeight(ix, iz);
    const h10 = this.vertexHeight(ix + 1, iz);
    const h01 = this.vertexHeight(ix, iz + 1);
    const h11 = this.vertexHeight(ix + 1, iz + 1);
    return fx > fz ? h00 + fx * (h10 - h00) + fz * (h11 - h10) : h00 + fz * (h01 - h00) + fx * (h11 - h01);
  }

  /** Spád terénu (dh/dx, dh/dz) na trojúhelníku pod bodem. */
  gradientAt(x: number, z: number): { dx: number; dz: number } {
    const { ix, iz, fx, fz } = this.locate(x, z);
    const h00 = this.vertexHeight(ix, iz);
    const h10 = this.vertexHeight(ix + 1, iz);
    const h01 = this.vertexHeight(ix, iz + 1);
    const h11 = this.vertexHeight(ix + 1, iz + 1);
    const c = this.cell;
    return fx > fz
      ? { dx: (h10 - h00) / c, dz: (h11 - h10) / c }
      : { dx: (h11 - h01) / c, dz: (h01 - h00) / c };
  }

  normalAt(x: number, z: number): Vec3 {
    const g = this.gradientAt(x, z);
    const l = Math.hypot(g.dx, 1, g.dz);
    return { x: -g.dx / l, y: 1 / l, z: -g.dz / l };
  }

  /** Sklon terénu [rad]. */
  slopeAt(x: number, z: number): number {
    const g = this.gradientAt(x, z);
    return Math.atan(Math.hypot(g.dx, g.dz));
  }

  /**
   * Průsečík paprsku s terénem (směr musí být jednotkový). Krokování + bisekce.
   * Pro interakci stačí krok 0,5 m; laser totální stanice (M3) ho zjemní.
   */
  raycast(o: Vec3, d: Vec3, maxDist: number, step = 0.5): number | null {
    if (o.y - this.heightAt(o.x, o.z) < 0) return 0;
    let prevT = 0;
    for (let t = step; ; t += step) {
      const tt = Math.min(t, maxDist);
      const diff = o.y + d.y * tt - this.heightAt(o.x + d.x * tt, o.z + d.z * tt);
      if (diff < 0) {
        let lo = prevT;
        let hi = tt;
        for (let i = 0; i < 14; i++) {
          const mid = (lo + hi) / 2;
          const dm = o.y + d.y * mid - this.heightAt(o.x + d.x * mid, o.z + d.z * mid);
          if (dm < 0) hi = mid;
          else lo = mid;
        }
        return (lo + hi) / 2;
      }
      prevT = tt;
      if (tt >= maxDist) return null;
    }
  }
}
