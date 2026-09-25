import * as THREE from 'three';
import { lambert } from './materials';
import { mergeStatic } from './mergeStatic';

export type HelperPose = 'idle' | 'walk' | 'hold' | 'instrument' | 'carry' | 'shoulder';

const cap = (r: number, len: number): THREE.BufferGeometry => new THREE.CapsuleGeometry(r, len, 3, 10);

/** Kus těla: díly se sloučí do jednoho meshe (barvy ve vrcholech), kloub je počátek skupiny. */
function part(pieces: [THREE.BufferGeometry, THREE.Material, number, number, number, number?, number?, number?][]): THREE.Group {
  const tmp = new THREE.Group();
  for (const [g, m, x, y, z, rx = 0, ry = 0, rz = 0] of pieces) {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    tmp.add(mesh);
  }
  const merged = mergeStatic(tmp);
  merged.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.matrixAutoUpdate = false;
    }
  });
  return merged;
}

/**
 * Pomocník Pepa: postava s klouby (kyčle, kolena, ramena, lokty, krk), montérky,
 * reflexní vesta s pruhy, helma na stavbě / kšiltovka jinde, knír. Animace chůze,
 * dýchání, držení výtyčky, práce u přístroje a nošení věcí.
 */
export class HelperView {
  readonly root = new THREE.Group();
  private readonly pelvis = new THREE.Group();
  private readonly spine = new THREE.Group();
  private readonly neck = new THREE.Group();
  private readonly thigh: THREE.Group[] = [];
  private readonly shin: THREE.Group[] = [];
  private readonly upper: THREE.Group[] = [];
  private readonly fore: THREE.Group[] = [];
  private readonly helmet: THREE.Object3D;
  private readonly capHat: THREE.Object3D;
  private t = 0;

  constructor(parent: THREE.Object3D) {
    const skin = lambert(0xd8a47f, 'skin');
    const pants = lambert(0x4a5a70, 'pants');
    const knee = lambert(0x1e2329, 'kneepad');
    const shirt = lambert(0x3b6390, 'shirt');
    const vest = lambert(0xff7a1a, 'vest');
    const stripe = lambert(0xdfe3e3, 'reflex');
    const boot = lambert(0x3a2a1c, 'boot');
    const sole = lambert(0x17140f, 'sole');
    const belt = lambert(0x22201c, 'belt');
    const hair = lambert(0x5a3f2a, 'hair');
    const dark = lambert(0x1a1512, 'eyes');
    const glove = lambert(0x6b5a3a, 'glove');

    this.root.add(this.pelvis);
    this.pelvis.position.y = 0.93;
    // Pánev a opasek.
    this.pelvis.add(
      part([
        [new THREE.BoxGeometry(0.34, 0.16, 0.2), pants, 0, -0.02, 0],
        [new THREE.BoxGeometry(0.36, 0.05, 0.22), belt, 0, 0.06, 0],
        [new THREE.BoxGeometry(0.06, 0.08, 0.03), lambert(0x9aa0a6, 'buckle'), 0, 0.06, -0.115],
      ]),
    );
    // Nohy: stehno (kyčel) → holeň (koleno).
    for (const sx of [-1, 1]) {
      const th = new THREE.Group();
      th.position.set(sx * 0.1, -0.04, 0);
      th.add(part([[cap(0.075, 0.3), pants, 0, -0.21, 0]]));
      const sh = new THREE.Group();
      sh.position.y = -0.43;
      sh.add(
        part([
          [cap(0.065, 0.3), pants, 0, -0.2, 0],
          [new THREE.BoxGeometry(0.11, 0.12, 0.05), knee, 0, -0.02, -0.06],
          [new THREE.BoxGeometry(0.12, 0.09, 0.24), boot, 0, -0.42, -0.04],
          [new THREE.BoxGeometry(0.13, 0.025, 0.26), sole, 0, -0.47, -0.04],
        ]),
      );
      th.add(sh);
      this.pelvis.add(th);
      this.thigh.push(th);
      this.shin.push(sh);
    }
    // Trup: košile, vesta s reflexními pruhy, kapsy.
    this.spine.position.y = 0.08;
    this.pelvis.add(this.spine);
    this.spine.add(
      part([
        [cap(0.16, 0.26), shirt, 0, 0.26, 0, 0, 0, 0],
        [new THREE.CylinderGeometry(0.185, 0.17, 0.44, 12), vest, 0, 0.27, 0],
        [new THREE.CylinderGeometry(0.188, 0.188, 0.04, 12), stripe, 0, 0.16, 0],
        [new THREE.CylinderGeometry(0.19, 0.19, 0.04, 12), stripe, 0, 0.34, 0],
        [new THREE.BoxGeometry(0.1, 0.09, 0.03), vest, -0.08, 0.2, -0.18],
        [new THREE.BoxGeometry(0.03, 0.12, 0.02), lambert(0x333333, 'pen'), 0.09, 0.38, -0.18],
      ]),
    );
    // Hlava: krk, obličej, vlasy, knír (Pepa!).
    this.neck.position.y = 0.52;
    this.spine.add(this.neck);
    const head = new THREE.SphereGeometry(0.11, 14, 12).scale(0.92, 1.1, 1);
    this.neck.add(
      part([
        [new THREE.CylinderGeometry(0.05, 0.055, 0.08, 8), skin, 0, 0.02, 0],
        [head, skin, 0, 0.15, 0],
        [new THREE.SphereGeometry(0.108, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45).scale(0.95, 1.1, 1.02), hair, 0, 0.17, 0.005],
        [new THREE.SphereGeometry(0.014, 6, 6), dark, -0.038, 0.17, -0.098],
        [new THREE.SphereGeometry(0.014, 6, 6), dark, 0.038, 0.17, -0.098],
        [new THREE.ConeGeometry(0.018, 0.045, 6), skin, 0, 0.135, -0.11, -Math.PI / 2],
        [new THREE.CapsuleGeometry(0.014, 0.07, 2, 6), hair, 0, 0.105, -0.1, 0, 0, Math.PI / 2],
        [new THREE.SphereGeometry(0.025, 6, 6).scale(0.6, 1, 0.6), skin, -0.1, 0.15, 0],
        [new THREE.SphereGeometry(0.025, 6, 6).scale(0.6, 1, 0.6), skin, 0.1, 0.15, 0],
      ]),
    );
    this.helmet = part([
      [new THREE.SphereGeometry(0.128, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.9, 1.08), lambert(0xf4f4f0, 'helmet'), 0, 0.19, 0],
      [new THREE.CylinderGeometry(0.15, 0.15, 0.012, 16).scale(1, 1, 1.12), lambert(0xe8e8e2, 'helmetbrim'), 0, 0.19, -0.01],
    ]);
    this.capHat = part([
      [new THREE.SphereGeometry(0.118, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1.05), lambert(0x1f4e79, 'cap'), 0, 0.2, 0],
      [new THREE.BoxGeometry(0.16, 0.012, 0.09), lambert(0x1f4e79, 'cap'), 0, 0.205, -0.13],
    ]);
    this.neck.add(this.helmet, this.capHat);
    // Ruce: rameno → loket, rukavice.
    for (const sx of [-1, 1]) {
      const up = new THREE.Group();
      up.position.set(sx * 0.23, 0.44, 0);
      up.add(
        part([
          [new THREE.SphereGeometry(0.075, 10, 8), vest, 0, 0, 0],
          [cap(0.055, 0.2), shirt, 0, -0.15, 0],
        ]),
      );
      const fo = new THREE.Group();
      fo.position.y = -0.3;
      fo.add(
        part([
          [cap(0.047, 0.18), shirt, 0, -0.12, 0],
          [new THREE.SphereGeometry(0.052, 8, 6).scale(0.9, 1.1, 0.7), glove, 0, -0.28, 0],
        ]),
      );
      up.add(fo);
      this.spine.add(up);
      this.upper.push(up);
      this.fore.push(fo);
    }
    parent.add(this.root);
  }

