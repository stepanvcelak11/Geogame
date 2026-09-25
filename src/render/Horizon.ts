import * as THREE from 'three';

/**
 * Kopce na obzoru: dvě vrstvy siluet za okrajem mapy, barva se mísí s barvou horizontu
 * (vzdušná perspektiva ručně – mlhu nepoužívají, jinak by zmizely).
 */
export class Horizon {
  private readonly group = new THREE.Group();
  private readonly near: THREE.MeshBasicMaterial;
  private readonly far: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, radius: number) {
    this.far = new THREE.MeshBasicMaterial({ color: 0x8aa0ae, fog: false });
    this.near = new THREE.MeshBasicMaterial({ color: 0x5d7460, fog: false });
    this.group.add(ring(radius, 26, 58, 7, this.far, 0.5), ring(radius * 0.93, 12, 34, 23, this.near, 1));
    this.group.renderOrder = -0.5;
    scene.add(this.group);
  }

  follow(p: { x: number; y: number; z: number }): void {
    this.group.position.set(p.x, 0, p.z);
  }

  /** Barvy podle oblohy: vzdálenější vrstva skoro splývá s horizontem. */
  setHorizon(horizonHex: number): void {
    const h = new THREE.Color(horizonHex);
    this.far.color.copy(h).lerp(new THREE.Color(0x4f6674), 0.32);
    this.near.color.copy(h).lerp(new THREE.Color(0x2f4431), 0.5);
  }
}

function ring(r: number, hMin: number, hMax: number, seed: number, mat: THREE.Material, trees: number): THREE.Mesh {
  const seg = 720;
  const pos: number[] = [];
  const idx: number[] = [];
  const wave = (a: number): number =>
    0.5 + 0.28 * Math.sin(a * 3 + seed) + 0.14 * Math.sin(a * 7.3 + seed * 2.1) + 0.08 * Math.sin(a * 17.1 + seed * 0.7);
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    // Na hřbetech zubatá linka lesa (střídá se s holými úseky).
    const forest = Math.max(0, Math.sin(a * 5 + seed * 1.3) * 0.7 + Math.sin(a * 11.7 + seed) * 0.5);
    const spikes = (Math.abs(Math.sin(a * 190 + seed)) * 0.7 + Math.abs(Math.sin(a * 331 + seed * 3)) * 0.5) * forest * trees;
    pos.push(x, -40, z, x, hMin + (hMax - hMin) * wave(a) + spikes * 4.2, z);
    if (i < seg) {
      const b = i * 2;
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, mat);
  m.material = mat;
  (m.material as THREE.Material).side = THREE.DoubleSide;
  m.frustumCulled = false;
  return m;
}
