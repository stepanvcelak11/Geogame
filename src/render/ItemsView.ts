import * as THREE from 'three';
import type { ItemKind, WorldItem } from '../items/items';
import { buildCase, buildLevel, buildPole, buildTripod, glove, setTripodPose } from './InstrumentModels';
import { lambert, matte, PALETTE } from './materials';

type Triple = [number, number, number];
interface Pose {
  pos: Triple;
  rot: Triple;
}

/** Jak předmět leží: model je postavený „nastojato“ od y = 0, tady ho položíme na bok se středem v počátku. */
const GROUND_POSE: Record<ItemKind, Pose> = {
  tripod: { pos: [0.53, 0.06, 0], rot: [0, 0, Math.PI / 2] },
  tsCase: { pos: [0, 0, 0], rot: [0, 0, 0] },
  gnssCase: { pos: [0, 0, 0], rot: [0, 0, 0] },
  prismPole: { pos: [1.0, 0.03, 0], rot: [0, 0, Math.PI / 2] },
  gnssRover: { pos: [1.0, 0.05, 0], rot: [0, 0, Math.PI / 2] },
  level: { pos: [0.6, 0.08, 0], rot: [0, 0, Math.PI / 2] },
  rod: { pos: [1.5, 0.03, 0], rot: [0, 0, Math.PI / 2] },
};

/** Poloha v pravé ruce v prostoru kamery (x doprava, y nahoru, −z dopředu); levá ruka je zrcadlo. */
const HELD_POSE: Record<ItemKind, Pose> = {
  tripod: { pos: [0.36, -1.32, -0.52], rot: [-0.12, 0, -0.1] },
  tsCase: { pos: [0.4, -0.82, -0.3], rot: [0, 0.25, 0] },
  gnssCase: { pos: [0.4, -0.8, -0.3], rot: [0, 0.25, 0] },
  prismPole: { pos: [0.3, -1.5, -0.62], rot: [-0.08, 0, -0.07] },
  gnssRover: { pos: [0.3, -1.45, -0.62], rot: [-0.08, 0, -0.07] },
  level: { pos: [0.36, -1.3, -0.52], rot: [-0.12, 0, -0.1] },
  rod: { pos: [0.3, -1.6, -0.62], rot: [-0.08, 0, -0.07] },
};

/** Čárový kód digitální latě (žlutá s černými pruhy), jedna textura pro všechny latě. */
let rodTexture: THREE.Texture | null = null;
function rodMaterial(): THREE.Material {
  if (!rodTexture && typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 1024;
    const g = c.getContext('2d');
    if (g) {
      g.fillStyle = '#f3d23a';
      g.fillRect(0, 0, 8, 1024);
      g.fillStyle = '#141414';
      let y = 0;
      let seed = 7;
      const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      while (y < 1024) {
        const w = 2 + Math.floor(rnd() * 9);
        if (rnd() > 0.45) g.fillRect(0, y, 8, w);
        y += w;
      }
    }
    rodTexture = new THREE.CanvasTexture(c);
  }
  return matte({ color: 0xffffff, map: rodTexture ?? undefined });
}

function mesh(geo: THREE.BufferGeometry, color: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, lambert(color));
  m.castShadow = true;
  return m;
}

function buildModel(kind: ItemKind): THREE.Group {
  switch (kind) {
    case 'tripod': {
      const g = buildTripod();
      setTripodPose(g, FOLDED.spread, FOLDED.len);
      return g;
    }
    case 'tsCase':
      return buildCase('ts');
    case 'gnssCase':
      return buildCase('gnss');
    case 'level': {
      const l = buildLevel();
      l.root.userData = { tilts: l.tilts, body: l.body };
      return l.root;
    }
    case 'rod': {
      const g = new THREE.Group();
      const rod = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3.0, 0.014).translate(0, 1.5, 0), rodMaterial());
      rod.castShadow = true;
      const foot = mesh(new THREE.BoxGeometry(0.06, 0.03, 0.03), PALETTE.darkMetal);
      foot.position.y = 0.015;
      const bubble = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 10), PALETTE.darkMetal);
      bubble.position.set(0.035, 1.4, 0);
      g.add(rod, foot, bubble);
      return g;
    }
    case 'prismPole': {
      const p = buildPole('prism').root;
      p.userData = { glove: withGlove(p) };
      return p;
    }
    case 'gnssRover': {
      const p = buildPole('gnss');
      p.root.userData = { pole: p.pole, receiver: p.receiver, controller: p.controller, glove: withGlove(p.root) };
      return p.root;
    }
  }
}

/** Rukavice na rukojeti výtyčky – vidět jen, když ji držíš. */
function withGlove(pole: THREE.Group): THREE.Object3D {
  const g = glove();
  g.position.set(-0.03, 1.1, 0.03);
  g.rotation.set(0, Math.PI / 2, Math.PI / 2);
  g.visible = false;
  pole.add(g);
  return g;
}

