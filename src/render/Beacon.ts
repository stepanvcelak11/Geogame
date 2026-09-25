import * as THREE from 'three';

/** Světelný sloup nad cílem (kam jít) – vidět i z dálky, nad bodem se skryje. */
export class Beacon {
  private readonly g = new THREE.Group();
  private readonly ring: THREE.Mesh;
  private t = 0;

  constructor(scene: THREE.Scene) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xf2b705, transparent: true, opacity: 0.45, depthWrite: false, fog: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 26, 8, 1, true).translate(0, 13, 0), mat);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 6, 32).rotateX(Math.PI / 2), mat);
    this.ring.position.y = 0.05;
    this.g.add(beam, this.ring);
    this.g.visible = false;
    scene.add(this.g);
  }

  show(x: number, y: number, z: number, dt: number): void {
    this.t += dt;
    this.g.visible = true;
    this.g.position.set(x, y, z);
    const s = 1 + 0.25 * Math.sin(this.t * 4);
    this.ring.scale.set(s, 1, s);
  }

  hide(): void {
    this.g.visible = false;
  }
}
