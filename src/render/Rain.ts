import * as THREE from 'three';

/** Déšť: krátké čárky padající v kvádru kolem kamery (jen když prší). */
export class Rain {
  private readonly lines: THREE.LineSegments;
  private readonly pos: Float32Array;
  private readonly n: number;
  private readonly box = { w: 36, h: 18 };

  constructor(scene: THREE.Scene, mobile: boolean) {
    this.n = mobile ? 900 : 1800;
    this.pos = new Float32Array(this.n * 6);
    for (let i = 0; i < this.n; i++) {
      const x = (Math.random() - 0.5) * this.box.w;
      const y = Math.random() * this.box.h;
      const z = (Math.random() - 0.5) * this.box.w;
      this.pos.set([x, y, z, x + 0.03, y + 0.38, z], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb8c6d2, transparent: true, opacity: 0.45, depthWrite: false }));
    this.lines.frustumCulled = false;
    this.lines.visible = false;
    scene.add(this.lines);
  }

  update(dt: number, eye: { x: number; y: number; z: number }, intensity: number): void {
    this.lines.visible = intensity > 0;
    if (!this.lines.visible) return;
    const fall = 9 * dt;
    const drift = 0.8 * dt;
    const p = this.pos;
    const hw = this.box.w / 2;
    for (let i = 0; i < this.n; i++) {
      const o = i * 6;
      p[o + 1] -= fall;
      p[o + 4] -= fall;
      p[o] += drift;
      p[o + 3] += drift;
      if (p[o + 1] < -2) {
        const x = (Math.random() - 0.5) * this.box.w;
        const z = (Math.random() - 0.5) * this.box.w;
        const y = this.box.h - 2;
        p.set([x, y, z, x + 0.03, y + 0.38, z], o);
      }
      if (p[o] > hw) {
        p[o] -= this.box.w;
        p[o + 3] -= this.box.w;
      }
    }
    (this.lines.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.lines.position.set(eye.x, eye.y - 4, eye.z);
  }
}
