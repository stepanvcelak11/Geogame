import * as THREE from 'three';

/** Značka na zemi: kam se postaví stativ / výtyčka nebo kde je hrot roveru. */
export class TargetMarker {
  private readonly group = new THREE.Group();
  private readonly ringMat = new THREE.MeshBasicMaterial({ color: 0xf2b705, transparent: true, opacity: 0.9, depthWrite: false });
  private readonly snapMat = new THREE.MeshBasicMaterial({ color: 0x3fbf5a, transparent: true, opacity: 0.95, depthWrite: false });
  private readonly ring: THREE.Mesh;
  private readonly cross: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.13, 32).rotateX(-Math.PI / 2), this.ringMat);
    this.cross = new THREE.Group();
    for (const r of [0, Math.PI / 2]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.012).rotateX(-Math.PI / 2).rotateY(r), this.ringMat);
      this.cross.add(bar);
    }
    this.group.add(this.ring, this.cross);
    this.group.renderOrder = 2;
    this.group.visible = false;
    scene.add(this.group);
  }

  show(x: number, y: number, z: number, valid: boolean, snapped: boolean): void {
    this.group.visible = true;
    this.group.position.set(x, y + 0.015, z);
    const mat = snapped ? this.snapMat : this.ringMat;
    this.ring.material = mat;
    this.cross.children.forEach((c) => ((c as THREE.Mesh).material = mat));
    this.ringMat.color.setHex(valid ? 0xf2b705 : 0xd0412f);
  }

  hide(): void {
    this.group.visible = false;
  }
}