  sync(p: { x: number; y: number; z: number }, yaw: number, phase: number, visible: boolean, helmet: boolean, pose: HelperPose, moving: boolean, dt = 1 / 60): void {
    this.root.visible = visible;
    if (!visible) return;
    this.t += dt;
    this.root.position.set(p.x, p.y, p.z);
    this.root.rotation.y = yaw;
    this.helmet.visible = helmet;
    this.capHat.visible = !helmet;
    const walking = moving;
    const s = walking ? Math.sin(phase) : 0;
    const c = walking ? Math.cos(phase) : 0;
    const breathe = Math.sin(this.t * 1.7) * 0.012;
    // Nohy: kyčel dopředu/dozadu, koleno se ohne, když noha jde dopředu.
    this.thigh[0].rotation.x = s * 0.5;
    this.thigh[1].rotation.x = -s * 0.5;
    this.shin[0].rotation.x = -Math.max(0, -c) * 0.75 - 0.03;
    this.shin[1].rotation.x = -Math.max(0, c) * 0.75 - 0.03;
    this.pelvis.position.y = 0.93 - (walking ? Math.abs(c) * 0.03 : 0);
    this.spine.rotation.x = walking ? -0.05 : pose === 'instrument' ? -0.3 : 0;
    this.spine.scale.y = 1 + breathe;
    this.neck.rotation.x = pose === 'instrument' ? -0.3 : 0;
    this.neck.rotation.y = pose === 'idle' ? Math.sin(this.t * 0.4) * 0.35 : 0;
    // Ruce podle činnosti (kladné x = paže dopředu, z = od těla ven).
    const [L, R] = [0, 1];
    const armSwing = s * 0.55;
    this.upper[L].rotation.set(-armSwing, 0, -0.07);
    this.upper[R].rotation.set(armSwing, 0, 0.07);
    this.fore[L].rotation.x = 0.2 + Math.max(0, -armSwing) * 0.5;
    this.fore[R].rotation.x = 0.2 + Math.max(0, armSwing) * 0.5;
    if (pose === 'hold') {
      // Pravou rukou drží výtyčku v úrovni hrudi, levou ji jistí níž.
      this.upper[R].rotation.set(0.55, 0, 0.32);
      this.fore[R].rotation.x = 1.15;
      this.upper[L].rotation.set(0.35, 0, -0.1);
      this.fore[L].rotation.x = 1.35;
    } else if (pose === 'instrument') {
      this.upper[R].rotation.set(0.95, 0, 0.12);
      this.fore[R].rotation.x = 0.7;
      this.upper[L].rotation.set(0.95, 0, -0.12);
      this.fore[L].rotation.x = 0.7;
    } else if (pose === 'carry') {
      // Kufr v pravé ruce u boku, levá se kývá.
      this.upper[R].rotation.set(0, 0, 0.2);
      this.fore[R].rotation.x = 0.05;
    } else if (pose === 'shoulder') {
      // Stativ nebo výtyčka na rameni.
      this.upper[R].rotation.set(2.5, 0, 0.25);
      this.fore[R].rotation.x = 1.5;
    }
  }
}
