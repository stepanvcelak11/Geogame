import * as THREE from 'three';
import type { Vec3 } from '../core/math';
import { lambert } from './materials';

export interface StakeView {
  id: string;
  pos: Vec3;
}

/** Dřevěné kolíky s červeně natřenou hlavou a hřebíkem uprostřed. */
export class StakesView {
  private readonly group = new THREE.Group();
  private readonly shown = new Set<string>();
  private readonly shaft = new THREE.BoxGeometry(0.05, 0.5, 0.05).translate(0, -0.03, 0);
  private readonly head = new THREE.BoxGeometry(0.052, 0.06, 0.052).translate(0, 0.25, 0);
  private readonly nail = new THREE.CylinderGeometry(0.004, 0.004, 0.02, 6).translate(0, 0.29, 0);

  constructor(parent: THREE.Object3D) {
    parent.add(this.group);
  }

  sync(stakes: readonly StakeView[]): void {
    for (const s of stakes) {
      if (this.shown.has(s.id)) continue;
      this.shown.add(s.id);
      const g = new THREE.Group();
      g.add(
        new THREE.Mesh(this.shaft, lambert(0xb08a5a, 'stake-wood')),
        new THREE.Mesh(this.head, lambert(0xc8362b, 'stake-red')),
        new THREE.Mesh(this.nail, lambert(0x9aa0a6, 'stake-nail')),
      );
      g.position.set(s.pos.x, s.pos.y - 0.28, s.pos.z); // hlava kolíku 1 cm nad terénem
      this.group.add(g);
    }
  }
}
