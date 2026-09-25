import * as THREE from 'three';
import type { World } from '../world/World';
import { FOREST, inPolygon } from '../world/WorldGen';
import { canvasTexture } from './textures';

const CELL = 4; // strana buňky rozmístění [m]
const RADIUS = 34; // tráva jen kolem hráče [m]

function hash(a: number, b: number, k: number): number {
  let x = Math.imul(a * 73856093 ^ b * 19349663 ^ k * 83492791, 0x27d4eb2d);
  x ^= x >>> 15;
  return ((Math.imul(x, 0x165667b1) >>> 0) % 100000) / 100000;
}

/**
 * Trsy trávy (a klasy na poli) jako instancované křížené čtverce kolem kamery.
 * Rozmístění je deterministické po buňkách, takže se tráva při chůzi „nehýbe“.
 */
export class GrassView {
  readonly mesh: THREE.InstancedMesh;
  private readonly flowers: THREE.InstancedMesh;
  private readonly max: number;
  private cx = Infinity;
  private density = 1;

  /** Hustota trávy 0 / 0,5 / 1 (z nastavení). */
  setDensity(d: number): void {
    if (d === this.density) return;
    this.density = d;
    this.cx = Infinity; // přestavět při dalším update
  }
  private cz = Infinity;

  constructor(
    parent: THREE.Object3D,
    private readonly world: World,
    mobile: boolean,
  ) {
    this.max = mobile ? 4200 : 9000;
    const plane = new THREE.PlaneGeometry(0.7, 0.5).translate(0, 0.25, 0);
    const a = plane.clone();
    const b = plane.clone().rotateY(Math.PI / 2);
    const geo = mergeTwo(a, b);
    const map = canvasTexture('blades', 128, false);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: map ?? undefined, alphaTest: 0.45, side: THREE.DoubleSide }); // tisíce stébel: levný materiál
    this.mesh = new THREE.InstancedMesh(geo, mat, this.max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.userData.noAO = true;
    parent.add(this.mesh);
    const fmap = canvasTexture('flowers', 128, false);
    const fmat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: fmap ?? undefined, alphaTest: 0.4, side: THREE.DoubleSide });
    this.flowers = new THREE.InstancedMesh(geo, fmat, Math.round(this.max / 4));
    this.flowers.count = 0;
    this.flowers.frustumCulled = false;
    this.flowers.userData.noAO = true;
    parent.add(this.flowers);
  }

  /** Přestaví trsy, když se kamera posune o buňku. */
  update(x: number, z: number): void {
    const gx = Math.floor(x / CELL);
    const gz = Math.floor(z / CELL);
    if (gx === this.cx && gz === this.cz) return;
    this.cx = gx;
    this.cz = gz;
    const w = this.world;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const col = new THREE.Color();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const r = Math.ceil(RADIUS / CELL);
    let n = 0;
    let nf = 0;
    const fmax = Math.round(this.max / 4);
    for (let dz = -r; dz <= r && n < this.max; dz++) {
      for (let dx = -r; dx <= r && n < this.max; dx++) {
        if (dx * dx + dz * dz > r * r) continue;
        const ix = gx + dx;
        const iz = gz + dz;
        for (let k = 0; k < Math.round(7 * this.density) && n < this.max; k++) {
          const px = (ix + hash(ix, iz, k * 2)) * CELL;
          const pz = (iz + hash(ix, iz, k * 2 + 1)) * CELL;
          const surf = w.surfaceAt(px, pz);
          if (surf !== 'grass') continue;
          if (w.water.some((wt) => ((px - wt.x) / wt.rx) ** 2 + ((pz - wt.z) / wt.rz) ** 2 < 1.1)) continue;
          if (w.heightmap.slopeAt(px, pz) > 0.7) continue;
          const field = w.fields.find((f) => inPolygon(px, pz, f.corners));
          if (field?.crop === 'plowed') continue;
          // V lese jen řídké trsy (kapradí, borůvčí), tmavší.
          const forest = w.location === 'les' && px > FOREST.edgeX + 4;
          if (forest && hash(ix, iz, k + 31) > 0.25) continue;
          const tall = field ? 1.9 : 0.8 + hash(ix, iz, k + 50) * 0.9;
          q.setFromAxisAngle(yAxis, hash(ix, iz, k + 90) * Math.PI);
          m.compose(p.set(px, w.heightmap.heightAt(px, pz) - 0.02, pz), q, s.set(1 + hash(ix, iz, k + 7) * 0.6, tall, 1));
          this.mesh.setMatrixAt(n, m);
          if (field?.crop === 'wheat') col.setHSL(0.13, 0.55, 0.55 + hash(ix, iz, k) * 0.08);
          else if (field?.crop === 'rapeseed') col.setHSL(0.16, 0.8, 0.5);
          else if (forest) col.setHSL(0.27 + hash(ix, iz, k + 3) * 0.05, 0.45, 0.2 + hash(ix, iz, k + 4) * 0.06);
          else col.setHSL(0.24 + hash(ix, iz, k + 3) * 0.06, 0.5, 0.32 + hash(ix, iz, k + 4) * 0.1);
          this.mesh.setColorAt(n, col);
          n++;
          // Kvítí na louce (ne na polích).
          if (!field && nf < fmax && hash(ix, iz, k + 200) < 0.28) {
            m.compose(p.set(px + 0.3, w.heightmap.heightAt(px + 0.3, pz) - 0.02, pz + 0.2), q, s.set(0.8, 0.7 + hash(ix, iz, k + 9) * 0.4, 0.8));
            this.flowers.setMatrixAt(nf++, m);
          }
        }
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.flowers.count = nf;
    this.flowers.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/** Spojí dvě neindexované geometrie se stejnými atributy (position, normal, uv). */
function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const A = a.toNonIndexed();
  const B = b.toNonIndexed();
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const x = A.getAttribute(name) as THREE.BufferAttribute;
    const y = B.getAttribute(name) as THREE.BufferAttribute;
    const arr = new Float32Array(x.array.length + y.array.length);
    arr.set(x.array as Float32Array, 0);
    arr.set(y.array as Float32Array, x.array.length);
    g.setAttribute(name, new THREE.BufferAttribute(arr, x.itemSize));
  }
  return g;
}