const FOLDED = { spread: 0.035, len: 1.0 };
const DEPLOYED = { spread: 0.36, len: 1.38 };

interface Entry {
  root: THREE.Group;
  model: THREE.Group;
}

/** Předměty na zemi nebo v rukou – čte stav z logiky, sám nic nerozhoduje. */
export class ItemsView {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    items: readonly WorldItem[],
  ) {
    for (const it of items) {
      const root = new THREE.Group();
      const model = buildModel(it.kind);
      root.add(model);
      scene.add(root);
      this.entries.set(it.id, { root, model });
    }
  }

  private heldHidden = false;
  private poleTilt = { sx: 0, sy: 0 };

  /** Náklon výtyčky v ruce na obrazovce (rad, vpravo / k sobě) – kreslí se zveličeně. */
  setPoleTilt(sx: number, sy: number): void {
    this.poleTilt = { sx, sy };
  }
  private hiddenId: string | null = null;

  /** Skryje jeden předmět (stativ se stanicí, když se díváš dalekohledem). */
  setHidden(id: string | null): void {
    this.hiddenId = id;
  }

  /** V dalekohledu nejsou vidět předměty v rukou. */
  setHeldHidden(v: boolean): void {
    this.heldHidden = v;
  }

  sync(items: readonly WorldItem[], location: string): void {
    for (const it of items) {
      const e = this.entries.get(it.id);
      if (!e) continue;
      e.root.visible =
        it.id !== this.hiddenId && ((it.state === 'held' && !this.heldHidden) || (it.state !== 'held' && it.state !== 'stored' && it.location === location));
      if (!e.root.visible) continue;
      if (it.kind === 'tripod') {
        const p = it.state === 'deployed' ? DEPLOYED : FOLDED;
        setTripodPose(e.model, p.spread, it.state === 'deployed' ? (it.legLen ?? p.len) : p.len);
        const station = (e.model.userData as { station: THREE.Object3D }).station;
        station.visible = it.state === 'deployed' && !!it.mounted;
        (station.userData as { alidade: THREE.Object3D }).alidade.rotation.y = (it.stationYaw ?? it.yaw) - it.yaw;
      }
      if (it.kind === 'gnssRover' || it.kind === 'prismPole') {
        const gl = (e.model.userData as { glove?: THREE.Object3D }).glove;
        if (gl) gl.visible = it.state === 'held';
      }
      if (it.kind === 'gnssRover') {
        const u = e.model.userData as { pole: THREE.Object3D; receiver: THREE.Object3D; controller: THREE.Object3D };
        const h = it.rig?.height ?? 2;
        u.pole.scale.y = h / 1.96;
        u.pole.position.y = h / 2;
        u.receiver.position.y = h - 0.02;
        u.receiver.visible = !!it.rig?.receiver;
        u.controller.visible = !!it.rig?.controller;
      }
      if (it.kind === 'level') {
        const u = e.model.userData as { tilts: THREE.Object3D[]; body: THREE.Object3D };
        const spread = it.state === 'deployed' ? 0.33 : 0.04;
        for (const t of u.tilts) t.rotation.x = spread;
        u.body.rotation.y = it.state === 'deployed' ? (it.stationYaw ?? it.yaw) - it.yaw : 0;
      }
      if (it.state === 'deployed') {
        // Stojí na bodě: model je postavený od hrotu (y = 0) nahoru.
        if (e.root.parent !== this.scene) this.scene.add(e.root);
        e.root.position.set(it.pos.x, it.pos.y, it.pos.z);
        e.root.rotation.set(0, it.yaw, 0);
        e.model.position.set(0, 0, 0);
        e.model.rotation.set(0, 0, 0);
      } else if (it.state === 'held') {
        if (e.root.parent !== this.camera) this.camera.add(e.root);
        const p = HELD_POSE[it.kind];
        const m = it.hand === 'left' ? -1 : 1;
        e.root.position.set(p.pos[0] * m, p.pos[1], p.pos[2]);
        const pole = it.kind === 'gnssRover' || it.kind === 'prismPole';
        const k = pole ? 6 : 0; // náklon zveličený, ať je vidět
        e.root.rotation.set(p.rot[0] + this.poleTilt.sy * k, p.rot[1] * m, p.rot[2] * m - this.poleTilt.sx * k);
        e.model.position.set(0, 0, 0);
        e.model.rotation.set(0, 0, 0);
      } else {
        if (e.root.parent !== this.scene) this.scene.add(e.root);
        e.root.position.set(it.pos.x, it.pos.y, it.pos.z);
        e.root.rotation.set(0, it.yaw, 0);
        const p = GROUND_POSE[it.kind];
        e.model.position.set(...p.pos);
        e.model.rotation.set(...p.rot);
      }
    }
  }
}
