import * as THREE from 'three';
import { lambert } from './materials';

/** Postava pomocníka: reflexní vesta, montérky, helma (na stavbě), chůze. */
export class HelperView {
  readonly root = new THREE.Group();
  private readonly legs: THREE.Object3D[] = [];
  private readonly arms: THREE.Object3D[] = [];
  private readonly helmet: THREE.Object3D;
  private readonly cap: THREE.Object3D;

  constructor(parent: THREE.Object3D) {
    const skin = lambert(0xd9a67e, 'skin');
    const pants = lambert(0x2d3440, 'pants');
    const vest = lambert(0xff7a1a, 'vest');
    const stripe = lambert(0xe6e8e8, 'reflex');
    const boot = lambert(0x2a2118, 'boot');
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      return m;
    };
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(sx * 0.11, 0.92, 0);
      hip.add(mk(new THREE.BoxGeometry(0.15, 0.86, 0.17), pants, 0, -0.43, 0));
      hip.add(mk(new THREE.BoxGeometry(0.16, 0.1, 0.26), boot, 0, -0.87, -0.04));
      this.root.add(hip);
      this.legs.push(hip);
      const sh = new THREE.Group();
      sh.position.set(sx * 0.27, 1.42, 0);
      sh.add(mk(new THREE.BoxGeometry(0.11, 0.62, 0.12), vest, 0, -0.28, 0));
      sh.add(mk(new THREE.BoxGeometry(0.09, 0.1, 0.09), skin, 0, -0.63, 0));
      this.root.add(sh);
      this.arms.push(sh);
    }
    this.root.add(mk(new THREE.BoxGeometry(0.44, 0.58, 0.24), vest, 0, 1.2, 0));
    for (const y of [1.06, 1.26]) this.root.add(mk(new THREE.BoxGeometry(0.45, 0.04, 0.25), stripe, 0, y, 0));
    this.root.add(mk(new THREE.BoxGeometry(0.1, 0.08, 0.1), skin, 0, 1.52, 0));
    this.root.add(mk(new THREE.SphereGeometry(0.12, 12, 10), skin, 0, 1.66, 0));
    this.helmet = mk(new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lambert(0xf4f4f0, 'helmet'), 0, 1.69, 0);
    this.cap = mk(new THREE.CylinderGeometry(0.125, 0.125, 0.07, 12), lambert(0x1f4e79, 'cap'), 0, 1.75, 0);
    this.root.add(this.helmet, this.cap);
    parent.add(this.root);
  }

  sync(p: { x: number; y: number; z: number }, yaw: number, phase: number, visible: boolean, helmet: boolean, holding: boolean): void {
    this.root.visible = visible;
    if (!visible) return;
    this.root.position.set(p.x, p.y, p.z);
    this.root.rotation.y = yaw;
    const s = Math.sin(phase) * 0.5;
    this.legs[0].rotation.x = s;
    this.legs[1].rotation.x = -s;
    // Když drží výtyčku, pravá ruka je nahoře před tělem.
    this.arms[0].rotation.x = -s * 0.8;
    this.arms[1].rotation.x = holding ? -1.1 : s * 0.8;
    this.helmet.visible = helmet;
    this.cap.visible = !helmet;
  }
}
