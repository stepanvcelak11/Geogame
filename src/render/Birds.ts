import * as THREE from 'three';

/** Hejno ptáků kroužících nad krajinou (čárková „V“ s máváním křídel). */
export class Birds {
  private readonly lines: THREE.LineSegments;
  private readonly pos: Float32Array;
  private readonly birds: { r: number; h: number; a: number; w: number; phase: number }[] = [];
  private t = 0;

  constructor(scene: THREE.Scene) {
    for (let i = 0; i < 7; i++) this.birds.push({ r: 25 + i * 6, h: 28 + (i % 3) * 7, a: i * 0.9, w: 0.18 + (i % 2) * 0.05, phase: i * 1.7 });
    this.pos = new Float32Array(this.birds.length * 12);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x23272b }));
    this.lines.frustumCulled = false;
    scene.add(this.lines);
  }

  update(dt: number, center: { x: number; y: number; z: number }, visible: boolean): void {
    this.lines.visible = visible;
    if (!visible) return;
    this.t += dt;
    this.birds.forEach((b, i) => {
      b.a += b.w * dt;
      const x = center.x + Math.cos(b.a) * b.r + 40;
      const z = center.z + Math.sin(b.a) * b.r - 30;
      const y = center.y + b.h + Math.sin(this.t * 0.7 + b.phase) * 2;
      const fx = -Math.sin(b.a); // směr letu (tečna)
      const fz = Math.cos(b.a);
      const rx = fz;
      const rz = -fx;
      const flap = Math.sin(this.t * 9 + b.phase) * 0.35;
      const s = 0.6;
      const o = i * 12;
      this.pos.set([x, y, z, x - rx * s - fx * 0.2, y + flap, z - rz * s - fz * 0.2, x, y, z, x + rx * s - fx * 0.2, y + flap, z + rz * s - fz * 0.2], o);
    });
    (this.lines.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
}
